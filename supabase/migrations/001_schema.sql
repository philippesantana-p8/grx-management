-- GRX Management — Schema V1
-- Migration: 001_schema.sql
-- PostgreSQL / Supabase

-- ---------------------------------------------------------------------------
-- Extensões
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Funções utilitárias
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_driver_name()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.name_normalized = lower(extensions.unaccent(trim(NEW.name)));
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_transaction_classification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_classification TEXT;
    v_transaction_type TEXT;
BEGIN
    SELECT classification, transaction_type
    INTO v_classification, v_transaction_type
    FROM public.chart_of_accounts
    WHERE id = NEW.chart_of_account_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conta do plano de contas não encontrada: %', NEW.chart_of_account_id;
    END IF;

    NEW.classification := v_classification;
    NEW.transaction_type := v_transaction_type;
    RETURN NEW;
END;
$$;

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

CREATE OR REPLACE FUNCTION public.ensure_single_default_branch()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.is_default IS TRUE THEN
        UPDATE public.branches
        SET is_default = FALSE, updated_at = NOW()
        WHERE company_id = NEW.company_id
          AND id IS DISTINCT FROM NEW.id
          AND is_default IS TRUE;
    END IF;
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- NÚCLEO
-- ---------------------------------------------------------------------------

CREATE TABLE public.companies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    trade_name  TEXT,
    document    TEXT,
    status      TEXT NOT NULL DEFAULT 'Ativo'
                CHECK (status IN ('Ativo', 'Inativo')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.companies IS 'Empresas clientes do sistema (multiempresa).';

CREATE TABLE public.branches (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code        TEXT NOT NULL,
    name        TEXT NOT NULL,
    address     TEXT,
    city        TEXT,
    phone       TEXT,
    is_default  BOOLEAN NOT NULL DEFAULT FALSE,
    status      TEXT NOT NULL DEFAULT 'Ativo'
                CHECK (status IN ('Ativo', 'Inativo')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, code)
);

COMMENT ON TABLE public.branches IS 'Unidades operacionais (filiais, pátios). Uso opcional na V1.';

CREATE INDEX idx_branches_company ON public.branches(company_id);

-- ---------------------------------------------------------------------------
-- CADASTROS
-- ---------------------------------------------------------------------------

CREATE TABLE public.partners (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code                TEXT NOT NULL,
    name                TEXT NOT NULL,
    partner_type        TEXT NOT NULL DEFAULT 'Socio'
                        CHECK (partner_type IN ('Socio', 'Parceira', 'Empresa')),
    status              TEXT NOT NULL DEFAULT 'Ativo'
                        CHECK (status IN ('Ativo', 'Inativo', 'Pendente', 'Encerrado')),
    use_in_allocation   BOOLEAN NOT NULL DEFAULT TRUE,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    UNIQUE (company_id, code),
    UNIQUE (company_id, name)
);

COMMENT ON TABLE public.partners IS 'Sócios, parceiros e entidade GRX para rateio societário.';

CREATE TABLE public.vehicles (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id               UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    code                    TEXT NOT NULL,
    plate                   TEXT NOT NULL,
    plate_display           TEXT,
    model                   TEXT,
    year                    INTEGER CHECK (year IS NULL OR year BETWEEN 1900 AND 2100),
    vehicle_category        TEXT NOT NULL DEFAULT 'Van'
                            CHECK (vehicle_category IN ('Van', 'Onibus', 'Caminhao', 'MicroOnibus', 'Outro')),
    operational_partner_id  UUID REFERENCES public.partners(id) ON DELETE SET NULL,
    insurance_due_date      DATE,
    ipva_due_date           DATE,
    licensing_due_date      DATE,
    tachograph_due_date     DATE,
    crlv_due_date           DATE,
    compliance_notes        TEXT,
    status                  TEXT NOT NULL DEFAULT 'Ativo'
                            CHECK (status IN ('Ativo', 'Inativo', 'Pendente', 'Encerrado')),
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ,
    UNIQUE (company_id, code),
    UNIQUE (company_id, plate)
);

COMMENT ON TABLE public.vehicles IS 'Frota por placa, com vencimentos de documentos incorporados na V1.';

CREATE INDEX idx_vehicles_company ON public.vehicles(company_id);
CREATE INDEX idx_vehicles_branch ON public.vehicles(branch_id);
CREATE INDEX idx_vehicles_compliance ON public.vehicles(company_id, insurance_due_date, ipva_due_date);

CREATE TABLE public.vehicle_ownership (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id                  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    vehicle_id                  UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    partner_id                  UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
    ownership_percentage        NUMERIC(5,2) NOT NULL
                                CHECK (ownership_percentage > 0 AND ownership_percentage <= 100),
    effective_date              DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date                    DATE,
    status                      TEXT NOT NULL DEFAULT 'Ativo'
                                CHECK (status IN ('Ativo', 'Inativo', 'Encerrado')),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, vehicle_id, partner_id, effective_date)
);

