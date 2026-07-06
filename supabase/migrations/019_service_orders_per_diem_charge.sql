-- Migration: 019_service_orders_per_diem_charge.sql
-- Responsável pelas despesas de viagem: Cliente ou GRX.

ALTER TABLE public.service_orders
    ADD COLUMN IF NOT EXISTS freight_per_diem_charge_to TEXT NOT NULL DEFAULT 'Cliente'
        CHECK (freight_per_diem_charge_to IN ('Cliente', 'GRX'));

COMMENT ON COLUMN public.service_orders.freight_per_diem_charge_to IS
    'Cliente = repassar na proposta; GRX = custo interno da empresa.';
