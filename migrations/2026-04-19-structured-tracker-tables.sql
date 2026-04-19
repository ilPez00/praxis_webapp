-- =============================================================================
-- 2026-04-19: Structured tracker tables (per-category)
-- Replaces JSONB blob reads with typed columns + GENERATED progress metrics
-- (volume_kg for lifts, macros for meals, pace for cardio, total_eur for trades).
-- Dual-write path: tracker_entries still receives inserts for back-compat.
-- =============================================================================

-- If a previous unified `tracker_metrics` attempt exists, remove it first.
DROP TABLE IF EXISTS public.tracker_metrics CASCADE;

-- ---------- LIFTS ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracker_lifts (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tracker_id        UUID REFERENCES public.trackers(id) ON DELETE CASCADE NOT NULL,
  tracker_entry_id  UUID REFERENCES public.tracker_entries(id) ON DELETE CASCADE,
  node_id           TEXT,
  exercise          TEXT,
  sets              INTEGER,
  reps              INTEGER,
  weight_kg         NUMERIC(8,2),
  volume_kg         NUMERIC(12,2) GENERATED ALWAYS AS
                      (COALESCE(sets,0) * COALESCE(reps,0) * COALESCE(weight_kg,0)) STORED,
  notes             TEXT,
  logged_at         TIMESTAMPTZ DEFAULT now(),
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tracker_lifts_user_date ON public.tracker_lifts (user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracker_lifts_entry     ON public.tracker_lifts (tracker_entry_id);

-- ---------- MEALS ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracker_meals (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tracker_id        UUID REFERENCES public.trackers(id) ON DELETE CASCADE NOT NULL,
  tracker_entry_id  UUID REFERENCES public.tracker_entries(id) ON DELETE CASCADE,
  node_id           TEXT,
  meal_slot         TEXT,
  food              TEXT,
  grams             NUMERIC(8,2),
  calories          NUMERIC(8,2),
  protein_g         NUMERIC(8,2),
  carbs_g           NUMERIC(8,2),
  fat_g             NUMERIC(8,2),
  notes             TEXT,
  logged_at         TIMESTAMPTZ DEFAULT now(),
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tracker_meals_user_date ON public.tracker_meals (user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracker_meals_entry     ON public.tracker_meals (tracker_entry_id);

-- ---------- CARDIO -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracker_cardio (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tracker_id        UUID REFERENCES public.trackers(id) ON DELETE CASCADE NOT NULL,
  tracker_entry_id  UUID REFERENCES public.tracker_entries(id) ON DELETE CASCADE,
  node_id           TEXT,
  activity          TEXT,
  duration_min      NUMERIC(8,2),
  distance_km       NUMERIC(8,2),
  pace_min_per_km   NUMERIC(8,2) GENERATED ALWAYS AS (
                      CASE WHEN distance_km > 0 THEN duration_min / distance_km ELSE NULL END
                    ) STORED,
  notes             TEXT,
  logged_at         TIMESTAMPTZ DEFAULT now(),
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tracker_cardio_user_date ON public.tracker_cardio (user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracker_cardio_entry     ON public.tracker_cardio (tracker_entry_id);

-- ---------- STEPS ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracker_steps (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tracker_id        UUID REFERENCES public.trackers(id) ON DELETE CASCADE NOT NULL,
  tracker_entry_id  UUID REFERENCES public.tracker_entries(id) ON DELETE CASCADE,
  node_id           TEXT,
  steps             INTEGER,
  daily_goal        INTEGER,
  source            TEXT,
  logged_at         TIMESTAMPTZ DEFAULT now(),
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tracker_steps_user_date ON public.tracker_steps (user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracker_steps_entry     ON public.tracker_steps (tracker_entry_id);

-- ---------- SLEEP ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracker_sleep (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tracker_id        UUID REFERENCES public.trackers(id) ON DELETE CASCADE NOT NULL,
  tracker_entry_id  UUID REFERENCES public.tracker_entries(id) ON DELETE CASCADE,
  node_id           TEXT,
  duration_h        NUMERIC(5,2),
  quality           TEXT,
  notes             TEXT,
  logged_at         TIMESTAMPTZ DEFAULT now(),
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tracker_sleep_user_date ON public.tracker_sleep (user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracker_sleep_entry     ON public.tracker_sleep (tracker_entry_id);

-- ---------- MEDITATION -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracker_meditation (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tracker_id        UUID REFERENCES public.trackers(id) ON DELETE CASCADE NOT NULL,
  tracker_entry_id  UUID REFERENCES public.tracker_entries(id) ON DELETE CASCADE,
  node_id           TEXT,
  duration_min      NUMERIC(8,2),
  type              TEXT,
  feeling           TEXT,
  notes             TEXT,
  logged_at         TIMESTAMPTZ DEFAULT now(),
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tracker_meditation_user_date ON public.tracker_meditation (user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracker_meditation_entry     ON public.tracker_meditation (tracker_entry_id);

-- ---------- STUDY ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracker_study (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tracker_id        UUID REFERENCES public.trackers(id) ON DELETE CASCADE NOT NULL,
  tracker_entry_id  UUID REFERENCES public.tracker_entries(id) ON DELETE CASCADE,
  node_id           TEXT,
  subject           TEXT,
  duration_min      NUMERIC(8,2),
  topic             TEXT,
  notes             TEXT,
  logged_at         TIMESTAMPTZ DEFAULT now(),
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tracker_study_user_date ON public.tracker_study (user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracker_study_entry     ON public.tracker_study (tracker_entry_id);

-- ---------- BOOKS ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracker_books (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tracker_id        UUID REFERENCES public.trackers(id) ON DELETE CASCADE NOT NULL,
  tracker_entry_id  UUID REFERENCES public.tracker_entries(id) ON DELETE CASCADE,
  node_id           TEXT,
  title             TEXT,
  author            TEXT,
  pages_read        INTEGER,
  total_pages       INTEGER,
  rating            NUMERIC(3,1),
  notes             TEXT,
  logged_at         TIMESTAMPTZ DEFAULT now(),
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tracker_books_user_date ON public.tracker_books (user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracker_books_entry     ON public.tracker_books (tracker_entry_id);

-- ---------- EXPENSES / BUDGET (unified) --------------------------------------
CREATE TABLE IF NOT EXISTS public.tracker_expenses (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tracker_id        UUID REFERENCES public.trackers(id) ON DELETE CASCADE NOT NULL,
  tracker_entry_id  UUID REFERENCES public.tracker_entries(id) ON DELETE CASCADE,
  node_id           TEXT,
  tx_type           TEXT,
  category          TEXT,
  merchant          TEXT,
  amount_eur        NUMERIC(12,2),
  notes             TEXT,
  logged_at         TIMESTAMPTZ DEFAULT now(),
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tracker_expenses_user_date ON public.tracker_expenses (user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracker_expenses_entry     ON public.tracker_expenses (tracker_entry_id);

-- ---------- INVESTMENTS ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracker_investments (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tracker_id        UUID REFERENCES public.trackers(id) ON DELETE CASCADE NOT NULL,
  tracker_entry_id  UUID REFERENCES public.tracker_entries(id) ON DELETE CASCADE,
  node_id           TEXT,
  action            TEXT,
  asset             TEXT,
  quantity          NUMERIC(14,4),
  price_eur         NUMERIC(12,4),
  total_eur         NUMERIC(14,2) GENERATED ALWAYS AS
                      (COALESCE(quantity,0) * COALESCE(price_eur,0)) STORED,
  notes             TEXT,
  logged_at         TIMESTAMPTZ DEFAULT now(),
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tracker_investments_user_date ON public.tracker_investments (user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracker_investments_entry     ON public.tracker_investments (tracker_entry_id);

-- ---------- MUSIC ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracker_music (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tracker_id        UUID REFERENCES public.trackers(id) ON DELETE CASCADE NOT NULL,
  tracker_entry_id  UUID REFERENCES public.tracker_entries(id) ON DELETE CASCADE,
  node_id           TEXT,
  instrument        TEXT,
  piece             TEXT,
  duration_min      NUMERIC(8,2),
  focus             TEXT,
  notes             TEXT,
  logged_at         TIMESTAMPTZ DEFAULT now(),
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tracker_music_user_date ON public.tracker_music (user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracker_music_entry     ON public.tracker_music (tracker_entry_id);

-- ---------- JOURNAL ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracker_journal (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tracker_id        UUID REFERENCES public.trackers(id) ON DELETE CASCADE NOT NULL,
  tracker_entry_id  UUID REFERENCES public.tracker_entries(id) ON DELETE CASCADE,
  node_id           TEXT,
  mood              TEXT,
  entry             TEXT,
  gratitude         TEXT,
  logged_at         TIMESTAMPTZ DEFAULT now(),
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tracker_journal_user_date ON public.tracker_journal (user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracker_journal_entry     ON public.tracker_journal (tracker_entry_id);

-- ---------- GAMING -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracker_gaming (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tracker_id        UUID REFERENCES public.trackers(id) ON DELETE CASCADE NOT NULL,
  tracker_entry_id  UUID REFERENCES public.tracker_entries(id) ON DELETE CASCADE,
  node_id           TEXT,
  game              TEXT,
  duration_min      NUMERIC(8,2),
  platform          TEXT,
  mode              TEXT,
  notes             TEXT,
  logged_at         TIMESTAMPTZ DEFAULT now(),
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tracker_gaming_user_date ON public.tracker_gaming (user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracker_gaming_entry     ON public.tracker_gaming (tracker_entry_id);

-- ---------- RLS (owner-only + service_role bypass) ---------------------------
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'tracker_lifts','tracker_meals','tracker_cardio','tracker_steps',
    'tracker_sleep','tracker_meditation','tracker_study','tracker_books',
    'tracker_expenses','tracker_investments','tracker_music','tracker_journal',
    'tracker_gaming'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "own select" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "own insert" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "own update" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "own delete" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "service role all" ON public.%I', tbl);
    EXECUTE format('CREATE POLICY "own select" ON public.%I FOR SELECT USING (auth.uid() = user_id)', tbl);
    EXECUTE format('CREATE POLICY "own insert" ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id)', tbl);
    EXECUTE format('CREATE POLICY "own update" ON public.%I FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', tbl);
    EXECUTE format('CREATE POLICY "own delete" ON public.%I FOR DELETE USING (auth.uid() = user_id)', tbl);
    EXECUTE format('CREATE POLICY "service role all" ON public.%I TO service_role USING (true) WITH CHECK (true)', tbl);
  END LOOP;
END $$;
