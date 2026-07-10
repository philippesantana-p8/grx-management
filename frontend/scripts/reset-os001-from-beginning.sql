-- =============================================================================
-- Reset completo da OS001 — volta ao início do fluxo operacional
-- Cole no SQL Editor do Supabase (reexecutável).
--
-- Estado final esperado no app:
--   • Status «Aberto»
--   • Proposta não enviada (sem link / sem aceite do cliente)
--   • Sem motorista designado
--   • Sem acompanhamento / frete concluído
--   • Sem pagamento registrado no DRE
--
-- Fluxo de teste sugerido após rodar:
--   1. Cadastrar / revisar a OS
--   2. Enviar proposta ao cliente (WhatsApp / link)
--   3. Cliente aceita
--   4. Designar motorista (valores motorista + ajudante)
--   5. Motorista aceita → acompanhamento → concluir frete → pagamento DRE
-- =============================================================================

DO $$
DECLARE
  v_order_id UUID;
  v_driver_tx UUID;
  v_assistant_tx UUID;
BEGIN
  SELECT id, driver_payment_driver_transaction_id, driver_payment_assistant_transaction_id
  INTO v_order_id, v_driver_tx, v_assistant_tx
  FROM public.service_orders
  WHERE code = 'OS001'
  LIMIT 1;

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'OS001 não encontrada. Rode apply-os001-only.sql antes.';
  END IF;

  -- Remove lançamentos DRE gerados por «Marcar pago» (se existirem)
  IF v_driver_tx IS NOT NULL THEN
    DELETE FROM public.financial_transactions WHERE id = v_driver_tx;
  END IF;
  IF v_assistant_tx IS NOT NULL THEN
    DELETE FROM public.financial_transactions WHERE id = v_assistant_tx;
  END IF;

  -- Remove comprovantes de pagamento anexados à OS (opcional — só anexos de pagamento)
  DELETE FROM public.attachments
  WHERE entity_type = 'service_order'
    AND entity_id = v_order_id
    AND description = 'Comprovante pagamento motorista';
END $$;

-- Reset principal da ordem de serviço
UPDATE public.service_orders
SET
  status = 'Aberto',

  -- Proposta ao cliente
  proposal_token = NULL,
  proposal_sent_at = NULL,
  proposal_last_follow_up_at = NULL,
  proposal_follow_up_count = 0,
  proposal_response = 'pending',
  proposal_accepted_at = NULL,
  proposal_rejected_at = NULL,

  -- Designação do motorista
  driver_id = NULL,
  proposed_driver_id = NULL,
  driver_assignment_token = NULL,
  driver_assignment_sent_at = NULL,
  driver_assignment_response = 'pending',
  driver_assignment_accepted_at = NULL,
  driver_assignment_rejected_at = NULL,
  driver_assignment_rejected_driver_ids = '{}',
  driver_assignment_pay_amount = NULL,
  driver_assignment_assistant_pay_amount = NULL,

  -- Pagamento ao motorista / DRE
  driver_payment_paid_at = NULL,
  driver_payment_driver_transaction_id = NULL,
  driver_payment_assistant_transaction_id = NULL,

  -- Execução do frete
  service_follow_up_count = 0,
  service_last_follow_up_at = NULL,
  service_completed_at = NULL
WHERE code = 'OS001';

-- Conferência — deve mostrar tudo limpo
SELECT
  code,
  status,
  proposal_response,
  proposal_sent_at,
  proposal_token,
  driver_id,
  proposed_driver_id,
  driver_assignment_response,
  driver_assignment_sent_at,
  driver_assignment_pay_amount,
  driver_assignment_assistant_pay_amount,
  driver_payment_paid_at,
  service_completed_at
FROM public.service_orders
WHERE code = 'OS001';
