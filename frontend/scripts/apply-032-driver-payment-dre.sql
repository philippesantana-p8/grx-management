-- Cole no SQL Editor do Supabase (migration 032 — requer 031 aplicada)

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS service_order_id UUID REFERENCES public.service_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_financial_transactions_service_order
  ON public.financial_transactions(service_order_id)
  WHERE service_order_id IS NOT NULL;

ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS driver_payment_driver_transaction_id UUID
    REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS driver_payment_assistant_transaction_id UUID
    REFERENCES public.financial_transactions(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.mark_driver_payment_paid(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.service_orders%ROWTYPE;
  v_motorista_account_id UUID;
  v_ajudante_account_id UUID;
  v_driver_tx_id UUID;
  v_assistant_tx_id UUID;
  v_assistant_amount NUMERIC;
  v_driver_name TEXT;
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

  SELECT id INTO v_motorista_account_id
  FROM public.chart_of_accounts
  WHERE company_id = v_row.company_id
    AND name = 'Motorista'
    AND status = 'Ativo'
  LIMIT 1;

  IF v_motorista_account_id IS NULL THEN
    RAISE EXCEPTION 'Conta DRE «Motorista» não encontrada. Importe o plano de contas (Contas DRE).';
  END IF;

  SELECT id INTO v_ajudante_account_id
  FROM public.chart_of_accounts
  WHERE company_id = v_row.company_id
    AND name = 'Ajudante'
    AND status = 'Ativo'
  LIMIT 1;

  SELECT name INTO v_driver_name FROM public.drivers WHERE id = v_row.driver_id;

  v_assistant_amount := COALESCE(v_row.driver_assignment_assistant_pay_amount, 0);

  INSERT INTO public.financial_transactions (
    company_id,
    transaction_date,
    amount,
    chart_of_account_id,
    classification,
    transaction_type,
    service_date,
    driver_id,
    service_order_id,
    description
  )
  VALUES (
    v_row.company_id,
    CURRENT_DATE,
    v_row.driver_assignment_pay_amount,
    v_motorista_account_id,
    'Operacional',
    'Despesa',
    v_row.service_date,
    v_row.driver_id,
    v_row.id,
    format('OS %s — pagamento motorista (%s)', v_row.code, COALESCE(v_driver_name, '—'))
  )
  RETURNING id INTO v_driver_tx_id;

  IF v_assistant_amount > 0 THEN
    IF v_ajudante_account_id IS NULL THEN
      RAISE EXCEPTION 'Conta DRE «Ajudante» não encontrada. Importe o plano de contas (Contas DRE).';
    END IF;

    INSERT INTO public.financial_transactions (
      company_id,
      transaction_date,
      amount,
      chart_of_account_id,
      classification,
      transaction_type,
      service_date,
      driver_id,
      service_order_id,
      description
    )
    VALUES (
      v_row.company_id,
      CURRENT_DATE,
      v_assistant_amount,
      v_ajudante_account_id,
      'Operacional',
      'Despesa',
      v_row.service_date,
      v_row.driver_id,
      v_row.id,
      format('OS %s — pagamento ajudante (%s)', v_row.code, COALESCE(v_driver_name, '—'))
    )
    RETURNING id INTO v_assistant_tx_id;
  END IF;

  UPDATE public.service_orders
  SET
    driver_payment_paid_at = NOW(),
    driver_payment_driver_transaction_id = v_driver_tx_id,
    driver_payment_assistant_transaction_id = v_assistant_tx_id
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'driver_payment_paid_at', NOW(),
    'order_id', p_order_id,
    'driver_transaction_id', v_driver_tx_id,
    'assistant_transaction_id', v_assistant_tx_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_driver_payment_paid(UUID) TO authenticated;
