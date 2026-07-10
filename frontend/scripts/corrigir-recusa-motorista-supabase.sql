-- =============================================================================
-- GRX — Corrigir recusa de motorista (Supabase SQL Editor)
-- Cole TUDO abaixo de uma vez e clique em Run.
-- NÃO use o texto "<uuid-do-MOT001>" — este script busca o UUID automaticamente.
-- =============================================================================

-- 1) Coluna de histórico (migration 027)
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS driver_assignment_rejected_driver_ids UUID[] NOT NULL DEFAULT '{}';

-- 2) Função de recusa: guarda quem recusou no array
CREATE OR REPLACE FUNCTION public.respond_to_driver_assignment(p_token TEXT, p_action TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.service_orders%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 32 THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  IF p_action NOT IN ('accept', 'reject') THEN
    RAISE EXCEPTION 'Ação inválida';
  END IF;

  SELECT * INTO v_row
  FROM public.service_orders
  WHERE driver_assignment_token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Designação não encontrada';
  END IF;

  IF v_row.driver_assignment_sent_at IS NULL OR v_row.proposed_driver_id IS NULL THEN
    RAISE EXCEPTION 'Designação ainda não foi enviada ao motorista';
  END IF;

  IF v_row.driver_assignment_response <> 'pending' THEN
    RAISE EXCEPTION 'Designação já respondida';
  END IF;

  IF p_action = 'accept' THEN
    UPDATE public.service_orders
    SET
      driver_assignment_response = 'accepted',
      driver_assignment_accepted_at = NOW(),
      driver_id = proposed_driver_id
    WHERE id = v_row.id;
  ELSE
    UPDATE public.service_orders
    SET
      driver_assignment_response = 'rejected',
      driver_assignment_rejected_at = NOW(),
      driver_assignment_rejected_driver_ids = CASE
        WHEN v_row.proposed_driver_id IS NOT NULL
          AND NOT (v_row.proposed_driver_id = ANY(v_row.driver_assignment_rejected_driver_ids))
        THEN array_append(v_row.driver_assignment_rejected_driver_ids, v_row.proposed_driver_id)
        ELSE v_row.driver_assignment_rejected_driver_ids
      END
    WHERE id = v_row.id;
  END IF;

  RETURN jsonb_build_object(
    'driver_assignment_response', (SELECT driver_assignment_response FROM public.service_orders WHERE id = v_row.id),
    'driver_id', (SELECT driver_id FROM public.service_orders WHERE id = v_row.id),
    'proposed_driver_id', (SELECT proposed_driver_id FROM public.service_orders WHERE id = v_row.id),
    'driver_assignment_rejected_driver_ids', (SELECT driver_assignment_rejected_driver_ids FROM public.service_orders WHERE id = v_row.id)
  );
END;
$$;

-- 3) Backfill OS001 + MOT001 (recusa antiga perdeu proposed_driver_id)
UPDATE public.service_orders AS so
SET
  proposed_driver_id = d.id,
  driver_assignment_rejected_driver_ids = CASE
    WHEN d.id = ANY(so.driver_assignment_rejected_driver_ids) THEN so.driver_assignment_rejected_driver_ids
    ELSE array_append(so.driver_assignment_rejected_driver_ids, d.id)
  END
FROM public.drivers AS d
WHERE so.code = 'OS001'
  AND d.code = 'MOT001'
  AND so.driver_assignment_response = 'rejected';

-- 4) Conferir resultado (deve listar OS001 com array preenchido)
SELECT
  so.code,
  so.driver_assignment_response,
  d.code AS motorista_recusou,
  so.driver_assignment_rejected_driver_ids
FROM public.service_orders AS so
LEFT JOIN public.drivers AS d ON d.id = so.proposed_driver_id
WHERE so.code = 'OS001';
