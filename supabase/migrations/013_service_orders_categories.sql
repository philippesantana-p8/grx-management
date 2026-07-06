-- GRX Management — OS: Estacionamento, categorias de serviço e conta DRE
-- Migration: 013_service_orders_categories.sql

ALTER TABLE public.service_orders
    DROP CONSTRAINT IF EXISTS service_orders_service_type_check;

ALTER TABLE public.service_orders
    ADD CONSTRAINT service_orders_service_type_check
    CHECK (service_type IN ('CarWash', 'Transporte', 'Estacionamento', 'Outro'));

ALTER TABLE public.service_orders
    ADD COLUMN IF NOT EXISTS service_categories TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS chart_of_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.service_orders.service_categories IS
    'Natureza do serviço (Transporte, Frete, etc.) — alimenta classificação DRE.';

COMMENT ON COLUMN public.service_orders.chart_of_account_id IS
    'Conta DRE de receita sugerida/vinculada à ordem de serviço.';

CREATE INDEX IF NOT EXISTS idx_service_orders_chart_of_account
    ON public.service_orders(chart_of_account_id)
    WHERE chart_of_account_id IS NOT NULL;
