-- PARTE 3B de 3 — Aceite/recusa + permissões

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
      proposal_accepted_at = NOW()
    WHERE id = v_row.id;
  ELSE
    UPDATE public.service_orders
    SET
      proposal_response = 'rejected',
      proposal_rejected_at = NOW(),
      status = 'Cancelado'
    WHERE id = v_row.id;
  END IF;

  RETURN jsonb_build_object(
    'proposal_response', (SELECT proposal_response FROM public.service_orders WHERE id = v_row.id),
    'status', (SELECT status FROM public.service_orders WHERE id = v_row.id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_proposal_token(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_proposal_sent(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_proposal_follow_up(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_proposal(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_proposal(TEXT, TEXT) TO anon, authenticated;
