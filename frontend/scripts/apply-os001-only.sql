-- Pré-requisitos + OS001 — seguro para reexecutar
-- Cole no Supabase SQL Editor → Run

-- 009 — motorista em OS
ALTER TABLE public.service_orders
    ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL;

-- 010 — veículo da frota em OS
ALTER TABLE public.service_orders
    ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_service_orders_vehicle
    ON public.service_orders(company_id, vehicle_id)
    WHERE vehicle_id IS NOT NULL;

-- 013–020 (caso ainda falte alguma coluna)
ALTER TABLE public.service_orders
    DROP CONSTRAINT IF EXISTS service_orders_service_type_check;

ALTER TABLE public.service_orders
    ADD CONSTRAINT service_orders_service_type_check
    CHECK (service_type IN ('Frete', 'Transporte', 'Estacionamento', 'CarWash', 'Outro'));

ALTER TABLE public.service_orders
    ADD COLUMN IF NOT EXISTS service_categories TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS chart_of_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.service_orders
    ADD COLUMN IF NOT EXISTS freight_origin_address TEXT,
    ADD COLUMN IF NOT EXISTS freight_destination_address TEXT,
    ADD COLUMN IF NOT EXISTS freight_distance_km NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS freight_toll_amount NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS freight_toll_count INTEGER,
    ADD COLUMN IF NOT EXISTS freight_toll_detail JSONB,
    ADD COLUMN IF NOT EXISTS freight_antt_cargo_type INTEGER,
    ADD COLUMN IF NOT EXISTS freight_antt_axles INTEGER,
    ADD COLUMN IF NOT EXISTS freight_antt_composicao_veicular BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS freight_antt_alto_desempenho BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS freight_antt_retorno_vazio BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS freight_antt_minimum NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS freight_antt_detail JSONB,
    ADD COLUMN IF NOT EXISTS freight_suggested_total NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS freight_agreed_amount NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS freight_travel_days INTEGER,
    ADD COLUMN IF NOT EXISTS freight_per_diem_detail JSONB,
    ADD COLUMN IF NOT EXISTS freight_per_diem_total NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS freight_per_diem_charge_to TEXT NOT NULL DEFAULT 'Cliente',
    ADD COLUMN IF NOT EXISTS freight_transport_km_rate NUMERIC(8,4);

ALTER TABLE public.vehicles
    ADD COLUMN IF NOT EXISTS axle_count INTEGER;

ALTER TABLE public.service_orders
    DROP CONSTRAINT IF EXISTS service_orders_status_check;

ALTER TABLE public.service_orders
    ADD CONSTRAINT service_orders_status_check
    CHECK (status IN ('Aberto', 'Aguardando aprovação cliente', 'Concluido', 'Cancelado'));

NOTIFY pgrst, 'reload schema';

-- ========== OS001 demo ==========

DO $$
DECLARE
    v_company_id UUID;
    v_vehicle RECORD;
    v_dre_id UUID;
BEGIN
    SELECT company_id INTO v_company_id
    FROM public.company_members
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Nenhuma empresa encontrada.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.service_orders
        WHERE company_id = v_company_id AND code = 'OS001'
    ) THEN
        RAISE NOTICE 'OS001 já existe — nada a inserir.';
        RETURN;
    END IF;

    SELECT id, plate, model, year, vehicle_category, axle_count
    INTO v_vehicle
    FROM public.vehicles
    WHERE company_id = v_company_id AND status = 'Ativo' AND deleted_at IS NULL
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_vehicle.id IS NULL THEN
        RAISE EXCEPTION 'Nenhum veículo ativo na frota.';
    END IF;

    SELECT id INTO v_dre_id
    FROM public.chart_of_accounts
    WHERE company_id = v_company_id AND name = 'Receita Caminhão'
    LIMIT 1;

    INSERT INTO public.service_orders (
        company_id, code, service_type, service_date, status,
        vehicle_id, plate, brand, model, year, vehicle_type,
        client_name, phone, service_categories, service_name, service_amount,
        chart_of_account_id,
        freight_origin_address, freight_destination_address, freight_distance_km,
        freight_toll_amount, freight_toll_count,
        freight_antt_cargo_type, freight_antt_composicao_veicular,
        freight_antt_alto_desempenho, freight_antt_retorno_vazio,
        freight_agreed_amount, freight_per_diem_charge_to, notes
    ) VALUES (
        v_company_id, 'OS001', 'Frete', CURRENT_DATE, 'Aberto',
        v_vehicle.id,
        UPPER(REPLACE(REPLACE(v_vehicle.plate, ' ', ''), '-', '')),
        NULL, v_vehicle.model, v_vehicle.year, v_vehicle.vehicle_category,
        'Distribuidora Atlântica Ltda (DEMO)', '(11) 98348-1803',
        ARRAY['Frete']::TEXT[], 'Frete', 6756,
        v_dre_id,
        'São Paulo, SP', 'Vitória, ES', 865.91,
        280.60, 7,
        5, TRUE, FALSE, FALSE,
        6756, 'Cliente',
        'OS fictícia para demonstração do PDF — São Paulo (SP) → Vitória (ES).'
    );
END $$;

SELECT id, code, service_type, client_name, freight_origin_address, freight_destination_address
FROM public.service_orders
WHERE code = 'OS001'
ORDER BY created_at DESC
LIMIT 1;