COMMENT ON TABLE public.vehicle_ownership IS 'Participação societária percentual de sócios por veículo, com vigência e histórico.';
COMMENT ON COLUMN public.vehicle_ownership.ownership_percentage IS 'Percentual de participação do sócio no veículo (0,01 a 100,00).';
COMMENT ON COLUMN public.vehicle_ownership.effective_date IS 'Data de início da vigência da participação.';
COMMENT ON COLUMN public.vehicle_ownership.end_date IS 'Data de encerramento da participação (NULL = vigente).';

CREATE INDEX idx_vehicle_ownership_company ON public.vehicle_ownership(company_id);
CREATE INDEX idx_vehicle_ownership_vehicle ON public.vehicle_ownership(vehicle_id);
CREATE INDEX idx_vehicle_ownership_partner ON public.vehicle_ownership(partner_id);
CREATE INDEX idx_vehicle_ownership_active ON public.vehicle_ownership(vehicle_id, status) WHERE status = 'Ativo';

CREATE TABLE public.chart_of_accounts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    classification      TEXT NOT NULL,
    transaction_type    TEXT NOT NULL
                        CHECK (transaction_type IN ('Receita', 'Despesa', 'Outros')),
    status              TEXT NOT NULL DEFAULT 'Ativo'
                        CHECK (status IN ('Ativo', 'Inativo')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, name)
);

COMMENT ON TABLE public.chart_of_accounts IS 'Plano de contas gerencial (ex-Contas DRE).';

CREATE INDEX idx_chart_of_accounts_company ON public.chart_of_accounts(company_id);

CREATE TABLE public.drivers (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code                    TEXT NOT NULL,
    name                    TEXT NOT NULL,
    name_normalized         TEXT NOT NULL DEFAULT '',
    driver_type             TEXT NOT NULL DEFAULT 'Motorista'
                            CHECK (driver_type IN ('Motorista', 'Empregado', 'Agregado', 'Terceiro', 'Prestador')),
    status                  TEXT NOT NULL DEFAULT 'Ativo'
                            CHECK (status IN ('Ativo', 'Inativo', 'Pendente', 'Encerrado')),
    phone                   TEXT,
    document                TEXT,
    cnh_number              TEXT,
    cnh_expiry_date         DATE,
    cnh_categories          TEXT[] NOT NULL DEFAULT '{}',
    active_for_operations   BOOLEAN NOT NULL DEFAULT TRUE,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ,
    UNIQUE (company_id, code)
);

COMMENT ON TABLE public.drivers IS 'Motoristas e agregados — cadastro único.';
COMMENT ON COLUMN public.drivers.cnh_number IS 'Número da CNH do motorista.';
COMMENT ON COLUMN public.drivers.cnh_expiry_date IS 'Data de vencimento da CNH.';
COMMENT ON COLUMN public.drivers.cnh_categories IS 'Categorias habilitadas na CNH (múltipla seleção).';

CREATE INDEX idx_drivers_company ON public.drivers(company_id);
CREATE INDEX idx_drivers_name_normalized ON public.drivers(company_id, name_normalized);
CREATE INDEX idx_drivers_cnh_expiry ON public.drivers(company_id, cnh_expiry_date)
    WHERE cnh_expiry_date IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE public.clients (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    document        TEXT,
    contact_name    TEXT,
    phone           TEXT,
    city            TEXT,
    status          TEXT NOT NULL DEFAULT 'Ativo'
                    CHECK (status IN ('Ativo', 'Inativo', 'Pendente', 'Encerrado')),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (company_id, code)
);

