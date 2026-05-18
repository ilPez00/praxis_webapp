-- =============================================================================
-- 2026-05-18 — Real Money Bets (Stripe escrow)
-- Adds real-money fields to bets table.
-- Flow: Stripe Checkout → payment_intent captured → bet active →
--       win: full refund + PP bonus | loss: funds logged for charity
-- =============================================================================

BEGIN;

ALTER TABLE public.bets
  ADD COLUMN IF NOT EXISTS is_real_money          BOOLEAN  DEFAULT false,
  ADD COLUMN IF NOT EXISTS stake_euros            NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id   TEXT,
  ADD COLUMN IF NOT EXISTS charity_logged         BOOLEAN  DEFAULT false;

-- Pending status: payment initiated but not yet confirmed by Stripe webhook
-- (bets table status check already allows 'active'|'won'|'lost'|'cancelled')
-- Extend constraint to include 'pending'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bets_status_check'
  ) THEN
    ALTER TABLE public.bets DROP CONSTRAINT bets_status_check;
  END IF;
END $$;

ALTER TABLE public.bets
  ADD CONSTRAINT bets_status_check
  CHECK (status IN ('pending', 'active', 'won', 'lost', 'cancelled'));

CREATE INDEX IF NOT EXISTS bets_stripe_session_idx
  ON public.bets (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS bets_stripe_pi_idx
  ON public.bets (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

COMMIT;
