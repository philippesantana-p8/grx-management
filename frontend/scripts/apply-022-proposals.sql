-- Migration 022 — proposta pública + aceite + follow-up
-- Cole TODO o conteúdo deste arquivo no Supabase SQL Editor → Run

ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS proposal_token TEXT,
  ADD COLUMN IF NOT EXISTS proposal_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proposal_last_follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proposal_follow_up_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proposal_response TEXT NOT NULL DEFAULT 'pending'
    CHECK (proposal_response IN ('pending', 'accepted', 'rejected')),
  ADD COLUMN IF NOT EXISTS proposal_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proposal_rejected_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_orders_proposal_token
  ON public.service_orders (proposal_token)
  WHERE proposal_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public._assert_service_order_member(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT company_id INTO v_company_id
  FROM public.service_orders
  WHERE id = p_order_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Ordem de serviço não encontrada';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_members
    WHERE company_id = v_company_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Sem permissão para esta ordem';
  END IF;

  RETURN v_company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_proposal_token(p_order_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
BEGIN
  PERFORM public._assert_service_order_member(p_order_id);

  SELECT proposal_token INTO v_token
  FROM public.service_orders
  WHERE id = p_order_id;

  IF v_token IS NULL OR v_token = '' THEN
    v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    UPDATE public.service_orders
    SET proposal_token = v_token
    WHERE id = p_order_id;
  END IF;

  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_proposal_sent(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_sent_at TIMESTAMPTZ;
BEGIN
  PERFORM public._assert_service_order_member(p_order_id);
  v_token := public.ensure_proposal_token(p_order_id);

  UPDATE public.service_orders
  SET
    proposal_sent_at = COALESCE(proposal_sent_at, NOW()),
    status = 'Aguardando aprovação cliente',
    proposal_response = CASE
      WHEN proposal_response IN ('accepted', 'rejected') THEN proposal_response
      ELSE 'pending'
    END
  WHERE id = p_order_id;

  SELECT proposal_sent_at INTO v_sent_at
  FROM public.service_orders
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'token', v_token,
    'proposal_sent_at', v_sent_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.register_proposal_follow_up(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_last_at TIMESTAMPTZ;
BEGIN
  PERFORM public._assert_service_order_member(p_order_id);

  UPDATE public.service_orders
  SET
    proposal_last_follow_up_at = NOW(),
    proposal_follow_up_count = proposal_follow_up_count + 1
  WHERE id = p_order_id
  RETURNING proposal_follow_up_count, proposal_last_follow_up_at
  INTO v_count, v_last_at;

  RETURN jsonb_build_object(
    'proposal_follow_up_count', v_count,
    'proposal_last_follow_up_at', v_last_at
  );
END;
$$;

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