COMMENT ON TABLE public.clients IS 'Clientes que geram receita.';

CREATE TABLE public.suppliers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    category        TEXT NOT NULL DEFAULT 'Outros'
                    CHECK (category IN (
                        'Combustivel', 'Manutencao', 'Seguro', 'Documentacao',
                        'Pneus', 'RH', 'Financas', 'Outros'
                    )),
    document        TEXT,
    contact_name    TEXT,
    phone           TEXT,
    city            TEXT,
    status          TEXT NOT NULL DEFAULT 'Ativo'
                    CHECK (status IN ('Ativo', 'Inativo', 'Pendente', 'Encerrado')),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (company_id, code)
);

COMMENT ON TABLE public.suppliers IS 'Fornecedores de despesas.';

-- ---------------------------------------------------------------------------
-- FINANCEIRO
-- ---------------------------------------------------------------------------

CREATE TABLE public.financial_transactions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id               UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    transaction_date        DATE NOT NULL,
    amount                  NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    chart_of_account_id     UUID NOT NULL REFERENCES public.chart_of_accounts(id),
    classification          TEXT NOT NULL,
    transaction_type        TEXT NOT NULL
                            CHECK (transaction_type IN ('Receita', 'Despesa', 'Outros')),
    client_id               UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    supplier_id             UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    service_date            DATE,
    driver_id               UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
    operational_vehicle_id  UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    allocation_vehicle_id   UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    description             TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID,
    updated_by              UUID,
    CONSTRAINT chk_financial_transaction_party CHECK (
        (transaction_type = 'Receita' AND supplier_id IS NULL)
        OR (transaction_type = 'Despesa' AND client_id IS NULL)
        OR (transaction_type = 'Outros')
    )
);

COMMENT ON TABLE public.financial_transactions IS 'Lançamentos financeiros realizados.';
COMMENT ON COLUMN public.financial_transactions.operational_vehicle_id IS 'Van operacional (quem rodou).';
COMMENT ON COLUMN public.financial_transactions.allocation_vehicle_id IS 'Veículo do rateio societário.';

CREATE INDEX idx_financial_transactions_company_date
    ON public.financial_transactions(company_id, transaction_date DESC);
CREATE INDEX idx_financial_transactions_allocation
    ON public.financial_transactions(allocation_vehicle_id);
CREATE INDEX idx_financial_transactions_operational
    ON public.financial_transactions(operational_vehicle_id);
CREATE INDEX idx_financial_transactions_chart
    ON public.financial_transactions(chart_of_account_id);

CREATE TABLE public.cash_flow_entries (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id                  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    due_date                    DATE NOT NULL,
    amount                      NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    chart_of_account_id         UUID NOT NULL REFERENCES public.chart_of_accounts(id),
    classification              TEXT NOT NULL,
    transaction_type            TEXT NOT NULL
                                CHECK (transaction_type IN ('Receita', 'Despesa', 'Outros')),
    client_id                   UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    supplier_id                 UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    service_date                DATE,
    driver_id                   UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
    vehicle_id                  UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    description                 TEXT,
    status                      TEXT NOT NULL DEFAULT 'Projetado'
                                CHECK (status IN ('Projetado', 'Realizado', 'Cancelado')),
    realized_transaction_id     UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.cash_flow_entries IS 'Projeções e compromissos futuros (fluxo de caixa).';

CREATE INDEX idx_cash_flow_entries_company_date
    ON public.cash_flow_entries(company_id, due_date);
CREATE INDEX idx_cash_flow_entries_status
    ON public.cash_flow_entries(company_id, status);

-- ---------------------------------------------------------------------------
-- OPERACIONAL
-- ---------------------------------------------------------------------------

CREATE TABLE public.parking_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id       UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    code            TEXT NOT NULL,
    plate           TEXT NOT NULL,
    brand           TEXT,
    model           TEXT,
    year            INTEGER CHECK (year IS NULL OR year BETWEEN 1900 AND 2100),
    vehicle_type    TEXT,
    client_name     TEXT,
    phone           TEXT,
    entry_date      DATE NOT NULL,
    entry_time      TIME,
    exit_date       DATE,
    exit_time       TIME,
    daily_count     INTEGER CHECK (daily_count IS NULL OR daily_count >= 1),
    daily_rate      NUMERIC(12,2) CHECK (daily_rate IS NULL OR daily_rate >= 0),
    total_amount    NUMERIC(12,2) CHECK (total_amount IS NULL OR total_amount >= 0),
    status          TEXT NOT NULL DEFAULT 'Aberto'
                    CHECK (status IN ('Aberto', 'Finalizado', 'Cancelado')),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, code),
    CONSTRAINT chk_parking_exit_after_entry CHECK (
        exit_date IS NULL OR exit_date >= entry_date
    )
);

