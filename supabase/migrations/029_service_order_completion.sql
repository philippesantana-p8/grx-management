-- Acompanhamento operacional e conclusão de frete/OS após motorista confirmado

ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS service_follow_up_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_last_follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS service_completed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.register_service_order_follow_up(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.service_orders%ROWTYPE;
  v_count INTEGER;
  v_last_at TIMESTAMPTZ;
BEGIN
  PERFORM public._assert_service_order_member(p_order_id);

  SELECT * INTO v_row
  FROM public.service_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de serviço não encontrada';
  END IF;

  IF v_row.driver_assignment_response <> 'accepted' OR v_row.driver_id IS NULL THEN
    RAISE EXCEPTION 'Registre a confirmação do motorista antes do acompanhamento operacional';
  END IF;

  IF v_row.status = 'Concluido' THEN
    RAISE EXCEPTION 'Esta ordem já está concluída';
  END IF;

  UPDATE public.service_orders
  SET
    service_last_follow_up_at = NOW(),
    service_follow_up_count = service_follow_up_count + 1
  WHERE id = p_order_id
  RETURNING service_follow_up_count, service_last_follow_up_at
  INTO v_count, v_last_at;

  RETURN jsonb_build_object(
    'service_follow_up_count', v_count,
    'service_last_follow_up_at', v_last_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_service_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.service_orders%ROWTYPE;
BEGIN
  PERFORM public._assert_service_order_member(p_order_id);

  SELECT * INTO v_row
  FROM public.service_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de serviço não encontrada';
  END IF;

  IF v_row.driver_assignment_response <> 'accepted' OR v_row.driver_id IS NULL THEN
    RAISE EXCEPTION 'Motorista ainda não confirmou a designação';
  END IF;

  IF v_row.status = 'Concluido' THEN
    RAISE EXCEPTION 'Ordem de serviço já concluída';
  END IF;

  UPDATE public.service_orders
  SET
    status = 'Concluido',
    service_completed_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'status', 'Concluido',
    'service_completed_at', (SELECT service_completed_at FROM public.service_orders WHERE id = p_order_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_service_order_follow_up(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_service_order(UUID) TO authenticated;
