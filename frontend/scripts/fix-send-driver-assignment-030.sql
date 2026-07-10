-- CORREÇÃO URGENTE: erro "Could not find send_driver_assignment(...)"
-- Cole no SQL Editor do Supabase e clique Run.

ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS driver_assignment_pay_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS driver_assignment_assistant_pay_amount NUMERIC;

DROP FUNCTION IF EXISTS public.send_driver_assignment(UUID, UUID);

CREATE OR REPLACE FUNCTION public.send_driver_assignment(
  p_order_id UUID,
  p_driver_id UUID,
  p_driver_pay_amount NUMERIC DEFAULT NULL,
  p_assistant_pay_amount NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_sent_at TIMESTAMPTZ;
  v_row public.service_orders%ROWTYPE;
BEGIN
  PERFORM public._assert_service_order_member(p_order_id);

  IF p_driver_id IS NULL THEN
    RAISE EXCEPTION 'Motorista não informado';
  END IF;

  IF p_driver_pay_amount IS NULL OR p_driver_pay_amount <= 0 THEN
    RAISE EXCEPTION 'Informe o valor a pagar ao motorista';
  END IF;

  IF p_assistant_pay_amount IS NOT NULL AND p_assistant_pay_amount < 0 THEN
    RAISE EXCEPTION 'Valor do ajudante inválido';
  END IF;

  SELECT * INTO v_row
  FROM public.service_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de serviço não encontrada';
  END IF;

  IF v_row.proposal_response <> 'accepted' THEN
    RAISE EXCEPTION 'A proposta precisa estar aceita pelo cliente antes de designar motorista';
  END IF;

  IF v_row.driver_id IS NOT NULL AND v_row.driver_assignment_response = 'accepted' THEN
    RAISE EXCEPTION 'Motorista já confirmado nesta ordem';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.id = p_driver_id
      AND d.company_id = v_row.company_id
      AND d.status = 'Ativo'
      AND d.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Motorista inválido ou inativo';
  END IF;

  v_token := public.ensure_driver_assignment_token(p_order_id);

  UPDATE public.service_orders
  SET
    proposed_driver_id = p_driver_id,
    driver_assignment_sent_at = NOW(),
    driver_assignment_response = 'pending',
    driver_assignment_accepted_at = NULL,
    driver_assignment_rejected_at = NULL,
    driver_id = NULL,
    driver_assignment_pay_amount = p_driver_pay_amount,
    driver_assignment_assistant_pay_amount = NULLIF(p_assistant_pay_amount, 0)
  WHERE id = p_order_id;

  SELECT driver_assignment_sent_at INTO v_sent_at
  FROM public.service_orders
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'token', v_token,
    'driver_assignment_sent_at', v_sent_at,
    'proposed_driver_id', p_driver_id,
    'driver_assignment_pay_amount', p_driver_pay_amount,
    'driver_assignment_assistant_pay_amount', NULLIF(p_assistant_pay_amount, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_driver_assignment(UUID, UUID, NUMERIC, NUMERIC) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Conferir (deve listar a função com 4 parâmetros):
SELECT proname, pg_get_function_identity_arguments(oid)
FROM pg_proc
WHERE proname = 'send_driver_assignment';
