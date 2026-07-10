-- Valores a pagar ao motorista e ajudante na designação

ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS driver_assignment_pay_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS driver_assignment_assistant_pay_amount NUMERIC;

COMMENT ON COLUMN public.service_orders.driver_assignment_pay_amount IS
  'Valor acordado a pagar ao motorista nesta designação (WhatsApp/e-mail).';
COMMENT ON COLUMN public.service_orders.driver_assignment_assistant_pay_amount IS
  'Valor do ajudante, quando houver, nesta designação.';

-- Assinatura antiga (2 parâmetros) — DROP obrigatório antes da nova versão
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
    driver_id = NULL,
    driver_assignment_pay_amount = NULL,
    driver_assignment_assistant_pay_amount = NULL
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

CREATE OR REPLACE FUNCTION public.get_public_driver_assignment(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.service_orders%ROWTYPE;
  v_driver_name TEXT;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 32 THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT * INTO v_row
  FROM public.service_orders
  WHERE driver_assignment_token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT name INTO v_driver_name
  FROM public.drivers
  WHERE id = v_row.proposed_driver_id;

  RETURN jsonb_build_object(
    'found', true,
    'company_name', (SELECT COALESCE(trade_name, name) FROM public.companies WHERE id = v_row.company_id),
    'driver_name', v_driver_name,
    'driver_assignment_response', v_row.driver_assignment_response,
    'driver_assignment_sent_at', v_row.driver_assignment_sent_at,
    'driver_assignment_pay_amount', v_row.driver_assignment_pay_amount,
    'driver_assignment_assistant_pay_amount', v_row.driver_assignment_assistant_pay_amount,
    'can_respond', (
      v_row.driver_assignment_sent_at IS NOT NULL
      AND v_row.driver_assignment_response = 'pending'
      AND v_row.proposed_driver_id IS NOT NULL
    ),
    'order', jsonb_build_object(
      'code', v_row.code,
      'service_type', v_row.service_type,
      'service_date', v_row.service_date,
      'plate', v_row.plate,
      'client_name', v_row.client_name,
      'freight_origin_address', v_row.freight_origin_address,
      'freight_destination_address', v_row.freight_destination_address,
      'freight_distance_km', v_row.freight_distance_km,
      'freight_toll_amount', v_row.freight_toll_amount,
      'freight_agreed_amount', v_row.freight_agreed_amount,
      'service_amount', v_row.service_amount
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_driver_assignment(UUID, UUID, NUMERIC, NUMERIC) TO authenticated;

NOTIFY pgrst, 'reload schema';
