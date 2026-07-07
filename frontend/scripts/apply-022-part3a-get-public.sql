-- PARTE 3A de 3 — Função pública de leitura

CREATE OR REPLACE FUNCTION public.get_public_proposal(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.service_orders%ROWTYPE;
  v_company_name TEXT;
  v_driver_name TEXT;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 32 THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT so.*
  INTO v_row
  FROM public.service_orders so
  WHERE so.proposal_token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT COALESCE(c.trade_name, c.name), d.name
  INTO v_company_name, v_driver_name
  FROM public.service_orders so
  JOIN public.companies c ON c.id = so.company_id
  LEFT JOIN public.drivers d ON d.id = so.driver_id
  WHERE so.id = v_row.id;

  RETURN jsonb_build_object(
    'found', true,
    'company_name', v_company_name,
    'driver_name', v_driver_name,
    'proposal_response', v_row.proposal_response,
    'proposal_sent_at', v_row.proposal_sent_at,
    'can_respond', (
      v_row.proposal_response = 'pending'
      AND v_row.proposal_sent_at IS NOT NULL
    ),
    'order', jsonb_build_object(
      'id', v_row.id,
      'code', v_row.code,
      'service_type', v_row.service_type,
      'service_date', v_row.service_date,
      'plate', v_row.plate,
      'client_name', v_row.client_name,
      'phone', v_row.phone,
      'service_name', v_row.service_name,
      'service_categories', COALESCE(v_row.service_categories, ARRAY[]::TEXT[]),
      'service_amount', v_row.service_amount,
      'status', v_row.status,
      'notes', v_row.notes,
      'freight_origin_address', v_row.freight_origin_address,
      'freight_destination_address', v_row.freight_destination_address,
      'freight_distance_km', v_row.freight_distance_km,
      'freight_toll_amount', v_row.freight_toll_amount,
      'freight_toll_count', v_row.freight_toll_count,
      'freight_toll_detail', v_row.freight_toll_detail,
      'freight_antt_minimum', v_row.freight_antt_minimum,
      'freight_suggested_total', v_row.freight_suggested_total,
      'freight_agreed_amount', v_row.freight_agreed_amount,
      'freight_travel_days', v_row.freight_travel_days,
      'freight_per_diem_detail', v_row.freight_per_diem_detail,
      'freight_per_diem_total', v_row.freight_per_diem_total,
      'freight_per_diem_charge_to', v_row.freight_per_diem_charge_to
    )
  );
END;
$$;
