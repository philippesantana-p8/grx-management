-- GRX Management — Eixos no cadastro de caminhão (frete ANTT na OS)
-- Migration: 016_vehicles_axle_count.sql

ALTER TABLE public.vehicles
    ADD COLUMN IF NOT EXISTS axle_count INTEGER
        CHECK (axle_count IS NULL OR axle_count IN (2, 3, 4, 5, 6, 7, 9));

COMMENT ON COLUMN public.vehicles.axle_count IS
    'Quantidade de eixos (caminhão) — preenchida automaticamente em freight_antt_axles na OS de frete.';
