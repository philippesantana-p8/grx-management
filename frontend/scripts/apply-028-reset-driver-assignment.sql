-- Cole no SQL Editor do Supabase (Script único)

CREATE OR REPLACE FUNCTION public.reset_driver_assignment(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_service_order_member(p_order_id);

  UPDATE public.service_orders
  SET
    proposed_driver_id = NULL,
    driver_assignment_sent_at = NULL,
    driver_assignment_response = 'pending',
    driver_assignment_accepted_at = NULL,
    driver_assignment_rejected_at = NULL,
    driver_id = NULL
  WHERE id = p_order_id
    AND proposal_response = 'accepted'
    AND (driver_id IS NULL OR driver_assignment_response <> 'accepted');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não foi possível cancelar a designação desta ordem';
  END IF;

  RETURN jsonb_build_object(
    'driver_assignment_response', 'pending',
    'proposed_driver_id', NULL,
    'driver_assignment_sent_at', NULL,
    'driver_id', NULL
  );
END;
$$;

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
    status = 'Aguardando aprovação cliente',
    proposed_driver_id = NULL,
    driver_assignment_sent_at = NULL,
    driver_assignment_response = 'pending',
    driver_assignment_accepted_at = NULL,
    driver_assignment_rejected_at = NULL,
    driver_id = NULL,
    driver_assignment_rejected_driver_ids = '{}'
  WHERE id = p_order_id
    AND proposal_sent_at IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta não enviada ou ordem não encontrada';
  END IF;

  RETURN jsonb_build_object(
    'proposal_response', 'pending',
    'status', 'Aguardando aprovação cliente',
    'driver_assignment_response', 'pending',
    'proposed_driver_id', NULL,
    'driver_assignment_sent_at', NULL,
    'driver_id', NULL,
    'driver_assignment_rejected_driver_ids', '{}'::uuid[]
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_driver_assignment(UUID) TO authenticated;

-- Sair do limbo da OS001 (aguardando motorista sem envio real):
UPDATE public.service_orders
SET
  proposed_driver_id = NULL,
  driver_assignment_sent_at = NULL,
  driver_assignment_response = 'pending',
  driver_assignment_accepted_at = NULL,
  driver_assignment_rejected_at = NULL,
  driver_id = NULL
WHERE code = 'OS001'
  AND driver_assignment_response = 'pending'
  AND driver_assignment_sent_at IS NOT NULL;

SELECT code, proposal_response, driver_assignment_response, driver_assignment_sent_at
FROM public.service_orders
WHERE code = 'OS001';
