-- Aceite do termo de responsabilidade na renovação da licença.

ALTER TABLE public.company_billing_settings
  ADD COLUMN IF NOT EXISTS terms_version TEXT,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS terms_accepted_ip TEXT;

COMMENT ON COLUMN public.company_billing_settings.terms_version IS
  'Versão do termo aceito (ex.: v1-2026-07).';
COMMENT ON COLUMN public.company_billing_settings.terms_accepted_at IS
  'Data/hora do aceite do termo de responsabilidade.';
COMMENT ON COLUMN public.company_billing_settings.terms_accepted_by IS
  'Usuário que registrou o aceite.';
COMMENT ON COLUMN public.company_billing_settings.terms_accepted_ip IS
  'IP aproximado no momento do aceite (quando disponível).';
