-- GRX Management — Categorias da CNH (multi-seleção)
-- Migration: 007_drivers_cnh_categories.sql

ALTER TABLE public.drivers
    ADD COLUMN IF NOT EXISTS cnh_categories TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.drivers.cnh_categories IS
    'Categorias habilitadas na CNH (ex.: B, C, AB). Permite múltiplas seleções.';

CREATE INDEX IF NOT EXISTS idx_drivers_cnh_categories
    ON public.drivers USING GIN (cnh_categories)
    WHERE deleted_at IS NULL;
