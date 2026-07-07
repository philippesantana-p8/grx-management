-- PARTE 1 de 3 — Cole no Supabase SQL Editor → Run
-- Depois rode part2 e part3 na mesma ordem.

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
