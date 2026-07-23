-- Aplicar no SQL Editor do Supabase (produção e desenvolvimento)
-- Fase 2 auditoria: pedidos de exclusão, restauração hard e fila de alertas
-- Migration: supabase/migrations/055_deletion_approval_hard_restore_alerts.sql

-- ---------------------------------------------------------------------------
-- Pedidos de exclusão (aprovação)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deletion_approval_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  entity_type       TEXT NOT NULL,
  entity_id         TEXT NOT NULL,
  entity_code       TEXT,
  summary           TEXT,
  screen_key        TEXT,
  delete_mode       TEXT NOT NULL CHECK (delete_mode IN ('soft', 'hard')),
  reason            TEXT NOT NULL,
  reason_code       TEXT,
  payload_json      JSONB,
  requested_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_by_name TEXT,
  requested_by_email TEXT,
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by_name  TEXT,
  reviewed_by_email TEXT,
  reviewed_at       TIMESTAMPTZ,
  review_note       TEXT,
  audit_event_id    UUID REFERENCES public.deletion_audit_events(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deletion_approval_company_status
  ON public.deletion_approval_requests (company_id, status, requested_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_deletion_approval_pending_entity
  ON public.deletion_approval_requests (company_id, entity_type, entity_id)
  WHERE status = 'pending';

ALTER TABLE public.deletion_approval_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deletion_approval_select ON public.deletion_approval_requests;
CREATE POLICY deletion_approval_select ON public.deletion_approval_requests
  FOR SELECT TO authenticated
  USING (
    public.auth_user_has_company(company_id)
    AND (
      public.auth_user_is_company_admin(company_id)
      OR requested_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS deletion_approval_insert ON public.deletion_approval_requests;
CREATE POLICY deletion_approval_insert ON public.deletion_approval_requests
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_has_company(company_id));

DROP POLICY IF EXISTS deletion_approval_update ON public.deletion_approval_requests;
CREATE POLICY deletion_approval_update ON public.deletion_approval_requests
  FOR UPDATE TO authenticated
  USING (public.auth_user_is_company_admin(company_id))
  WITH CHECK (public.auth_user_is_company_admin(company_id));

COMMENT ON TABLE public.deletion_approval_requests IS
  'Pedidos de exclusão crítica aguardando aprovação do administrador.';

-- ---------------------------------------------------------------------------
-- Alertas / outbox (in-app + e-mail)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deletion_alert_outbox (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  alert_type      TEXT NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  entity_type     TEXT,
  entity_id       TEXT,
  meta_json       JSONB,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email_status    TEXT NOT NULL DEFAULT 'pending'
                  CHECK (email_status IN ('pending', 'sent', 'skipped', 'failed')),
  email_error     TEXT,
  emailed_at      TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  read_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_deletion_alert_company_created
  ON public.deletion_alert_outbox (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deletion_alert_unread
  ON public.deletion_alert_outbox (company_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.deletion_alert_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deletion_alert_select ON public.deletion_alert_outbox;
CREATE POLICY deletion_alert_select ON public.deletion_alert_outbox
  FOR SELECT TO authenticated
  USING (public.auth_user_is_company_admin(company_id));

DROP POLICY IF EXISTS deletion_alert_insert ON public.deletion_alert_outbox;
CREATE POLICY deletion_alert_insert ON public.deletion_alert_outbox
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_has_company(company_id));

DROP POLICY IF EXISTS deletion_alert_update ON public.deletion_alert_outbox;
CREATE POLICY deletion_alert_update ON public.deletion_alert_outbox
  FOR UPDATE TO authenticated
  USING (public.auth_user_is_company_admin(company_id))
  WITH CHECK (public.auth_user_is_company_admin(company_id));

COMMENT ON TABLE public.deletion_alert_outbox IS
  'Alertas de auditoria (banner in-app + fila de e-mail para admins).';

-- ---------------------------------------------------------------------------
-- Restauração unificada (soft + hard via snapshot)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_deleted_from_audit(
  p_event_id UUID,
  p_restoration_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.deletion_audit_events%ROWTYPE;
  v_reason TEXT := btrim(COALESCE(p_restoration_reason, ''));
  v_actor UUID := auth.uid();
  v_name TEXT;
  v_email TEXT;
  v_updated INT := 0;
  v_entity_uuid UUID;
  v_payload JSONB;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF char_length(v_reason) < 8 THEN
    RAISE EXCEPTION 'Informe um motivo de restauração com pelo menos 8 caracteres.';
  END IF;

  SELECT * INTO v_event
  FROM public.deletion_audit_events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento de exclusão não encontrado.';
  END IF;

  IF NOT public.auth_user_is_company_admin(v_event.company_id) THEN
    RAISE EXCEPTION 'Somente administrador da empresa pode restaurar.';
  END IF;

  IF v_event.restored IS TRUE THEN
    RAISE EXCEPTION 'Este registro já foi restaurado.';
  END IF;

  SELECT
    COALESCE(
      NULLIF(btrim(COALESCE(u.raw_user_meta_data->>'full_name', '')), ''),
      NULLIF(btrim(COALESCE(u.raw_user_meta_data->>'name', '')), ''),
      split_part(COALESCE(u.email, ''), '@', 1),
      u.email
    ),
    u.email
  INTO v_name, v_email
  FROM auth.users u
  WHERE u.id = v_actor;

  BEGIN
    v_entity_uuid := v_event.entity_id::uuid;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'ID do registro inválido para restauração.';
  END;

  IF v_event.delete_mode = 'soft' THEN
    IF v_event.entity_type = 'clients' THEN
      UPDATE public.clients SET deleted_at = NULL
      WHERE id = v_entity_uuid AND company_id = v_event.company_id AND deleted_at IS NOT NULL;
      GET DIAGNOSTICS v_updated = ROW_COUNT;
    ELSIF v_event.entity_type = 'suppliers' THEN
      UPDATE public.suppliers SET deleted_at = NULL
      WHERE id = v_entity_uuid AND company_id = v_event.company_id AND deleted_at IS NOT NULL;
      GET DIAGNOSTICS v_updated = ROW_COUNT;
    ELSIF v_event.entity_type = 'vehicles' THEN
      UPDATE public.vehicles SET deleted_at = NULL
      WHERE id = v_entity_uuid AND company_id = v_event.company_id AND deleted_at IS NOT NULL;
      GET DIAGNOSTICS v_updated = ROW_COUNT;
    ELSIF v_event.entity_type = 'drivers' THEN
      UPDATE public.drivers SET deleted_at = NULL
      WHERE id = v_entity_uuid AND company_id = v_event.company_id AND deleted_at IS NOT NULL;
      GET DIAGNOSTICS v_updated = ROW_COUNT;
    ELSIF v_event.entity_type = 'partners' THEN
      UPDATE public.partners
      SET deleted_at = NULL, status = 'Ativo'
      WHERE id = v_entity_uuid
        AND company_id = v_event.company_id
        AND (deleted_at IS NOT NULL OR status IS DISTINCT FROM 'Ativo');
      GET DIAGNOSTICS v_updated = ROW_COUNT;
    ELSE
      RAISE EXCEPTION 'Tipo soft "%" não é restaurável automaticamente.', v_event.entity_type;
    END IF;

    IF v_updated = 0 THEN
      RAISE EXCEPTION 'Registro não encontrado como excluído (já ativo ou apagado em definitivo).';
    END IF;
  ELSIF v_event.delete_mode = 'hard' THEN
    v_payload := COALESCE(v_event.payload_json, '{}'::jsonb)
      - '__deletion_reason'
      - '__deletion_reason_code';

    IF v_payload = '{}'::jsonb OR NOT (v_payload ? 'id') THEN
      RAISE EXCEPTION 'Snapshot indisponível para restauração hard.';
    END IF;

    -- Garante isolamento multiempresa
    v_payload := jsonb_set(v_payload, '{company_id}', to_jsonb(v_event.company_id));
    v_payload := jsonb_set(v_payload, '{id}', to_jsonb(v_entity_uuid));

    IF v_event.entity_type = 'financial_transactions' THEN
      INSERT INTO public.financial_transactions
      SELECT * FROM jsonb_populate_record(NULL::public.financial_transactions, v_payload);
    ELSIF v_event.entity_type = 'vehicle_ownership' THEN
      INSERT INTO public.vehicle_ownership
      SELECT * FROM jsonb_populate_record(NULL::public.vehicle_ownership, v_payload);
    ELSIF v_event.entity_type = 'traffic_infractions' THEN
      INSERT INTO public.traffic_infractions
      SELECT * FROM jsonb_populate_record(NULL::public.traffic_infractions, v_payload);
    ELSIF v_event.entity_type = 'service_orders' THEN
      INSERT INTO public.service_orders
      SELECT * FROM jsonb_populate_record(NULL::public.service_orders, v_payload);
    ELSE
      RAISE EXCEPTION 'Tipo hard "%" não é restaurável automaticamente.', v_event.entity_type;
    END IF;
  ELSE
    RAISE EXCEPTION 'Modo de exclusão inválido.';
  END IF;

  UPDATE public.deletion_audit_events
  SET
    restored = true,
    restored_at = NOW(),
    restored_by = v_actor,
    restored_by_name = v_name,
    restored_by_email = v_email,
    restoration_reason = v_reason
  WHERE id = v_event.id;

  RETURN jsonb_build_object(
    'ok', true,
    'event_id', v_event.id,
    'entity_type', v_event.entity_type,
    'entity_id', v_event.entity_id,
    'delete_mode', v_event.delete_mode,
    'restored_at', NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.restore_deleted_from_audit(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_deleted_from_audit(UUID, TEXT) TO authenticated;

-- Compat: mantém o nome antigo apontando para a nova função
CREATE OR REPLACE FUNCTION public.restore_soft_deleted_from_audit(
  p_event_id UUID,
  p_restoration_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.restore_deleted_from_audit(p_event_id, p_restoration_reason);
END;
$$;

REVOKE ALL ON FUNCTION public.restore_soft_deleted_from_audit(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_soft_deleted_from_audit(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.restore_deleted_from_audit(UUID, TEXT) IS
  'Restaura soft (reativa) ou hard (reinsere snapshot) e marca o evento de auditoria.';
