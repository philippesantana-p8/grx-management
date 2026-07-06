-- GRX Management — Auth, profiles e Row Level Security
-- Migration: 002_auth_rls.sql
-- Executar após 001_schema.sql

-- ---------------------------------------------------------------------------
-- PROFILES E MEMBROS
-- ---------------------------------------------------------------------------

CREATE TABLE public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   TEXT,
    email       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'Perfil complementar do usuário autenticado.';

CREATE TABLE public.company_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'admin'
                CHECK (role IN ('admin', 'financeiro', 'operacional', 'socio')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, user_id)
);

COMMENT ON TABLE public.company_members IS 'Vínculo usuário ↔ empresa ↔ papel de acesso.';

CREATE INDEX idx_company_members_user ON public.company_members(user_id);
CREATE INDEX idx_company_members_company ON public.company_members(company_id);

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- AUTH — profile automático no registro
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
        NEW.email
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- HELPERS RLS
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auth_user_company_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT company_id
    FROM public.company_members
    WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.auth_user_has_company(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.company_members
        WHERE user_id = auth.uid()
          AND company_id = p_company_id
    );
$$;

-- ---------------------------------------------------------------------------
-- HABILITAR RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_ownership ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_flow_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parking_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- POLICIES — profiles e members
-- ---------------------------------------------------------------------------

CREATE POLICY profiles_select_own ON public.profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

CREATE POLICY profiles_update_own ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY company_members_select_own ON public.company_members
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY company_members_insert_own ON public.company_members
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- POLICIES — companies
-- ---------------------------------------------------------------------------

CREATE POLICY companies_select_member ON public.companies
    FOR SELECT TO authenticated
    USING (id IN (SELECT public.auth_user_company_ids()));

CREATE POLICY companies_insert_authenticated ON public.companies
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY companies_update_member ON public.companies
    FOR UPDATE TO authenticated
    USING (id IN (SELECT public.auth_user_company_ids()))
    WITH CHECK (id IN (SELECT public.auth_user_company_ids()));

-- ---------------------------------------------------------------------------
-- MACRO: tabelas com company_id (sem soft delete)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_company_scoped_policies(p_table TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    EXECUTE format(
        'CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated
         USING (company_id IN (SELECT public.auth_user_company_ids()))',
        p_table || '_select', p_table
    );
    EXECUTE format(
        'CREATE POLICY %I_insert ON public.%I FOR INSERT TO authenticated
         WITH CHECK (company_id IN (SELECT public.auth_user_company_ids()))',
        p_table || '_insert', p_table
    );
    EXECUTE format(
        'CREATE POLICY %I_update ON public.%I FOR UPDATE TO authenticated
         USING (company_id IN (SELECT public.auth_user_company_ids()))
         WITH CHECK (company_id IN (SELECT public.auth_user_company_ids()))',
        p_table || '_update', p_table
    );
    EXECUTE format(
        'CREATE POLICY %I_delete ON public.%I FOR DELETE TO authenticated
         USING (company_id IN (SELECT public.auth_user_company_ids()))',
        p_table || '_delete', p_table
    );
END;
$$;

SELECT public.create_company_scoped_policies('branches');
SELECT public.create_company_scoped_policies('vehicle_ownership');
SELECT public.create_company_scoped_policies('chart_of_accounts');
SELECT public.create_company_scoped_policies('financial_transactions');
SELECT public.create_company_scoped_policies('cash_flow_entries');
SELECT public.create_company_scoped_policies('parking_entries');
SELECT public.create_company_scoped_policies('service_orders');
SELECT public.create_company_scoped_policies('vehicle_events');
SELECT public.create_company_scoped_policies('attachments');

-- ---------------------------------------------------------------------------
-- POLICIES — tabelas com soft delete
-- ---------------------------------------------------------------------------

CREATE POLICY partners_select ON public.partners
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT public.auth_user_company_ids()) AND deleted_at IS NULL);

CREATE POLICY partners_insert ON public.partners
    FOR INSERT TO authenticated
    WITH CHECK (company_id IN (SELECT public.auth_user_company_ids()));

