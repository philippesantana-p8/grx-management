-- GRX Management — Placa espelhada do cadastro de veículos (somente frota cadastrada)
-- Migration: 012_traffic_infractions_plate.sql

ALTER TABLE public.traffic_infractions
    ADD COLUMN IF NOT EXISTS plate TEXT;

UPDATE public.traffic_infractions ti
SET plate = v.plate
FROM public.vehicles v
WHERE ti.vehicle_id = v.id
  AND (ti.plate IS NULL OR btrim(ti.plate) = '');

ALTER TABLE public.traffic_infractions
    ALTER COLUMN plate SET NOT NULL;

COMMENT ON COLUMN public.traffic_infractions.plate IS
    'Placa espelhada do veículo cadastrado — preenchida automaticamente a partir de vehicle_id.';

CREATE INDEX IF NOT EXISTS idx_traffic_infractions_plate
    ON public.traffic_infractions(company_id, plate);

CREATE OR REPLACE FUNCTION public.sync_traffic_infraction_plate()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_plate TEXT;
BEGIN
    IF NEW.vehicle_id IS NULL THEN
        RAISE EXCEPTION 'Infração exige veículo cadastrado na frota (vehicle_id obrigatório).';
    END IF;

    SELECT plate INTO v_plate
    FROM public.vehicles
    WHERE id = NEW.vehicle_id;

    IF v_plate IS NULL OR btrim(v_plate) = '' THEN
        RAISE EXCEPTION 'Veículo não encontrado no cadastro da frota.';
    END IF;

    NEW.plate := v_plate;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_traffic_infractions_sync_plate ON public.traffic_infractions;

CREATE TRIGGER trg_traffic_infractions_sync_plate
    BEFORE INSERT OR UPDATE OF vehicle_id ON public.traffic_infractions
    FOR EACH ROW EXECUTE FUNCTION public.sync_traffic_infraction_plate();
