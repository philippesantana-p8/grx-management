-- =============================================================================
-- GRX Management — script único para designação de motorista, pagamentos e DRE
-- Cole no SQL Editor do Supabase (https://supabase.com/dashboard) e clique Run.
-- Corrige: WhatsApp/e-mail, valores na designação, dados bancários, DRE.
-- =============================================================================

-- ── 030: valores na designação + send_driver_assignment (4 parâmetros) ────────

ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS driver_assignment_pay_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS driver_assignment_assistant_pay_amount NUMERIC;

COMMENT ON COLUMN public.service_orders.driver_assignment_pay_amount IS
  'Valor acordado a pagar ao motorista nesta designação (WhatsApp/e-mail).';
COMMENT ON COLUMN public.service_orders.driver_assignment_assistant_pay_amount IS
  'Valor do ajudante, quando houver, nesta designação.';

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
  v_driver_id UUID;
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

  v_driver_id := COALESCE(v_row.proposed_driver_id, v_row.driver_id);

  SELECT name INTO v_driver_name
  FROM public.drivers
  WHERE id = v_driver_id;

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
      'freight_toll_amount', v_row.freight_toll_amount
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_driver_assignment(UUID, UUID, NUMERIC, NUMERIC) TO authenticated;

-- ── 031: dados bancários do motorista + pagamento registrado ──────────────────

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

-- ── 032: DRE + mark_driver_payment_paid com lançamentos ───────────────────────

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

NOTIFY pgrst, 'reload schema';

-- Conferir (deve listar send_driver_assignment com 4 parâmetros):
SELECT proname, pg_get_function_identity_arguments(oid)
FROM pg_proc
WHERE proname IN ('send_driver_assignment', 'mark_driver_payment_paid', 'get_public_driver_assignment');
