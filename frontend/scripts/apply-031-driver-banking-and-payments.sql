-- Cole no SQL Editor do Supabase (migration 031)

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS pix_key TEXT,
  ADD COLUMN IF NOT EXISTS bank_code TEXT,
  ADD COLUMN IF NOT EXISTS bank_agency TEXT,
  ADD COLUMN IF NOT EXISTS bank_account TEXT;

COMMENT ON COLUMN public.drivers.pix_key IS 'Chave Pix do motorista para pagamento.';
COMMENT ON COLUMN public.drivers.bank_code IS 'Código do banco (ex.: 341).';
COMMENT ON COLUMN public.drivers.bank_agency IS 'Agência bancária.';
COMMENT ON COLUMN public.drivers.bank_account IS 'Número da conta corrente.';

ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS driver_payment_paid_at TIMESTAMPTZ;

COMMENT ON COLUMN public.service_orders.driver_payment_paid_at IS
  'Data em que o pagamento ao motorista (designação) foi registrado como pago.';

CREATE OR REPLACE FUNCTION public.mark_driver_payment_paid(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.service_orders%ROWTYPE;
BEGIN
  PERFORM public._assert_service_order_member(p_order_id);

  SELECT * INTO v_row
  FROM public.service_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de serviço não encontrada';
  END IF;

  IF v_row.driver_id IS NULL OR v_row.driver_assignment_response <> 'accepted' THEN
    RAISE EXCEPTION 'Motorista ainda não confirmou a designação';
  END IF;

  IF v_row.driver_assignment_pay_amount IS NULL OR v_row.driver_assignment_pay_amount <= 0 THEN
    RAISE EXCEPTION 'Esta OS não possui valor de pagamento ao motorista';
  END IF;

  IF v_row.driver_payment_paid_at IS NOT NULL THEN
    RAISE EXCEPTION 'Pagamento já registrado para esta OS';
  END IF;

  UPDATE public.service_orders
  SET driver_payment_paid_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'driver_payment_paid_at', NOW(),
    'order_id', p_order_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_driver_payment_paid(UUID) TO authenticated;
