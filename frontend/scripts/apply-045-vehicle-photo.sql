-- apply-045: Foto mestre do veículo (cadastro → OS/voucher)
-- Execute no SQL Editor do Supabase (produção / projeto do cliente).
-- Equivalente: supabase/migrations/045_vehicle_photo.sql

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS photo_storage_path TEXT;

COMMENT ON COLUMN public.vehicles.photo_storage_path IS
  'Caminho no Storage (company-attachments) da foto do veículo usada na OS/voucher.';
