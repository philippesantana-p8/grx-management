-- GRX Management — CNH no cadastro de motoristas
-- Migration: 005_drivers_cnh.sql

ALTER TABLE public.drivers
    ADD COLUMN IF NOT EXISTS cnh_number TEXT,
    ADD COLUMN IF NOT EXISTS cnh_expiry_date DATE;

COMMENT ON COLUMN public.drivers.cnh_number IS 'Número da CNH do motorista.';
COMMENT ON COLUMN public.drivers.cnh_expiry_date IS 'Data de vencimento da CNH.';

CREATE INDEX IF NOT EXISTS idx_drivers_cnh_expiry
    ON public.drivers(company_id, cnh_expiry_date)
    WHERE cnh_expiry_date IS NOT NULL AND deleted_at IS NULL;
