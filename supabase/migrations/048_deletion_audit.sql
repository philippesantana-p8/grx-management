-- GRX Management — Log imutável de exclusões (auditoria)
-- Migration: 048_deletion_audit.sql

CREATE OR REPLACE FUNCTION public.auth_user_is_company_admin(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_members m
    WHERE m.user_id = auth.uid()
      AND m.company_id = p_company_id
      AND m.role = 'admin'
  );
$$;

COMMENT ON FUNCTION public.auth_user_is_company_admin(UUID) IS
  'True se o usuário autenticado for admin da empresa.';

CREATE TABLE IF NOT EXISTS public.deletion_audit_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_name      TEXT,
    actor_email     TEXT,
    screen_key      TEXT,
    entity_type     TEXT NOT NULL,
    entity_id       TEXT NOT NULL,
    entity_code     TEXT,
    summary         TEXT,
    delete_mode     TEXT NOT NULL CHECK (delete_mode IN ('soft', 'hard')),
    payload_json    JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.deletion_audit_events IS
  'Histórico de exclusões: quem, quando, o quê. Somente insert; consulta admin.';

CREATE INDEX IF NOT EXISTS idx_deletion_audit_company_occurred
  ON public.deletion_audit_events (company_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_deletion_audit_entity
  ON public.deletion_audit_events (company_id, entity_type, entity_id);

ALTER TABLE public.deletion_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deletion_audit_events_select ON public.deletion_audit_events;
CREATE POLICY deletion_audit_events_select ON public.deletion_audit_events
  FOR SELECT
  USING (public.auth_user_is_company_admin(company_id));

DROP POLICY IF EXISTS deletion_audit_events_insert ON public.deletion_audit_events;
CREATE POLICY deletion_audit_events_insert ON public.deletion_audit_events
  FOR INSERT
  WITH CHECK (public.auth_user_has_company(company_id));

-- Sem UPDATE/DELETE — log imutável via RLS (nenhuma policy).
