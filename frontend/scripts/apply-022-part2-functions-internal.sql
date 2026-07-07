-- PARTE 2 de 3 — Funções internas (autenticadas)

CREATE OR REPLACE FUNCTION public._assert_service_order_member(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT company_id INTO v_company_id
  FROM public.service_orders
  WHERE id = p_order_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Ordem de serviço não encontrada';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_members
    WHERE company_id = v_company_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Sem permissão para esta ordem';
  END IF;

  RETURN v_company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_proposal_token(p_order_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
BEGIN
  PERFORM public._assert_service_order_member(p_order_id);

  SELECT proposal_token INTO v_token
  FROM public.service_orders
  WHERE id = p_order_id;

  IF v_token IS NULL OR v_token = '' THEN
    v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    UPDATE public.service_orders
    SET proposal_token = v_token
    WHERE id = p_order_id;
  END IF;

  RETURN v_token;
END;
$$;

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
    status = 'Aguardando aprovação cliente',
    proposal_response = CASE
      WHEN proposal_response IN ('accepted', 'rejected') THEN proposal_response
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

CREATE OR REPLACE FUNCTION public.register_proposal_follow_up(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_last_at TIMESTAMPTZ;
BEGIN
  PERFORM public._assert_service_order_member(p_order_id);

  UPDATE public.service_orders
  SET
    proposal_last_follow_up_at = NOW(),
    proposal_follow_up_count = proposal_follow_up_count + 1
  WHERE id = p_order_id
  RETURNING proposal_follow_up_count, proposal_last_follow_up_at
  INTO v_count, v_last_at;

  RETURN jsonb_build_object(
    'proposal_follow_up_count', v_count,
    'proposal_last_follow_up_at', v_last_at
  );
END;
$$;
