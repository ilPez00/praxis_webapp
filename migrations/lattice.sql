-- =============================================================================
-- Praxis Lattice — Device Registry + Job Queue
-- Physical nodes (machines, wearables, custom devices) wired to Praxis goals.
-- =============================================================================

-- devices: registered physical/virtual nodes in a user's lattice
CREATE TABLE IF NOT EXISTS devices (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    slug          TEXT NOT NULL,
    type          TEXT NOT NULL CHECK (type IN (
                    '3dprinter','cnc_mill','computer','smart_home',
                    'wearable','camera','server','custom')),
    capabilities  TEXT[]       NOT NULL DEFAULT '{}',
    status        TEXT         NOT NULL DEFAULT 'offline'
                    CHECK (status IN ('online','offline','busy','idle')),
    api_key       TEXT         UNIQUE NOT NULL,
    last_seen     TIMESTAMPTZ,
    metadata      JSONB        NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS devices_user_slug_idx ON devices(user_id, slug);
CREATE INDEX        IF NOT EXISTS devices_user_status_idx ON devices(user_id, status);

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY devices_owner ON devices
    USING (user_id = auth.uid());

-- device_jobs: job queue — submitted by user/Aura/Axiom, executed by device agent
CREATE TABLE IF NOT EXISTS device_jobs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    device_id     UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    goal_id       TEXT,   -- optional GoalNode.id — completion updates goal progress
    type          TEXT NOT NULL,
    payload       JSONB NOT NULL DEFAULT '{}',
    status        TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','running','done','failed','cancelled')),
    submitted_by  TEXT NOT NULL DEFAULT 'user'
                    CHECK (submitted_by IN ('user','axiom','aura','mcp')),
    progress_pct  INT  NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
    result        JSONB,
    error_msg     TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at    TIMESTAMPTZ,
    completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS jobs_device_pending_idx  ON device_jobs(device_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS jobs_user_recent_idx     ON device_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_goal_idx            ON device_jobs(goal_id) WHERE goal_id IS NOT NULL;

ALTER TABLE device_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY jobs_owner ON device_jobs
    USING (user_id = auth.uid());
