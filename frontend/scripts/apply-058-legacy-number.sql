-- Aplicar no SQL Editor do Supabase
-- Número Invoice/OS do sistema legado (consulta do Rafael)
-- Migration: supabase/migrations/058_legacy_number.sql

ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS legacy_number TEXT;

COMMENT ON COLUMN public.service_orders.legacy_number IS
  'Número da Invoice/OS no sistema legado (ex.: COT). Código 8 dígitos permanece em code.';

CREATE INDEX IF NOT EXISTS idx_service_orders_company_legacy_number
  ON public.service_orders (company_id, legacy_number)
  WHERE legacy_number IS NOT NULL AND btrim(legacy_number) <> '';

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS legacy_number TEXT;

COMMENT ON COLUMN public.financial_transactions.legacy_number IS
  'Número legado (Invoice/OS/COT) para consulta no histórico importado.';

CREATE INDEX IF NOT EXISTS idx_financial_transactions_company_legacy_number
  ON public.financial_transactions (company_id, legacy_number)
  WHERE legacy_number IS NOT NULL AND btrim(legacy_number) <> '';
