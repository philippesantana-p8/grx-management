-- Volta a OS para «Designar motorista» (teste)
-- Cole no SQL Editor do Supabase. Ajuste 'OS001' se necessário.
--
-- IMPORTANTE: para os campos de valor motorista/ajudante no app, rode ANTES:
--   frontend/scripts/apply-030-driver-assignment-pay-amounts.sql

-- ========== 1) Reset principal (sempre funciona) ==========
UPDATE public.service_orders
SET
  proposal_response = 'accepted',
  proposal_rejected_at = NULL,
  proposal_accepted_at = COALESCE(proposal_accepted_at, NOW()),
  proposal_sent_at = COALESCE(proposal_sent_at, NOW()),
  status = 'Aberto',
  driver_id = NULL,
  proposed_driver_id = NULL,
  driver_assignment_sent_at = NULL,
  driver_assignment_response = 'pending',
  driver_assignment_accepted_at = NULL,
  driver_assignment_rejected_at = NULL
WHERE code = 'OS001';

-- ========== 2) Campos opcionais (só se a migration existir) ==========
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'service_orders'
      AND column_name = 'driver_assignment_rejected_driver_ids'
  ) THEN
    UPDATE public.service_orders
    SET driver_assignment_rejected_driver_ids = '{}'
    WHERE code = 'OS001';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'service_orders'
      AND column_name = 'driver_assignment_pay_amount'
  ) THEN
    UPDATE public.service_orders
    SET
      driver_assignment_pay_amount = NULL,
      driver_assignment_assistant_pay_amount = NULL
    WHERE code = 'OS001';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'service_orders'
      AND column_name = 'service_follow_up_count'
  ) THEN
    UPDATE public.service_orders
    SET
      service_follow_up_count = 0,
      service_last_follow_up_at = NULL,
      service_completed_at = NULL
    WHERE code = 'OS001';
  END IF;
END $$;

-- ========== 3) Conferir ==========
SELECT
  code,
  status,
  proposal_response,
  driver_id,
  proposed_driver_id,
  driver_assignment_response,
  driver_assignment_sent_at
FROM public.service_orders
WHERE code = 'OS001';
