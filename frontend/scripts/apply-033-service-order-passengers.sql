-- Cole no SQL Editor do Supabase (passageiros + voucher operacional)

ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS passengers JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS flight_data TEXT,
  ADD COLUMN IF NOT EXISTS monitoring_contact TEXT,
  ADD COLUMN IF NOT EXISTS driver_voucher_generated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.service_orders.passengers IS
  'Lista de passageiros: [{ "name", "document_number", "document_issuer" }]';

NOTIFY pgrst, 'reload schema';
