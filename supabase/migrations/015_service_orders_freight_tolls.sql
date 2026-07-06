-- GRX Management — Detalhamento de pedágios em OS de frete
-- Migration: 015_service_orders_freight_tolls.sql

ALTER TABLE public.service_orders
    ADD COLUMN IF NOT EXISTS freight_toll_count INTEGER
        CHECK (freight_toll_count IS NULL OR freight_toll_count >= 0),
    ADD COLUMN IF NOT EXISTS freight_toll_detail JSONB;

COMMENT ON COLUMN public.service_orders.freight_toll_count IS
    'Quantidade de praças de pedágio na rota (QualP ou informado manualmente).';

COMMENT ON COLUMN public.service_orders.freight_toll_detail IS
    'Lista de praças com nome, local e valor — base para negociação com o cliente.';
