-- Corrige geração de token (sem depender de pgcrypto) + registra envio da OS001 para teste
-- Cole no Supabase SQL Editor → Run

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

-- Demo: registrar envio da OS001 (pode reexecutar)
UPDATE public.service_orders
SET
  proposal_token = COALESCE(
    NULLIF(proposal_token, ''),
    replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
  ),
  proposal_sent_at = COALESCE(proposal_sent_at, NOW()),
  status = 'Aguardando aprovação cliente',
  proposal_response = CASE
    WHEN proposal_response IN ('accepted', 'rejected') THEN proposal_response
    ELSE 'pending'
  END
WHERE code = 'OS001'
RETURNING code, proposal_token, proposal_sent_at, status, proposal_response;
