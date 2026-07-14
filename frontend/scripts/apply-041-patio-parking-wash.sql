-- Aplicar no SQL Editor do Supabase (produção / desenvolvimento)
-- Equivalente: supabase/migrations/041_patio_parking_wash.sql

-- Estacionamento + Lava-rápido: portes, tabela de preços, car_wash, evolução parking_entries
-- Migration: 041_patio_parking_wash.sql

-- ---------------------------------------------------------------------------
-- Portes / tipos de veículo (pátio e lava)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patio_vehicle_types (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    usage_category  TEXT NOT NULL DEFAULT 'Estacionamento/Lava Rápido'
                    CHECK (usage_category IN (
                      'Estacionamento/Lava Rápido',
                      'Estacionamento',
                      'Lava Rápido'
                    )),
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, code),
    UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_patio_vehicle_types_company
  ON public.patio_vehicle_types (company_id, is_active, sort_order);

-- ---------------------------------------------------------------------------
-- Tabela de preços com vigência
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patio_price_tables (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code              TEXT NOT NULL,
    modality          TEXT NOT NULL
                      CHECK (modality IN ('Estacionamento', 'Lava Rápido')),
    vehicle_type_id   UUID NOT NULL REFERENCES public.patio_vehicle_types(id) ON DELETE RESTRICT,
    service_name      TEXT NOT NULL,
    price             NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    billing_unit      TEXT NOT NULL DEFAULT 'Diária'
                      CHECK (billing_unit IN ('Diária', 'Mensal', 'Serviço', 'Hora')),
    valid_from        DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until       DATE,
    status            TEXT NOT NULL DEFAULT 'Ativo'
                      CHECK (status IN ('Ativo', 'Inativo')),
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, code),
    CONSTRAINT chk_patio_price_valid_range CHECK (
      valid_until IS NULL OR valid_until >= valid_from
    )
);

CREATE INDEX IF NOT EXISTS idx_patio_price_lookup
  ON public.patio_price_tables (
    company_id, modality, vehicle_type_id, service_name, status, valid_from DESC
  );

