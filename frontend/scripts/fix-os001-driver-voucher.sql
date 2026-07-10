-- Garante que OS001 concluída exibe o voucher (motorista + aceite registrado)
-- Cole no SQL Editor do Supabase se o botão ainda não aparecer após o deploy.

UPDATE public.service_orders
SET
  driver_assignment_response = 'accepted',
  driver_assignment_accepted_at = COALESCE(driver_assignment_accepted_at, NOW()),
  driver_assignment_rejected_at = NULL
WHERE code = 'OS001'
  AND driver_id IS NOT NULL
  AND (driver_assignment_response IS DISTINCT FROM 'accepted');

SELECT
  code,
  status,
  driver_id,
  driver_assignment_response,
  driver_assignment_accepted_at,
  service_completed_at
FROM public.service_orders
WHERE code = 'OS001';
