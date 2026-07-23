-- apply-060-import-driver-confirmed.sql
-- OS importadas/legado com motorista já vinculado, sem fluxo de designação WhatsApp.
-- 1) Backfill: marca proposta + designação como aceitas
-- 2) complete_service_order: aceita motorista legado (sem sent_at)
-- Rodar no SQL Editor do Supabase (produção GRX).

BEGIN;

-- Motorista já na OS, sem designação enviada → trata como confirmado (libera Concluir / DRE)
UPDATE public.service_orders
SET
  proposal_response = CASE
    WHEN COALESCE(proposal_response, 'pending') = 'rejected' THEN proposal_response
    ELSE 'accepted'
  END,
  proposal_accepted_at = COALESCE(proposal_accepted_at, COALESCE(service_date::timestamptz, NOW())),
  driver_assignment_response = 'accepted',
  proposed_driver_id = COALESCE(proposed_driver_id, driver_id)
WHERE driver_id IS NOT NULL
  AND status IS DISTINCT FROM 'Cancelado'
  AND COALESCE(driver_assignment_response, 'pending') = 'pending'
  AND driver_assignment_sent_at IS NULL
  AND proposed_driver_id IS NULL
  AND COALESCE(proposal_response, 'pending') <> 'rejected';

CREATE OR REPLACE FUNCTION public.complete_service_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.service_orders%ROWTYPE;
  v_driver_ok BOOLEAN;
BEGIN
  PERFORM public._assert_service_order_member(p_order_id);

  SELECT * INTO v_row
  FROM public.service_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de serviço não encontrada';
  END IF;

  -- Aceito formal OU legado/import (motorista na OS sem designação enviada)
  v_driver_ok :=
    v_row.driver_id IS NOT NULL
    AND (
      v_row.driver_assignment_response = 'accepted'
      OR (
        COALESCE(v_row.driver_assignment_response, 'pending') = 'pending'
        AND v_row.driver_assignment_sent_at IS NULL
        AND v_row.proposed_driver_id IS NULL
      )
    );

  IF NOT v_driver_ok THEN
    RAISE EXCEPTION 'Motorista ainda não confirmou a designação';
  END IF;

  IF v_row.status = 'Concluido' THEN
    RAISE EXCEPTION 'Ordem de serviço já concluída';
  END IF;

  UPDATE public.service_orders
  SET
    status = 'Concluido',
    service_completed_at = NOW(),
    proposal_response = CASE
      WHEN COALESCE(proposal_response, 'pending') = 'rejected' THEN proposal_response
      ELSE 'accepted'
    END,
    proposal_accepted_at = COALESCE(proposal_accepted_at, NOW()),
    driver_assignment_response = 'accepted',
    proposed_driver_id = COALESCE(proposed_driver_id, driver_id)
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'status', 'Concluido',
    'service_completed_at', (SELECT service_completed_at FROM public.service_orders WHERE id = p_order_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_service_order(UUID) TO authenticated;

COMMIT;
