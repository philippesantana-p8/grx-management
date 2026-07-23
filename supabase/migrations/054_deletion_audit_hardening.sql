-- Histórico de Exclusões — endurecimento de auditoria (snapshot / restauração / imutabilidade)
-- Aplicar também via: frontend/scripts/apply-054-deletion-audit-hardening.sql

ALTER TABLE public.deletion_audit_events
  ADD COLUMN IF NOT EXISTS reason_code TEXT;

ALTER TABLE public.deletion_audit_events
  ADD COLUMN IF NOT EXISTS restored BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.deletion_audit_events
  ADD COLUMN IF NOT EXISTS restored_at TIMESTAMPTZ;

ALTER TABLE public.deletion_audit_events
  ADD COLUMN IF NOT EXISTS restored_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.deletion_audit_events
  ADD COLUMN IF NOT EXISTS restored_by_name TEXT;

ALTER TABLE public.deletion_audit_events
  ADD COLUMN IF NOT EXISTS restored_by_email TEXT;

ALTER TABLE public.deletion_audit_events
  ADD COLUMN IF NOT EXISTS restoration_reason TEXT;

COMMENT ON COLUMN public.deletion_audit_events.reason_code IS
  'Código padronizado do motivo (duplicidade, cadastro_incorreto, outro, …).';

COMMENT ON COLUMN public.deletion_audit_events.payload_json IS
  'Snapshot do registro no momento da exclusão (imutável).';

COMMENT ON COLUMN public.deletion_audit_events.restored IS
  'True quando o registro soft-deleted foi reativado; o evento de auditoria permanece.';

CREATE INDEX IF NOT EXISTS idx_deletion_audit_restored
  ON public.deletion_audit_events (company_id, restored, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_deletion_audit_reason_code
  ON public.deletion_audit_events (company_id, reason_code);

CREATE INDEX IF NOT EXISTS idx_deletion_audit_actor
  ON public.deletion_audit_events (company_id, actor_user_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION public.trg_deletion_audit_events_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Histórico de exclusões é imutável e não pode ser apagado.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.restored IS TRUE THEN
      RAISE EXCEPTION 'Evento de exclusão já restaurado; histórico imutável.';
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.company_id IS DISTINCT FROM OLD.company_id
      OR NEW.occurred_at IS DISTINCT FROM OLD.occurred_at
      OR NEW.actor_user_id IS DISTINCT FROM OLD.actor_user_id
      OR NEW.actor_name IS DISTINCT FROM OLD.actor_name
      OR NEW.actor_email IS DISTINCT FROM OLD.actor_email
      OR NEW.screen_key IS DISTINCT FROM OLD.screen_key
      OR NEW.entity_type IS DISTINCT FROM OLD.entity_type
      OR NEW.entity_id IS DISTINCT FROM OLD.entity_id
      OR NEW.entity_code IS DISTINCT FROM OLD.entity_code
      OR NEW.summary IS DISTINCT FROM OLD.summary
      OR NEW.reason IS DISTINCT FROM OLD.reason
      OR NEW.reason_code IS DISTINCT FROM OLD.reason_code
      OR NEW.delete_mode IS DISTINCT FROM OLD.delete_mode
      OR NEW.payload_json IS DISTINCT FROM OLD.payload_json
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Campos de auditoria de exclusão são imutáveis.';
    END IF;

    IF NEW.restored IS NOT TRUE THEN
      RAISE EXCEPTION 'Única alteração permitida no histórico é registrar restauração.';
    END IF;

    IF NEW.restored_at IS NULL OR NULLIF(btrim(COALESCE(NEW.restoration_reason, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Restauração exige data e motivo.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deletion_audit_events_immutable ON public.deletion_audit_events;
CREATE TRIGGER deletion_audit_events_immutable
  BEFORE UPDATE OR DELETE ON public.deletion_audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_deletion_audit_events_immutable();

CREATE OR REPLACE FUNCTION public.restore_soft_deleted_from_audit(
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

  IF v_event.delete_mode <> 'soft' THEN
    RAISE EXCEPTION 'Exclusão definitiva (hard) não pode ser restaurada por este fluxo.';
  END IF;

  BEGIN
    v_entity_uuid := v_event.entity_id::uuid;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'ID do registro inválido para restauração.';
  END;

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

  IF v_event.entity_type = 'clients' THEN
    UPDATE public.clients
    SET deleted_at = NULL
    WHERE id = v_entity_uuid
      AND company_id = v_event.company_id
      AND deleted_at IS NOT NULL;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  ELSIF v_event.entity_type = 'suppliers' THEN
    UPDATE public.suppliers
    SET deleted_at = NULL
    WHERE id = v_entity_uuid
      AND company_id = v_event.company_id
      AND deleted_at IS NOT NULL;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  ELSIF v_event.entity_type = 'vehicles' THEN
    UPDATE public.vehicles
    SET deleted_at = NULL
    WHERE id = v_entity_uuid
      AND company_id = v_event.company_id
      AND deleted_at IS NOT NULL;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  ELSIF v_event.entity_type = 'drivers' THEN
    UPDATE public.drivers
    SET deleted_at = NULL
    WHERE id = v_entity_uuid
      AND company_id = v_event.company_id
      AND deleted_at IS NOT NULL;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  ELSIF v_event.entity_type = 'partners' THEN
    UPDATE public.partners
    SET deleted_at = NULL,
        status = 'Ativo'
    WHERE id = v_entity_uuid
      AND company_id = v_event.company_id
      AND (deleted_at IS NOT NULL OR status IS DISTINCT FROM 'Ativo');
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  ELSE
    RAISE EXCEPTION 'Tipo "%" não é restaurável automaticamente.', v_event.entity_type;
  END IF;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Registro não encontrado como excluído (já ativo ou apagado em definitivo).';
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
    'restored_at', NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.restore_soft_deleted_from_audit(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_soft_deleted_from_audit(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.restore_soft_deleted_from_audit(UUID, TEXT) IS
  'Reativa soft-delete (clients/suppliers/vehicles/drivers/partners) e marca o evento de auditoria como restaurado.';
