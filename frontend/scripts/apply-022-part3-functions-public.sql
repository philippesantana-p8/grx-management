-- PARTE 3 de 3 — Funções públicas + permissões

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

CREATE OR REPLACE FUNCTION public.respond_to_proposal(p_token TEXT, p_action TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.service_orders%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 32 THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  IF p_action NOT IN ('accept', 'reject') THEN
    RAISE EXCEPTION 'Ação inválida';
  END IF;

  SELECT * INTO v_row
  FROM public.service_orders
  WHERE proposal_token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta não encontrada';
  END IF;

  IF v_row.proposal_sent_at IS NULL THEN
    RAISE EXCEPTION 'Proposta ainda não foi enviada ao cliente';
  END IF;

  IF v_row.proposal_response <> 'pending' THEN
    RAISE EXCEPTION 'Proposta já respondida';
  END IF;

  IF p_action = 'accept' THEN
    UPDATE public.service_orders
    SET
      proposal_response = 'accepted',
      proposal_accepted_at = NOW()
    WHERE id = v_row.id;
  ELSE
    UPDATE public.service_orders
    SET
      proposal_response = 'rejected',
      proposal_rejected_at = NOW(),
      status = 'Cancelado'
    WHERE id = v_row.id;
  END IF;

  RETURN jsonb_build_object(
    'proposal_response', (SELECT proposal_response FROM public.service_orders WHERE id = v_row.id),
    'status', (SELECT status FROM public.service_orders WHERE id = v_row.id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_proposal_token(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_proposal_sent(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_proposal_follow_up(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_proposal(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_proposal(TEXT, TEXT) TO anon, authenticated;
