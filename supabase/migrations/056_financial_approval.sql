-- Aplicar no SQL Editor do Supabase (dev e produção)
-- Fase 4 — Aprovação de lançamentos financeiros manuais
-- Migration: supabase/migrations/056_financial_approval.sql

-- ---------------------------------------------------------------------------
-- Colunas de aprovação em financial_transactions
-- ---------------------------------------------------------------------------
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS approval_status TEXT;

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS reviewed_by_name TEXT;

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS review_note TEXT;

-- Legado + tudo que já existia = aprovado (grandfathering)
UPDATE public.financial_transactions
SET approval_status = 'approved'
WHERE approval_status IS NULL;

ALTER TABLE public.financial_transactions
  ALTER COLUMN approval_status SET DEFAULT 'approved';

ALTER TABLE public.financial_transactions
  ALTER COLUMN approval_status SET NOT NULL;

ALTER TABLE public.financial_transactions
  DROP CONSTRAINT IF EXISTS financial_transactions_approval_status_check;

ALTER TABLE public.financial_transactions
  ADD CONSTRAINT financial_transactions_approval_status_check
  CHECK (approval_status IN ('draft', 'submitted', 'approved', 'rejected', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_ft_approval_company_status
  ON public.financial_transactions (company_id, approval_status, transaction_date DESC);

COMMENT ON COLUMN public.financial_transactions.approval_status IS
  'draft|submitted|approved|rejected|cancelled — só approved entra em DRE/dashboard/rateio.';

-- ---------------------------------------------------------------------------
-- Parâmetros de alçada / quem aprova (por empresa)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_financial_approval_settings (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  -- admin | admin_or_master | master_only
  approver_mode TEXT NOT NULL DEFAULT 'admin_or_master'
    CHECK (approver_mode IN ('admin', 'admin_or_master', 'master_only')),
  -- NULL = sem auto-aprovação (tudo submitted exige aprovador)
  auto_approve_below_amount NUMERIC(12,2)
    CHECK (auto_approve_below_amount IS NULL OR auto_approve_below_amount >= 0),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.company_financial_approval_settings IS
  'Alçada e quem pode aprovar lançamentos manuais (Admin e/ou Senha Máster).';

ALTER TABLE public.company_financial_approval_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_fin_approval_settings_select ON public.company_financial_approval_settings;
CREATE POLICY company_fin_approval_settings_select ON public.company_financial_approval_settings
  FOR SELECT TO authenticated
  USING (public.auth_user_has_company(company_id));

DROP POLICY IF EXISTS company_fin_approval_settings_insert ON public.company_financial_approval_settings;
CREATE POLICY company_fin_approval_settings_insert ON public.company_financial_approval_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_is_company_admin(company_id));

DROP POLICY IF EXISTS company_fin_approval_settings_update ON public.company_financial_approval_settings;
CREATE POLICY company_fin_approval_settings_update ON public.company_financial_approval_settings
  FOR UPDATE TO authenticated
  USING (public.auth_user_is_company_admin(company_id))
  WITH CHECK (public.auth_user_is_company_admin(company_id));

-- ---------------------------------------------------------------------------
-- Pagamento motorista da designação nasce aprovado
-- ---------------------------------------------------------------------------
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
    description,
    approval_status,
    submitted_at
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
    format('OS %s — pagamento motorista (%s)', v_row.code, COALESCE(v_driver_name, '—')),
    'approved',
    NOW()
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
      description,
      approval_status,
      submitted_at
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
      format('OS %s — pagamento ajudante (%s)', v_row.code, COALESCE(v_driver_name, '—')),
      'approved',
      NOW()
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
