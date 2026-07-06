-- GRX Management — Motorista em ordem de serviço
-- Migration: 009_service_orders_driver.sql

ALTER TABLE public.service_orders
    ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.service_orders.driver_id IS
    'Motorista alocado na ordem de serviço (transporte e demais operações).';

CREATE INDEX IF NOT EXISTS idx_service_orders_driver_open
    ON public.service_orders(company_id, driver_id)
    WHERE status = 'Aberto' AND driver_id IS NOT NULL;

-- Extensão do tipo de serviço para transporte
ALTER TABLE public.service_orders
    DROP CONSTRAINT IF EXISTS service_orders_service_type_check;

ALTER TABLE public.service_orders
    ADD CONSTRAINT service_orders_service_type_check
    CHECK (service_type IN ('CarWash', 'Transporte', 'Outro'));
