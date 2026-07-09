-- Atualiza telefone da OS001 para teste WhatsApp (reexecutável)
-- Número: (11) 98348-1803

UPDATE public.service_orders
SET
  phone = '(11) 98348-1803',
  updated_at = NOW()
WHERE code = 'OS001';

SELECT id, code, client_name, phone, status
FROM public.service_orders
WHERE code = 'OS001'
ORDER BY created_at DESC
LIMIT 1;
