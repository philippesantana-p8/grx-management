-- Migration: 020_service_orders_transport_km_rate.sql
-- Tarifa por km escolhida para referência de transporte (van).

ALTER TABLE public.service_orders
    ADD COLUMN IF NOT EXISTS freight_transport_km_rate NUMERIC(8,4)
        CHECK (freight_transport_km_rate IS NULL OR freight_transport_km_rate > 0);

COMMENT ON COLUMN public.service_orders.freight_transport_km_rate IS
    'Tarifa orientativa R$/km para transporte de passageiros (van).';
