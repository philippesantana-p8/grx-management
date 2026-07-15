-- 044: Estacionamento rotativo (1ª hora + hora adicional)
-- Mirror de frontend/scripts/apply-044-patio-rotativo-hourly.sql

ALTER TABLE public.parking_entries
  DROP CONSTRAINT IF EXISTS parking_entries_billing_mode_check;

ALTER TABLE public.parking_entries
  ADD CONSTRAINT parking_entries_billing_mode_check
  CHECK (
    billing_mode IS NULL
    OR billing_mode IN ('Diária', 'Mensal', 'Rotativo')
  );

COMMENT ON COLUMN public.parking_entries.billing_mode IS
  'Diária | Mensal | Rotativo (1ª hora + horas adicionais da tabela de preços).';

CREATE OR REPLACE FUNCTION public.seed_patio_rotativo_defaults(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_code TEXT;
BEGIN
  FOR r IN
    SELECT id, code
    FROM public.patio_vehicle_types
    WHERE company_id = p_company_id
      AND is_active = TRUE
      AND usage_category IN ('Estacionamento/Lava Rápido', 'Estacionamento')
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.patio_price_tables
      WHERE company_id = p_company_id
        AND modality = 'Estacionamento'
        AND vehicle_type_id = r.id
        AND service_name = 'Rotativo 1ª Hora'
        AND status = 'Ativo'
        AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
    ) THEN
      v_code := 'PRH-' || r.code || '-1';
      INSERT INTO public.patio_price_tables (
        company_id, code, modality, vehicle_type_id, service_name,
        price, billing_unit, valid_from, status, notes
      )
      VALUES (
        p_company_id, v_code, 'Estacionamento', r.id, 'Rotativo 1ª Hora',
        10, 'Hora', CURRENT_DATE, 'Ativo',
        'Exemplo rotativo — ajustar em Parâmetros do pátio'
      )
      ON CONFLICT (company_id, code) DO NOTHING;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.patio_price_tables
      WHERE company_id = p_company_id
        AND modality = 'Estacionamento'
        AND vehicle_type_id = r.id
        AND service_name = 'Rotativo Hora Adicional'
        AND status = 'Ativo'
        AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
    ) THEN
      v_code := 'PRH-' || r.code || '-2';
      INSERT INTO public.patio_price_tables (
        company_id, code, modality, vehicle_type_id, service_name,
        price, billing_unit, valid_from, status, notes
      )
      VALUES (
        p_company_id, v_code, 'Estacionamento', r.id, 'Rotativo Hora Adicional',
        5, 'Hora', CURRENT_DATE, 'Ativo',
        'Exemplo rotativo — ajustar em Parâmetros do pátio'
      )
      ON CONFLICT (company_id, code) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN SELECT id FROM public.companies LOOP
    PERFORM public.seed_patio_rotativo_defaults(c.id);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_patio_rotativo_defaults(UUID)
  TO authenticated, service_role;
