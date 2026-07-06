-- GRX Management — Workflow de infrações (órgão autuador + comprovante de pagamento)
-- Migration: 011_traffic_infractions_workflow.sql

ALTER TABLE public.traffic_infractions
    ADD COLUMN IF NOT EXISTS authority_status TEXT NOT NULL DEFAULT 'Pendente'
        CHECK (authority_status IN ('Pendente', 'Indicado', 'Aceito', 'Recusado')),
    ADD COLUMN IF NOT EXISTS authority_indicated_at DATE,
    ADD COLUMN IF NOT EXISTS authority_responded_at DATE,
    ADD COLUMN IF NOT EXISTS payment_proof_status TEXT NOT NULL DEFAULT 'Pendente'
        CHECK (payment_proof_status IN ('Pendente', 'Apresentado', 'Validado')),
    ADD COLUMN IF NOT EXISTS payment_proof_received_at DATE,
    ADD COLUMN IF NOT EXISTS payment_validated_at DATE,
    ADD COLUMN IF NOT EXISTS case_status TEXT NOT NULL DEFAULT 'EmAndamento'
        CHECK (case_status IN ('EmAndamento', 'Baixada', 'Arquivada'));

COMMENT ON COLUMN public.traffic_infractions.authority_status IS
    'Aceite da indicação do motorista pelo órgão autuador.';
COMMENT ON COLUMN public.traffic_infractions.payment_proof_status IS
    'Comprovante de pagamento apresentado pelo motorista.';
COMMENT ON COLUMN public.traffic_infractions.case_status IS
    'Baixa e arquivamento no sistema após validação.';

CREATE INDEX IF NOT EXISTS idx_traffic_infractions_authority_pending
    ON public.traffic_infractions(company_id, authority_status)
    WHERE case_status <> 'Arquivada' AND authority_status IN ('Pendente', 'Indicado');

CREATE INDEX IF NOT EXISTS idx_traffic_infractions_payment_pending
    ON public.traffic_infractions(company_id, payment_proof_status)
    WHERE case_status <> 'Arquivada' AND payment_proof_status IN ('Pendente', 'Apresentado');

ALTER TABLE public.attachments
    DROP CONSTRAINT IF EXISTS attachments_entity_type_check;

ALTER TABLE public.attachments
    ADD CONSTRAINT attachments_entity_type_check
    CHECK (entity_type IN (
        'branch', 'partner', 'vehicle', 'driver', 'client', 'supplier',
        'financial_transaction', 'cash_flow_entry', 'parking_entry',
        'service_order', 'vehicle_event', 'traffic_infraction'
    ));
