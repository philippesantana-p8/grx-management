-- GRX Management — Infrações de trânsito + vínculo OS/veículo
-- Migration: 010_traffic_infractions.sql

ALTER TABLE public.service_orders
    ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.service_orders.vehicle_id IS
    'Veículo da frota vinculado à ordem (complementa a placa textual).';

CREATE INDEX IF NOT EXISTS idx_service_orders_vehicle
    ON public.service_orders(company_id, vehicle_id)
    WHERE vehicle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_transactions_driver_lookup
    ON public.financial_transactions(company_id, operational_vehicle_id, service_date)
    WHERE driver_id IS NOT NULL AND operational_vehicle_id IS NOT NULL;

CREATE TABLE public.traffic_infractions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code                TEXT NOT NULL,
    vehicle_id          UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
    driver_id           UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
    service_order_id    UUID REFERENCES public.service_orders(id) ON DELETE SET NULL,
    infraction_date     DATE NOT NULL,
    ait_number          TEXT,
    description         TEXT,
    amount              NUMERIC(12,2) CHECK (amount IS NULL OR amount >= 0),
    points              INTEGER CHECK (points IS NULL OR points >= 0),
    assignment_source   TEXT
                        CHECK (assignment_source IS NULL OR assignment_source IN (
                            'manual', 'service_order', 'financial_transaction'
                        )),
    assignment_status   TEXT NOT NULL DEFAULT 'Pendente'
                        CHECK (assignment_status IN ('Pendente', 'Confirmado', 'Contestado')),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, code)
);

COMMENT ON TABLE public.traffic_infractions IS
    'Controle de infrações de trânsito — pontos e responsável (cruzamento com OS).';

CREATE INDEX idx_traffic_infractions_company_date
    ON public.traffic_infractions(company_id, infraction_date DESC);

CREATE INDEX idx_traffic_infractions_vehicle
    ON public.traffic_infractions(vehicle_id, infraction_date DESC);

CREATE INDEX idx_traffic_infractions_driver
    ON public.traffic_infractions(driver_id)
    WHERE driver_id IS NOT NULL;

CREATE TRIGGER trg_traffic_infractions_updated_at
    BEFORE UPDATE ON public.traffic_infractions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.traffic_infractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY traffic_infractions_select ON public.traffic_infractions
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT public.auth_user_company_ids()));

CREATE POLICY traffic_infractions_insert ON public.traffic_infractions
    FOR INSERT TO authenticated
    WITH CHECK (company_id IN (SELECT public.auth_user_company_ids()));

CREATE POLICY traffic_infractions_update ON public.traffic_infractions
    FOR UPDATE TO authenticated
    USING (company_id IN (SELECT public.auth_user_company_ids()))
    WITH CHECK (company_id IN (SELECT public.auth_user_company_ids()));

CREATE POLICY traffic_infractions_delete ON public.traffic_infractions
    FOR DELETE TO authenticated
    USING (company_id IN (SELECT public.auth_user_company_ids()));
