-- Fluxo completo: aceite → status Aberto, reset, sync OS001, mark_proposal_sent
-- Cole no Supabase SQL Editor e execute uma vez.

-- 1) Aceite/recusa pública
CREATE OR REPLACE FUNCTION public.respond_to_proposal(p_token TEXT, p_action TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.service_orders%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 32 THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  IF p_action NOT IN ('accept', 'reject') THEN
    RAISE EXCEPTION 'Ação inválida';
  END IF;

  SELECT * INTO v_row
  FROM public.service_orders
  WHERE proposal_token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta não encontrada';
  END IF;

  IF v_row.proposal_sent_at IS NULL THEN
    RAISE EXCEPTION 'Proposta ainda não foi enviada ao cliente';
  END IF;

  IF v_row.proposal_response <> 'pending' THEN
    RAISE EXCEPTION 'Proposta já respondida';
  END IF;

  IF p_action = 'accept' THEN
    UPDATE public.service_orders
    SET
      proposal_response = 'accepted',
      proposal_accepted_at = NOW(),
      status = 'Aberto'
    WHERE id = v_row.id;
  ELSE
    UPDATE public.service_orders
    SET
      proposal_response = 'rejected',
      proposal_rejected_at = NOW(),
      status = 'Aguardando aprovação cliente'
    WHERE id = v_row.id;
  END IF;

  RETURN jsonb_build_object(
    'proposal_response', (SELECT proposal_response FROM public.service_orders WHERE id = v_row.id),
    'status', (SELECT status FROM public.service_orders WHERE id = v_row.id)
  );
END;
$$;

-- 2) Registrar envio — não sobrescreve Aberto quando já aceita
CREATE OR REPLACE FUNCTION public.mark_proposal_sent(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_sent_at TIMESTAMPTZ;
BEGIN
  PERFORM public._assert_service_order_member(p_order_id);
  v_token := public.ensure_proposal_token(p_order_id);

  UPDATE public.service_orders
  SET
    proposal_sent_at = COALESCE(proposal_sent_at, NOW()),
    status = CASE
      WHEN proposal_response = 'accepted' THEN status
      ELSE 'Aguardando aprovação cliente'
    END,
    proposal_response = CASE
      WHEN proposal_response = 'accepted' THEN proposal_response
      ELSE 'pending'
    END
  WHERE id = p_order_id;

  SELECT proposal_sent_at INTO v_sent_at
  FROM public.service_orders
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'token', v_token,
    'proposal_sent_at', v_sent_at
  );
END;
$$;

-- 3) Reabrir proposta para teste (staff)
CREATE OR REPLACE FUNCTION public.reset_proposal_client_response(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_service_order_member(p_order_id);

  UPDATE public.service_orders
  SET
    proposal_response = 'pending',
    proposal_accepted_at = NULL,
    proposal_rejected_at = NULL,
    status = 'Aguardando aprovação cliente'
  WHERE id = p_order_id
    AND proposal_sent_at IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta não enviada ou ordem não encontrada';
  END IF;

  RETURN jsonb_build_object(
    'proposal_response', 'pending',
    'status', 'Aguardando aprovação cliente'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_proposal_client_response(UUID) TO authenticated;

-- 4) Corrigir OS aceitas com status antigo
UPDATE public.service_orders
SET status = 'Aberto'
WHERE proposal_response = 'accepted'
  AND status <> 'Aberto';

-- 5) Reset OS001 para testar Aceitar / Recusar de novo
UPDATE public.service_orders
SET
  proposal_response = 'pending',
  proposal_accepted_at = NULL,
  proposal_rejected_at = NULL,
  status = 'Aguardando aprovação cliente'
WHERE code = 'OS001';

SELECT code, status, proposal_response, proposal_token, proposal_sent_at
FROM public.service_orders
WHERE code = 'OS001';
