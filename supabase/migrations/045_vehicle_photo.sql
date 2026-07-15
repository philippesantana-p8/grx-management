-- 045: Foto mestre do veículo
-- Mirror de frontend/scripts/apply-045-vehicle-photo.sql

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS photo_storage_path TEXT;

COMMENT ON COLUMN public.vehicles.photo_storage_path IS
  'Caminho no Storage (company-attachments) da foto do veículo usada na OS/voucher.';
