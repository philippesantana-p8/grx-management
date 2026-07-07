-- Reabre a proposta para o cliente responder de novo (Aceitar / Recusar)
-- Cole no Supabase SQL Editor.

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

-- Reset OS001 para teste do link público (botões Aceitar / Recusar)
UPDATE public.service_orders
SET
  proposal_response = 'pending',
  proposal_accepted_at = NULL,
  proposal_rejected_at = NULL,
  status = 'Aguardando aprovação cliente'
WHERE code = 'OS001';

SELECT code, status, proposal_response, proposal_token
FROM public.service_orders
WHERE code = 'OS001';