COMMENT ON TABLE public.parking_entries IS 'Entrada e saída de veículos no estacionamento.';

CREATE INDEX idx_parking_entries_company_status
    ON public.parking_entries(company_id, status);

CREATE TABLE public.service_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id       UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    code            TEXT NOT NULL,
    service_type    TEXT NOT NULL DEFAULT 'CarWash'
                    CHECK (service_type IN ('CarWash', 'Transporte', 'Outro')),
    service_date    DATE NOT NULL,
    plate           TEXT NOT NULL,
    brand           TEXT,
    model           TEXT,
    year            INTEGER CHECK (year IS NULL OR year BETWEEN 1900 AND 2100),
    vehicle_type    TEXT,
    client_name     TEXT,
    phone           TEXT,
    service_name    TEXT NOT NULL,
    service_amount  NUMERIC(12,2) CHECK (service_amount IS NULL OR service_amount >= 0),
    status          TEXT NOT NULL DEFAULT 'Aberto'
                    CHECK (status IN ('Aberto', 'Concluido', 'Cancelado')),
    entry_date      DATE,
    entry_time      TIME,
    exit_date       DATE,
    exit_time       TIME,
    attendant       TEXT,
    driver_id       UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
    payment_method  TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, code)
);

COMMENT ON TABLE public.service_orders IS 'Ordens de serviço (lava-rápido na V1).';

CREATE INDEX idx_service_orders_company_status
    ON public.service_orders(company_id, status);

-- ---------------------------------------------------------------------------
-- FROTA
-- ---------------------------------------------------------------------------

