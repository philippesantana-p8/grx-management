-- Migration: 018_service_orders_per_diem.sql
-- Diárias, hospedagem e alimentação em OS com rota longa (> 1.000 km).

ALTER TABLE public.service_orders
    ADD COLUMN IF NOT EXISTS freight_travel_days INTEGER
        CHECK (freight_travel_days IS NULL OR freight_travel_days >= 1),
    ADD COLUMN IF NOT EXISTS freight_per_diem_detail JSONB,
    ADD COLUMN IF NOT EXISTS freight_per_diem_total NUMERIC(12,2)
        CHECK (freight_per_diem_total IS NULL OR freight_per_diem_total >= 0);

COMMENT ON COLUMN public.service_orders.freight_travel_days IS
    'Dias de viagem/pernoite em rotas longas (ex.: > 1.000 km).';

COMMENT ON COLUMN public.service_orders.freight_per_diem_detail IS
    'Detalhamento por dia: hospedagem, café da manhã, almoço, jantar e diária.';

COMMENT ON COLUMN public.service_orders.freight_per_diem_total IS
    'Soma das despesas de viagem (hospedagem + alimentação + diárias).';