-- ---------------------------------------------------------------------------
-- Estacionamento (evolui parking_entries)
-- ---------------------------------------------------------------------------
ALTER TABLE public.parking_entries
  ADD COLUMN IF NOT EXISTS vehicle_type_id UUID REFERENCES public.patio_vehicle_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS billing_mode TEXT DEFAULT 'Diária'
    CHECK (billing_mode IS NULL OR billing_mode IN ('Diária', 'Mensal')),
  ADD COLUMN IF NOT EXISTS financial_transaction_id UUID
    REFERENCES public.financial_transactions(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.parking_entries.billing_mode IS
  'Diária (calcula por dias) ou Mensal (valor fixo da tabela).';

-- ---------------------------------------------------------------------------
-- Lava-rápido
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.car_wash_services (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id                  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id                   UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    code                        TEXT NOT NULL,
    service_date                DATE NOT NULL DEFAULT CURRENT_DATE,
    plate                       TEXT NOT NULL,
    brand                       TEXT,
    model                       TEXT,
    year                        INTEGER CHECK (year IS NULL OR year BETWEEN 1900 AND 2100),
    vehicle_type_id             UUID REFERENCES public.patio_vehicle_types(id) ON DELETE SET NULL,
    vehicle_type                TEXT,
    client_name                 TEXT,
    phone                       TEXT,
    service_name                TEXT NOT NULL,
    service_amount              NUMERIC(12,2) CHECK (service_amount IS NULL OR service_amount >= 0),
    status                      TEXT NOT NULL DEFAULT 'Aberto'
                                CHECK (status IN ('Aberto', 'Concluido', 'Cancelado')),
    entry_date                  DATE,
    entry_time                  TIME,
    exit_date                   DATE,
    exit_time                   TIME,
    attendant                   TEXT,
    payment_method              TEXT,
    notes                       TEXT,
    financial_transaction_id    UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_car_wash_company_status
  ON public.car_wash_services (company_id, status, service_date DESC);

-- ---------------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_patio_vehicle_types_updated_at ON public.patio_vehicle_types;
CREATE TRIGGER trg_patio_vehicle_types_updated_at
  BEFORE UPDATE ON public.patio_vehicle_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_patio_price_tables_updated_at ON public.patio_price_tables;
CREATE TRIGGER trg_patio_price_tables_updated_at
  BEFORE UPDATE ON public.patio_price_tables
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_car_wash_services_updated_at ON public.car_wash_services;
CREATE TRIGGER trg_car_wash_services_updated_at
  BEFORE UPDATE ON public.car_wash_services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.patio_vehicle_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patio_price_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_wash_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patio_vehicle_types_all ON public.patio_vehicle_types;
CREATE POLICY patio_vehicle_types_all ON public.patio_vehicle_types
  FOR ALL USING (public.auth_user_has_company(company_id))
  WITH CHECK (public.auth_user_has_company(company_id));

DROP POLICY IF EXISTS patio_price_tables_all ON public.patio_price_tables;
CREATE POLICY patio_price_tables_all ON public.patio_price_tables
  FOR ALL USING (public.auth_user_has_company(company_id))
  WITH CHECK (public.auth_user_has_company(company_id));

DROP POLICY IF EXISTS car_wash_services_all ON public.car_wash_services;
CREATE POLICY car_wash_services_all ON public.car_wash_services
  FOR ALL USING (public.auth_user_has_company(company_id))
  WITH CHECK (public.auth_user_has_company(company_id));

-- ---------------------------------------------------------------------------
-- Contas DRE + seed por empresa
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_patio_dre_accounts(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.chart_of_accounts (company_id, name, classification, transaction_type, status)
  VALUES
    (p_company_id, 'Receita Estacionamento', 'Receitas', 'Receita', 'Ativo'),
    (p_company_id, 'Receita Lava Rápido', 'Receitas', 'Receita', 'Ativo')
  ON CONFLICT (company_id, name) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_patio_defaults(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pequeno UUID;
  v_medio UUID;
  v_grande UUID;
  v_util UUID;
  v_cam UUID;
  v_micro UUID;
BEGIN
  PERFORM public.ensure_patio_dre_accounts(p_company_id);

  INSERT INTO public.patio_vehicle_types (company_id, code, name, usage_category, description, sort_order)
  VALUES
    (p_company_id, 'TV001', 'Carro Pequeno', 'Estacionamento/Lava Rápido', 'Hatch ou compacto', 1),
    (p_company_id, 'TV002', 'Carro Médio', 'Estacionamento/Lava Rápido', 'Sedan, SUV compacto', 2),
    (p_company_id, 'TV003', 'Carro Grande', 'Estacionamento/Lava Rápido', 'SUV grande / caminhonete', 3),
    (p_company_id, 'TV004', 'Utilitário', 'Estacionamento/Lava Rápido', 'Van, furgão', 4),
    (p_company_id, 'TV005', 'Caminhão', 'Estacionamento', 'Caminhão', 5),
    (p_company_id, 'TV006', 'Micro-ônibus', 'Estacionamento', 'Passageiros', 6)
  ON CONFLICT (company_id, code) DO NOTHING;

  SELECT id INTO v_pequeno FROM public.patio_vehicle_types WHERE company_id = p_company_id AND code = 'TV001';
  SELECT id INTO v_medio FROM public.patio_vehicle_types WHERE company_id = p_company_id AND code = 'TV002';
  SELECT id INTO v_grande FROM public.patio_vehicle_types WHERE company_id = p_company_id AND code = 'TV003';
  SELECT id INTO v_util FROM public.patio_vehicle_types WHERE company_id = p_company_id AND code = 'TV004';
  SELECT id INTO v_cam FROM public.patio_vehicle_types WHERE company_id = p_company_id AND code = 'TV005';
  SELECT id INTO v_micro FROM public.patio_vehicle_types WHERE company_id = p_company_id AND code = 'TV006';

  -- Só semeia preços se a empresa ainda não tiver nenhum
  IF EXISTS (SELECT 1 FROM public.patio_price_tables WHERE company_id = p_company_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.patio_price_tables
    (company_id, code, modality, vehicle_type_id, service_name, price, billing_unit, valid_from, status)
  VALUES
    -- Diárias estacionamento
    (p_company_id, 'PR001', 'Estacionamento', v_pequeno, 'Diária Estacionamento', 25, 'Diária', CURRENT_DATE, 'Ativo'),
    (p_company_id, 'PR002', 'Estacionamento', v_medio, 'Diária Estacionamento', 30, 'Diária', CURRENT_DATE, 'Ativo'),
    (p_company_id, 'PR003', 'Estacionamento', v_grande, 'Diária Estacionamento', 40, 'Diária', CURRENT_DATE, 'Ativo'),
    (p_company_id, 'PR004', 'Estacionamento', v_util, 'Diária Estacionamento', 50, 'Diária', CURRENT_DATE, 'Ativo'),
    (p_company_id, 'PR005', 'Estacionamento', v_cam, 'Diária Estacionamento', 80, 'Diária', CURRENT_DATE, 'Ativo'),
    (p_company_id, 'PR006', 'Estacionamento', v_micro, 'Diária Estacionamento', 70, 'Diária', CURRENT_DATE, 'Ativo'),
    -- Mensal estacionamento (completar valores reais nos Parâmetros)
    (p_company_id, 'PR007', 'Estacionamento', v_pequeno, 'Mensalidade Estacionamento', 400, 'Mensal', CURRENT_DATE, 'Ativo'),
    (p_company_id, 'PR008', 'Estacionamento', v_medio, 'Mensalidade Estacionamento', 500, 'Mensal', CURRENT_DATE, 'Ativo'),
    (p_company_id, 'PR009', 'Estacionamento', v_grande, 'Mensalidade Estacionamento', 650, 'Mensal', CURRENT_DATE, 'Ativo'),
    (p_company_id, 'PR010', 'Estacionamento', v_util, 'Mensalidade Estacionamento', 800, 'Mensal', CURRENT_DATE, 'Ativo'),
    -- Lava simples / completa P M G + utilitário
    (p_company_id, 'PR011', 'Lava Rápido', v_pequeno, 'Lavagem Simples', 35, 'Serviço', CURRENT_DATE, 'Ativo'),
    (p_company_id, 'PR012', 'Lava Rápido', v_medio, 'Lavagem Simples', 45, 'Serviço', CURRENT_DATE, 'Ativo'),
    (p_company_id, 'PR013', 'Lava Rápido', v_grande, 'Lavagem Simples', 55, 'Serviço', CURRENT_DATE, 'Ativo'),
    (p_company_id, 'PR014', 'Lava Rápido', v_util, 'Lavagem Simples', 70, 'Serviço', CURRENT_DATE, 'Ativo'),
    (p_company_id, 'PR015', 'Lava Rápido', v_pequeno, 'Lavagem Completa', 55, 'Serviço', CURRENT_DATE, 'Ativo'),
    (p_company_id, 'PR016', 'Lava Rápido', v_medio, 'Lavagem Completa', 70, 'Serviço', CURRENT_DATE, 'Ativo'),
    (p_company_id, 'PR017', 'Lava Rápido', v_grande, 'Lavagem Completa', 85, 'Serviço', CURRENT_DATE, 'Ativo'),
    (p_company_id, 'PR018', 'Lava Rápido', v_util, 'Lavagem Completa', 90, 'Serviço', CURRENT_DATE, 'Ativo');
END;
$$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.companies LOOP
    PERFORM public.seed_patio_defaults(r.id);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_patio_dre_accounts(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.seed_patio_defaults(UUID) TO authenticated, service_role;
