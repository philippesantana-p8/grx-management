-- Migration: 017_service_orders_status_approval.sql
-- Novo status para OS aguardando aprovação do cliente (proposta enviada).

ALTER TABLE public.service_orders
    DROP CONSTRAINT IF EXISTS service_orders_status_check;

ALTER TABLE public.service_orders
    ADD CONSTRAINT service_orders_status_check
    CHECK (status IN ('Aberto', 'Aguardando aprovação cliente', 'Concluido', 'Cancelado'));

COMMENT ON COLUMN public.service_orders.status IS
    'Aberto | Aguardando aprovação cliente | Concluido | Cancelado';