CREATE POLICY partners_update ON public.partners
    FOR UPDATE TO authenticated
    USING (company_id IN (SELECT public.auth_user_company_ids()))
    WITH CHECK (company_id IN (SELECT public.auth_user_company_ids()));

CREATE POLICY partners_delete ON public.partners
    FOR DELETE TO authenticated
    USING (company_id IN (SELECT public.auth_user_company_ids()));

CREATE POLICY vehicles_select ON public.vehicles
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT public.auth_user_company_ids()) AND deleted_at IS NULL);

CREATE POLICY vehicles_insert ON public.vehicles
    FOR INSERT TO authenticated
    WITH CHECK (company_id IN (SELECT public.auth_user_company_ids()));

CREATE POLICY vehicles_update ON public.vehicles
    FOR UPDATE TO authenticated
    USING (company_id IN (SELECT public.auth_user_company_ids()))
    WITH CHECK (company_id IN (SELECT public.auth_user_company_ids()));

CREATE POLICY vehicles_delete ON public.vehicles
    FOR DELETE TO authenticated
    USING (company_id IN (SELECT public.auth_user_company_ids()));

CREATE POLICY drivers_select ON public.drivers
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT public.auth_user_company_ids()) AND deleted_at IS NULL);

CREATE POLICY drivers_insert ON public.drivers
    FOR INSERT TO authenticated
    WITH CHECK (company_id IN (SELECT public.auth_user_company_ids()));

CREATE POLICY drivers_update ON public.drivers
    FOR UPDATE TO authenticated
    USING (company_id IN (SELECT public.auth_user_company_ids()))
    WITH CHECK (company_id IN (SELECT public.auth_user_company_ids()));

CREATE POLICY drivers_delete ON public.drivers
    FOR DELETE TO authenticated
    USING (company_id IN (SELECT public.auth_user_company_ids()));

CREATE POLICY clients_select ON public.clients
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT public.auth_user_company_ids()) AND deleted_at IS NULL);

CREATE POLICY clients_insert ON public.clients
    FOR INSERT TO authenticated
    WITH CHECK (company_id IN (SELECT public.auth_user_company_ids()));

CREATE POLICY clients_update ON public.clients
    FOR UPDATE TO authenticated
    USING (company_id IN (SELECT public.auth_user_company_ids()))
    WITH CHECK (company_id IN (SELECT public.auth_user_company_ids()));

CREATE POLICY clients_delete ON public.clients
    FOR DELETE TO authenticated
    USING (company_id IN (SELECT public.auth_user_company_ids()));

CREATE POLICY suppliers_select ON public.suppliers
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT public.auth_user_company_ids()) AND deleted_at IS NULL);

CREATE POLICY suppliers_insert ON public.suppliers
    FOR INSERT TO authenticated
    WITH CHECK (company_id IN (SELECT public.auth_user_company_ids()));

CREATE POLICY suppliers_update ON public.suppliers
    FOR UPDATE TO authenticated
    USING (company_id IN (SELECT public.auth_user_company_ids()))
    WITH CHECK (company_id IN (SELECT public.auth_user_company_ids()));

CREATE POLICY suppliers_delete ON public.suppliers
    FOR DELETE TO authenticated
    USING (company_id IN (SELECT public.auth_user_company_ids()));

-- ---------------------------------------------------------------------------
-- Views — herdam RLS das tabelas base via security invoker (Postgres 15+)
-- ---------------------------------------------------------------------------

ALTER VIEW public.vw_vehicle_financial_totals SET (security_invoker = true);
ALTER VIEW public.vw_ownership_base SET (security_invoker = true);

-- ---------------------------------------------------------------------------
-- Revogar acesso anônimo às tabelas operacionais
-- ---------------------------------------------------------------------------

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.vw_vehicle_financial_totals TO authenticated;
GRANT SELECT ON public.vw_ownership_base TO authenticated;

-- Limpeza função auxiliar de policies
DROP FUNCTION public.create_company_scoped_policies(TEXT);