CREATE TABLE public.vehicle_events (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id                  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    vehicle_id                  UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    event_date                  DATE NOT NULL,
    event_type                  TEXT NOT NULL,
    odometer                    INTEGER CHECK (odometer IS NULL OR odometer >= 0),
    amount                      NUMERIC(12,2) CHECK (amount IS NULL OR amount >= 0),
    supplier_id                 UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    driver_id                   UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
    document_ref                TEXT,
    financial_transaction_id    UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
    status                      TEXT NOT NULL DEFAULT 'Pendente'
                                CHECK (status IN ('Pendente', 'Concluido', 'Cancelado')),
    notes                       TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.vehicle_events IS 'Histórico operacional da frota.';

CREATE INDEX idx_vehicle_events_vehicle ON public.vehicle_events(vehicle_id, event_date DESC);

-- ---------------------------------------------------------------------------
-- ANEXOS
-- ---------------------------------------------------------------------------

CREATE TABLE public.attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    entity_type     TEXT NOT NULL
                    CHECK (entity_type IN (
                        'branch', 'partner', 'vehicle', 'driver', 'client', 'supplier',
                        'financial_transaction', 'cash_flow_entry', 'parking_entry',
                        'service_order', 'vehicle_event'
                    )),
    entity_id       UUID NOT NULL,
    file_name       TEXT NOT NULL,
    storage_path    TEXT NOT NULL,
    mime_type       TEXT,
    file_size       BIGINT CHECK (file_size IS NULL OR file_size >= 0),
    description     TEXT,
    uploaded_by     UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.attachments IS 'Metadados de arquivos (Storage). Vínculo polimórfico por entity_type + entity_id.';

CREATE INDEX idx_attachments_entity ON public.attachments(entity_type, entity_id);
CREATE INDEX idx_attachments_company ON public.attachments(company_id);

-- ---------------------------------------------------------------------------
-- TRIGGERS — updated_at
-- ---------------------------------------------------------------------------

CREATE TRIGGER trg_companies_updated_at
    BEFORE UPDATE ON public.companies
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_branches_updated_at
    BEFORE UPDATE ON public.branches
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_partners_updated_at
    BEFORE UPDATE ON public.partners
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_vehicles_updated_at
    BEFORE UPDATE ON public.vehicles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_vehicle_ownership_updated_at
    BEFORE UPDATE ON public.vehicle_ownership
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_chart_of_accounts_updated_at
    BEFORE UPDATE ON public.chart_of_accounts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_drivers_updated_at
    BEFORE UPDATE ON public.drivers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_suppliers_updated_at
    BEFORE UPDATE ON public.suppliers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_financial_transactions_updated_at
    BEFORE UPDATE ON public.financial_transactions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_cash_flow_entries_updated_at
    BEFORE UPDATE ON public.cash_flow_entries
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_parking_entries_updated_at
    BEFORE UPDATE ON public.parking_entries
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_service_orders_updated_at
    BEFORE UPDATE ON public.service_orders
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_vehicle_events_updated_at
    BEFORE UPDATE ON public.vehicle_events
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- TRIGGERS — regras de negócio
-- ---------------------------------------------------------------------------

CREATE TRIGGER trg_drivers_normalize_name
    BEFORE INSERT OR UPDATE OF name ON public.drivers
    FOR EACH ROW EXECUTE FUNCTION public.normalize_driver_name();

CREATE TRIGGER trg_financial_transactions_classification
    BEFORE INSERT OR UPDATE OF chart_of_account_id ON public.financial_transactions
    FOR EACH ROW EXECUTE FUNCTION public.sync_transaction_classification();

CREATE TRIGGER trg_cash_flow_entries_classification
    BEFORE INSERT OR UPDATE OF chart_of_account_id ON public.cash_flow_entries
    FOR EACH ROW EXECUTE FUNCTION public.sync_transaction_classification();

CREATE TRIGGER trg_vehicle_ownership_percentage
    AFTER INSERT OR UPDATE ON public.vehicle_ownership
    FOR EACH ROW EXECUTE FUNCTION public.check_ownership_percentage();

CREATE TRIGGER trg_branches_single_default
    BEFORE INSERT OR UPDATE OF is_default ON public.branches
    FOR EACH ROW EXECUTE FUNCTION public.ensure_single_default_branch();

-- ---------------------------------------------------------------------------
-- VIEWS ANALÍTICAS
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.vw_vehicle_financial_totals AS
SELECT
    v.id AS vehicle_id,
    v.company_id,
    v.plate,
    COALESCE(SUM(CASE WHEN ft.transaction_type = 'Receita' THEN ft.amount ELSE 0 END), 0) AS realized_revenue,
    COALESCE(SUM(CASE WHEN ft.transaction_type = 'Despesa' THEN ft.amount ELSE 0 END), 0) AS realized_expense,
    COALESCE(SUM(
        CASE WHEN cf.transaction_type = 'Receita' AND cf.status = 'Projetado' THEN cf.amount ELSE 0 END
    ), 0) AS projected_revenue,
    COALESCE(SUM(
        CASE WHEN cf.transaction_type = 'Despesa' AND cf.status = 'Projetado' THEN cf.amount ELSE 0 END
    ), 0) AS projected_expense
FROM public.vehicles v
LEFT JOIN public.financial_transactions ft
    ON ft.allocation_vehicle_id = v.id
LEFT JOIN public.cash_flow_entries cf
    ON cf.vehicle_id = v.id
WHERE v.deleted_at IS NULL
GROUP BY v.id, v.company_id, v.plate;

COMMENT ON VIEW public.vw_vehicle_financial_totals IS 'Totais financeiros por veículo (realizado + projetado).';

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

COMMENT ON VIEW public.vw_ownership_base IS 'Resultado financeiro atribuído por sócio e veículo.';

-- ---------------------------------------------------------------------------
-- Permissões básicas (detalhadas em 002_auth_rls.sql)
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.vw_vehicle_financial_totals TO authenticated;
GRANT SELECT ON public.vw_ownership_base TO authenticated;
