-- =============================================================================
-- Email Tracking for Retention
-- Migration Date: 2026-03-28
-- =============================================================================

-- =============================================================================
-- 1. EMAIL_LOG — Track sent emails for analytics and compliance
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.email_log (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  email_type      TEXT        NOT NULL,
  recipient_email TEXT        NOT NULL,
  subject         TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'sent',
  sent_at         TIMESTAMPTZ DEFAULT now(),
  opened_at       TIMESTAMPTZ,
  clicked_at      TIMESTAMPTZ,
  metadata        JSONB
);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own emails" ON public.email_log;
CREATE POLICY "Users can read own emails"
  ON public.email_log FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can log emails" ON public.email_log;
CREATE POLICY "System can log emails"
  ON public.email_log FOR INSERT
  WITH CHECK (true);

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_email_log_user_type 
  ON public.email_log(user_id, email_type, sent_at DESC);

-- =============================================================================
-- 2. EMAIL_PREFERENCES — User email preferences
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.email_preferences (
  user_id             UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  welcome_email       BOOLEAN     DEFAULT true,
  streak_reminder     BOOLEAN     DEFAULT true,
  milestone_email     BOOLEAN     DEFAULT true,
  weekly_digest       BOOLEAN     DEFAULT true,
  re_engagement       BOOLEAN     DEFAULT true,
  product_updates     BOOLEAN     DEFAULT false,
  updated_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own preferences" ON public.email_preferences;
CREATE POLICY "Users can read own preferences"
  ON public.email_preferences FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON public.email_preferences;
CREATE POLICY "Users can update own preferences"
  ON public.email_preferences FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert preferences" ON public.email_preferences;
CREATE POLICY "System can insert preferences"
  ON public.email_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- 3. TRIGGER — Auto-create email preferences on user creation
-- =============================================================================

CREATE OR REPLACE FUNCTION create_email_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.email_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_email_preferences ON auth.users;
CREATE TRIGGER trg_create_email_preferences
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_email_preferences();

-- =============================================================================
-- End of Migration
-- =============================================================================
