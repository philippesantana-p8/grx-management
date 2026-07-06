-- GRX Management — Frete em OS + cálculo ANTT (origem/destino, pedágio, valor fechado)
-- Migration: 014_service_orders_freight.sql

ALTER TABLE public.service_orders
    DROP CONSTRAINT IF EXISTS service_orders_service_type_check;

ALTER TABLE public.service_orders
    ADD CONSTRAINT service_orders_service_type_check
    CHECK (service_type IN ('Frete', 'Transporte', 'Estacionamento', 'CarWash', 'Outro'));

ALTER TABLE public.service_orders
    ADD COLUMN IF NOT EXISTS freight_origin_address TEXT,
    ADD COLUMN IF NOT EXISTS freight_destination_address TEXT,
    ADD COLUMN IF NOT EXISTS freight_distance_km NUMERIC(10,2)
        CHECK (freight_distance_km IS NULL OR freight_distance_km > 0),
    ADD COLUMN IF NOT EXISTS freight_toll_amount NUMERIC(12,2)
        CHECK (freight_toll_amount IS NULL OR freight_toll_amount >= 0),
    ADD COLUMN IF NOT EXISTS freight_antt_cargo_type INTEGER
        CHECK (freight_antt_cargo_type IS NULL OR freight_antt_cargo_type BETWEEN 1 AND 12),
    ADD COLUMN IF NOT EXISTS freight_antt_axles INTEGER
        CHECK (freight_antt_axles IS NULL OR freight_antt_axles IN (2, 3, 4, 5, 6, 7, 9)),
    ADD COLUMN IF NOT EXISTS freight_antt_composicao_veicular BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS freight_antt_alto_desempenho BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS freight_antt_retorno_vazio BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS freight_antt_minimum NUMERIC(12,2)
        CHECK (freight_antt_minimum IS NULL OR freight_antt_minimum >= 0),
    ADD COLUMN IF NOT EXISTS freight_antt_detail JSONB,
    ADD COLUMN IF NOT EXISTS freight_suggested_total NUMERIC(12,2)
        CHECK (freight_suggested_total IS NULL OR freight_suggested_total >= 0),
    ADD COLUMN IF NOT EXISTS freight_agreed_amount NUMERIC(12,2)
        CHECK (freight_agreed_amount IS NULL OR freight_agreed_amount >= 0);

COMMENT ON COLUMN public.service_orders.freight_agreed_amount IS
    'Valor fechado com o cliente (pode ser maior ou menor que o piso ANTT + pedágio).';
