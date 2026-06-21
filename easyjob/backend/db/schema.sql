-- EasyJob database schema (PostgreSQL)
-- Run: psql $DATABASE_URL -f schema.sql

CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    email        TEXT UNIQUE NOT NULL,
    display_name TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A user's search preferences / candidate profile, used by score_match.
CREATE TABLE IF NOT EXISTS profiles (
    user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    titles     JSONB NOT NULL DEFAULT '[]',      -- ["Lead SDET","Test Automation Lead"]
    industries JSONB NOT NULL DEFAULT '[]',      -- ["ai","fintech"]
    seniority  TEXT,                              -- "Lead" | "Manager" | ...
    locations  JSONB NOT NULL DEFAULT '[]',      -- ["Remote US","San Diego, CA"]
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Saved searches that re-run on a cron and drive alerts.
CREATE TABLE IF NOT EXISTS saved_searches (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    intent        JSONB NOT NULL,                -- the full search-intent object
    gate_days     INT  NOT NULL DEFAULT 10,
    alerts_on      BOOLEAN NOT NULL DEFAULT TRUE,
    last_run_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Normalized, deduped, scored job postings. One row per (user, url).
CREATE TABLE IF NOT EXISTS jobs (
    id            BIGSERIAL PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title         TEXT NOT NULL,
    company       TEXT NOT NULL,
    industry      TEXT,
    tag           TEXT,                           -- "Voice AI", "Agent AI", ...
    location      TEXT,
    seniority     TEXT,
    comp          TEXT,
    source        TEXT NOT NULL,                  -- greenhouse | lever | ashby | web | linkedin | indeed
    also_seen_on  JSONB NOT NULL DEFAULT '[]',
    url           TEXT NOT NULL,
    posted_date   DATE,
    days_ago      INT,
    match_score   INT NOT NULL DEFAULT 0,
    match_notes   TEXT,
    summary       TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, url)
);

CREATE INDEX IF NOT EXISTS idx_jobs_user_fresh
    ON jobs (user_id, posted_date DESC, match_score DESC);

-- Application pipeline tracker. Stage advances Saved -> Applied -> Interview -> Offer.
CREATE TABLE IF NOT EXISTS applications (
    id          BIGSERIAL PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id      BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    stage       TEXT NOT NULL DEFAULT 'Saved'
                CHECK (stage IN ('Saved','Applied','Interview','Offer')),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, job_id)
);

-- Full agent tool-call transcript per search, for auditability ("why #1?").
CREATE TABLE IF NOT EXISTS search_runs (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    intent      JSONB NOT NULL,
    transcript  JSONB NOT NULL DEFAULT '[]',     -- list of {tool, input, output_summary}
    job_count   INT NOT NULL DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'queued',  -- queued | running | done | error
    error       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
