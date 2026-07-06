-- GRX Management — Participação societária por veículo
-- Migration: 004_vehicle_ownership.sql
--
-- Refatora vehicle_ownership para o modelo correto:
--   Empresa → Veículo → Participação Societária → Sócio
--
-- O percentual de participação pertence ao veículo (N:N com sócios),
-- não ao cadastro do sócio.

-- ---------------------------------------------------------------------------
-- 1. Estrutura da tabela
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vehicle_ownership (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    vehicle_id              UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    partner_id              UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
    ownership_percentage    NUMERIC(5,2) NOT NULL
                            CHECK (ownership_percentage > 0 AND ownership_percentage <= 100),
    effective_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date                DATE,
    status                  TEXT NOT NULL DEFAULT 'Ativo'
                            CHECK (status IN ('Ativo', 'Inativo', 'Encerrado')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migra instalações que já executaram 001_schema.sql (estrutura anterior)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'vehicle_ownership'
          AND column_name = 'start_date'
    ) THEN
        ALTER TABLE public.vehicle_ownership
            RENAME COLUMN start_date TO effective_date;
    END IF;
END $$;

ALTER TABLE public.vehicle_ownership
    ALTER COLUMN effective_date SET DEFAULT CURRENT_DATE;

UPDATE public.vehicle_ownership
SET effective_date = CURRENT_DATE
WHERE effective_date IS NULL;

ALTER TABLE public.vehicle_ownership
    ALTER COLUMN effective_date SET NOT NULL;

-- Converte percentual de escala 0–1 (legado) para 0–100
DO $$
DECLARE
    v_max NUMERIC;
BEGIN
    SELECT MAX(ownership_percentage) INTO v_max
    FROM public.vehicle_ownership;

    IF v_max IS NOT NULL AND v_max <= 1 THEN
        UPDATE public.vehicle_ownership
        SET ownership_percentage = ROUND(ownership_percentage * 100, 2);
    END IF;
END $$;

ALTER TABLE public.vehicle_ownership
    DROP CONSTRAINT IF EXISTS vehicle_ownership_ownership_percentage_check;

ALTER TABLE public.vehicle_ownership
    ALTER COLUMN ownership_percentage TYPE NUMERIC(5,2)
    USING ROUND(ownership_percentage::numeric, 2);

ALTER TABLE public.vehicle_ownership
    ADD CONSTRAINT vehicle_ownership_ownership_percentage_check
        CHECK (ownership_percentage > 0 AND ownership_percentage <= 100);

ALTER TABLE public.vehicle_ownership
    DROP COLUMN IF EXISTS is_operational_responsible,
    DROP COLUMN IF EXISTS notes;

ALTER TABLE public.vehicle_ownership
    DROP CONSTRAINT IF EXISTS vehicle_ownership_company_id_vehicle_id_partner_id_start_date_key;

ALTER TABLE public.vehicle_ownership
    DROP CONSTRAINT IF EXISTS vehicle_ownership_company_id_vehicle_id_partner_id_effective_date_key;

ALTER TABLE public.vehicle_ownership
    ADD CONSTRAINT vehicle_ownership_company_id_vehicle_id_partner_id_effective_date_key
        UNIQUE (company_id, vehicle_id, partner_id, effective_date);

COMMENT ON TABLE public.vehicle_ownership IS
    'Participação societária percentual de sócios por veículo, com vigência e histórico.';

COMMENT ON COLUMN public.vehicle_ownership.ownership_percentage IS
    'Percentual de participação do sócio no veículo (0,01 a 100,00).';

COMMENT ON COLUMN public.vehicle_ownership.effective_date IS
    'Data de início da vigência da participação.';

COMMENT ON COLUMN public.vehicle_ownership.end_date IS
    'Data de encerramento da participação (NULL = vigente).';

CREATE INDEX IF NOT EXISTS idx_vehicle_ownership_company
    ON public.vehicle_ownership(company_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_ownership_vehicle
    ON public.vehicle_ownership(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_ownership_partner
    ON public.vehicle_ownership(partner_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_ownership_active
    ON public.vehicle_ownership(vehicle_id, status)
    WHERE status = 'Ativo';

-- ---------------------------------------------------------------------------
-- 2. Trigger de validação (soma ≤ 100%)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_ownership_percentage()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_total NUMERIC;
BEGIN
    SELECT COALESCE(SUM(ownership_percentage), 0)
    INTO v_total
    FROM public.vehicle_ownership
    WHERE vehicle_id = NEW.vehicle_id
      AND status = 'Ativo'
      AND id IS DISTINCT FROM NEW.id;

    IF NEW.status = 'Ativo' THEN
        v_total := v_total + NEW.ownership_percentage;
    END IF;

    IF v_total > 100.01 THEN
        RAISE EXCEPTION 'Soma de participação excede 100%% (atual: %%%)', round(v_total, 2);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vehicle_ownership_percentage ON public.vehicle_ownership;

CREATE TRIGGER trg_vehicle_ownership_percentage
    AFTER INSERT OR UPDATE ON public.vehicle_ownership
    FOR EACH ROW EXECUTE FUNCTION public.check_ownership_percentage();

DROP TRIGGER IF EXISTS trg_vehicle_ownership_updated_at ON public.vehicle_ownership;

CREATE TRIGGER trg_vehicle_ownership_updated_at
    BEFORE UPDATE ON public.vehicle_ownership
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. View analítica (percentual em escala 0–100)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.vw_ownership_base AS
SELECT
    vo.company_id,
    p.id AS partner_id,
    p.name AS partner_name,
    v.id AS vehicle_id,
    v.plate,
    vo.ownership_percentage,
    vt.realized_revenue + vt.projected_revenue AS total_revenue,
    vt.realized_expense + vt.projected_expense AS total_expense,
    (vt.realized_revenue + vt.projected_revenue)
        - (vt.realized_expense + vt.projected_expense) AS total_result,
    (vt.realized_revenue + vt.projected_revenue)
        * (vo.ownership_percentage / 100) AS attributed_revenue,
    (vt.realized_expense + vt.projected_expense)
        * (vo.ownership_percentage / 100) AS attributed_expense,
    ((vt.realized_revenue + vt.projected_revenue) - (vt.realized_expense + vt.projected_expense))
        * (vo.ownership_percentage / 100) AS attributed_result
FROM public.vehicle_ownership vo
INNER JOIN public.partners p ON p.id = vo.partner_id AND p.deleted_at IS NULL
INNER JOIN public.vehicles v ON v.id = vo.vehicle_id AND v.deleted_at IS NULL
INNER JOIN public.vw_vehicle_financial_totals vt ON vt.vehicle_id = v.id
WHERE vo.status = 'Ativo';

COMMENT ON VIEW public.vw_ownership_base IS
    'Resultado financeiro atribuído por sócio e veículo (participação em %).';

-- ---------------------------------------------------------------------------
-- 4. RLS (caso 002 ainda não tenha sido executado)
-- ---------------------------------------------------------------------------

ALTER TABLE public.vehicle_ownership ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'vehicle_ownership'
          AND policyname = 'vehicle_ownership_select'
    ) THEN
        PERFORM public.create_company_scoped_policies('vehicle_ownership');
    END IF;
EXCEPTION
    WHEN undefined_function THEN
        NULL;
END $$;
