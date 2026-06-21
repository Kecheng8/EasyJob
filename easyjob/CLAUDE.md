# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

EasyJob finds the *freshest* job postings (published within 3, 10, or 15 days)
for specific titles at specific kinds of company. The backend is an **LLM
agent that drives MCP servers as tools**; the mobile app is a thin client.

```
mobile/   React Native (Expo) app — thin client to the orchestrator
backend/  Python: MCP servers, agent runtime, FastAPI orchestrator, Postgres
```

There is currently no automated test suite in the repo — don't assume a
`pytest`/`jest` invocation exists; if asked to verify behavior, run the
relevant module directly (see Commands) or trace through the code.

## Commands

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # ANTHROPIC_API_KEY, EXA_API_KEY, DATABASE_URL, ...

createdb easyjob
psql $DATABASE_URL -f db/schema.sql

# API server — spawns the 4 MCP servers as subprocesses per search
uvicorn backend.api.orchestrator:app --reload --port 8000

# Saved-search alerts — run on a cron (e.g. every 30 min)
python -m backend.api.alert_worker
```

Run a single MCP server standalone (stdio transport, for debugging tool
schemas/behavior in isolation):

```bash
python -m backend.mcp_servers.ats_server
python -m backend.mcp_servers.internal_server
```

Trigger a search end-to-end:

```bash
curl -X POST localhost:8000/v1/search -H 'content-type: application/json' -d '{
  "user_id": "u_demo",
  "titles": ["Lead SDET", "Test Automation Lead"],
  "industries": ["ai"],
  "freshness_days": 10,
  "locations": ["Remote US", "San Diego, CA"]
}'
# -> {"run_id": "...", "status": "queued", "gate_days": 10}

curl localhost:8000/v1/results/u_demo?gate_days=10
```

### Mobile

```bash
cd mobile
npm install
EXPO_PUBLIC_API_URL=http://localhost:8000 npm start   # then press i / a
```

## Architecture

### Hybrid orchestration — the big picture

```
Phone (thin)                          Cloud (heavy)
------------                          -------------
SearchScreen builds intent  ──POST──▶ orchestrator /v1/search  (queue)
ResultsScreen subscribes (SSE) ◀────  agent_runtime: the LLM tool loop
TrackerScreen reads pipeline           │  ├─ ats_server      (MCP)
                                       │  ├─ web_search_server (MCP)
                                       │  ├─ linkedin_indeed_server (MCP)
                                       │  └─ internal_server  (MCP: dedup/score/store)
                                       └─ Postgres (jobs, applications, runs)
```

The phone never holds source credentials and never runs the multi-minute
agent loop — it POSTs a compact intent (`backend/api/orchestrator.py`
`SearchIntent`) and either polls `/v1/results/{user_id}` or subscribes to
`/v1/runs/{run_id}/stream` (SSE). Adding a new job source means registering a
new MCP server in `backend/agent/mcp_client.py`'s `SERVER_SPECS`, not writing
a scraper into the orchestrator.

### The four MCP servers

| Server | Module | Tools | Role |
|---|---|---|---|
| ATS | `backend/mcp_servers/ats_server.py` | `search_ats`, `fetch_posting` | Greenhouse/Lever/Ashby public JSON — source of truth |
| Web search | `backend/mcp_servers/web_search_server.py` | `search_web` | Exa — fresh startup roles not yet on big boards |
| LinkedIn/Indeed | `backend/mcp_servers/linkedin_indeed_server.py` | `search_linkedin` | High volume, partial data behind walls |
| Internal | `backend/mcp_servers/internal_server.py` | `dedup_jobs`, `passes_freshness`, `score_match`, `upsert_jobs` | Judgement + persistence (deterministic, no LLM) |

Each server is a `FastMCP` app run over stdio. Tool docstrings are written
**for the model** — they're the only spec it sees, so when adding/changing a
tool, the docstring is the contract (what args mean, when to call it, what
"expected" partial/error results look like).

### Agent loop — `backend/agent/agent_runtime.py`

`run_search(run_id, intent, profile)` is the entry point used by both the
orchestrator and the alert worker. It:

1. Opens an `MCPHub` (connects all four MCP servers, collects their tool
   specs in Anthropic tool format).
2. Runs the standard Anthropic tool-use loop (model = `EASYJOB_MODEL` env var,
   default `claude-opus-4-8`), capped at 12 turns.
3. The `SYSTEM` prompt encodes the entire plan: expand title synonyms → ATS
   search for known AI companies → web search for coverage → optional
   LinkedIn → `dedup_jobs` → `passes_freshness` filter → `score_match` → 
   `upsert_jobs` → stop. Don't move this plan into Python — it's intentionally
   model-driven so the agent can adapt.
4. **Security**: for every `upsert_jobs` call, the loop overwrites
   `args["user_id"]` with the authenticated `intent["user_id"]` before
   dispatch, so the model can never be tricked into writing another user's
   data. Preserve this when modifying the dispatch loop.
5. Every tool call/result is appended to `transcript` (truncated via
   `_truncate`) and persisted to `search_runs.transcript` via
   `database.finish_run` — this is the audit trail for "why did this rank #1?".

### MCP hub — `backend/agent/mcp_client.py`

`MCPHub` launches each server in `SERVER_SPECS` as a subprocess
(`python -m <module>`), does the `list_tools` handshake, and builds
`tool_to_session` so `dispatch(name, args)` routes to the right server. To add
a fifth server: add one entry to `SERVER_SPECS` — no agent-loop changes
needed, its tools are discovered automatically.

### Database layer — `backend/db/database.py` + `backend/db/schema.sql`

Single asyncpg pool (`get_pool()`), shared by the FastAPI app and the
`internal_server` MCP tools — no ORM. `init_schema()` re-applies `schema.sql`
on startup (idempotent `CREATE TABLE IF NOT EXISTS`). Tables:

- `profiles` — per-user titles/industries/seniority/locations used by `score_match`.
- `saved_searches` — re-run on a cron by the alert worker; `intent` JSONB is the same shape as `SearchIntent`.
- `jobs` — one row per `(user_id, url)`; `also_seen_on`, `match_score`, `match_notes`, `days_ago` are written by the agent. `ON CONFLICT` upsert updates score/summary/freshness without duplicating rows.
- `applications` — the tracker pipeline, `stage` constrained to `Saved|Applied|Interview|Offer`.
- `search_runs` — one row per agent run with the full tool transcript and status (`queued|running|done|error`).

### Internal MCP server logic — `backend/mcp_servers/internal_server.py`

This is the deterministic core (no LLM) and the most behavior-sensitive file:

- `dedup_jobs`: groups by `(company.lower(), normalized_title)`; survivor is
  chosen by `SOURCE_PRIORITY = ["greenhouse", "lever", "ashby", "web",
  "linkedin", "indeed"]` — ATS sources always win over web/LinkedIn for the
  same role.
- `passes_freshness`: accepts ISO dates or relative strings (`"3 days ago"`);
  missing/unparseable dates return `False` (unknown freshness ≠ fresh). Gate
  is **inclusive** (`age <= gate_days`).
- `score_match`: title 40 / industry 30 / seniority 15 / location 15, summed;
  90+ implies near-total alignment. Keep this honest — don't inflate to make
  results look better.

### Orchestrator API — `backend/api/orchestrator.py`

FastAPI app, endpoints grouped as: search trigger + SSE stream
(`/v1/search`, `/v1/runs/{run_id}/stream`, `/v1/results/{user_id}`), tracker
(`/v1/applications/...`), and profile (`/v1/profile/{user_id}`). `/v1/search`
fires `run_search` via `asyncio.create_task` (fire-and-forget) — the HTTP
response returns immediately with a `run_id`; results land in Postgres
asynchronously and the client polls/streams for them.

### Alert worker — `backend/api/alert_worker.py`

Standalone script (`python -m backend.api.alert_worker`), meant for cron.
Finds `saved_searches` with `alerts_on` and `last_run_at` older than 30 min,
re-runs `run_search` for each, diffs the job count before/after against the
saved search's `gate_days`, and prints a push stub (`_push`) — wire this to
APNs/FCM for real delivery.

### Mobile app — `mobile/`

- `src/api/client.ts` is the **entire** network surface — every backend call
  goes through here. `BASE_URL` comes from `EXPO_PUBLIC_API_URL`.
- `App.tsx` is a minimal tab shell (Search/Results/Tracker) holding only
  `runId`/`gateDays`/selected-job-detail in memory; Postgres via the
  orchestrator is the source of truth for everything else. `USER_ID` is
  hardcoded to `"u_demo"` pending real auth.
- Screens: `SearchScreen` (titles/industry/freshness gate →
  `startSearch`) → `ResultsScreen` (subscribes via `streamRun` while status is
  `running`, then renders `JobCard`s) → `TrackerScreen` (Saved → Applied →
  Interview → Offer via `setStage`/`removeApplication`).
- `src/theme.ts` defines the "quality gate" design language (CI/CD-dashboard
  aesthetic: freshness as a pass/fail signal, match scores as pass rates,
  mono numerals for measured values). Reuse `T`, `freshLabel`, `freshColor`,
  `STAGE_COLOR` rather than hardcoding colors/labels in new components.

## Production-readiness notes (from README, not all implemented yet)

- Run the four MCP tool calls concurrently when the model emits multiple in
  one turn (currently sequential in `agent_runtime.py`).
- Cache ATS board responses for a few minutes — users in the same industry
  hit the same boards.
- `linkedin_indeed_server` should degrade to title-only records rather than
  failing the loop when rate-limited (already partially true via the
  `JOBS_PARTNER_API` unset path).
- Fetched posting content (`fetch_posting` in `ats_server.py`) should have
  embedded instructions stripped before reaching the model context, so a
  malicious posting can't redirect the agent — not yet implemented; currently
  the text is only truncated to 20000 chars.
- The Anthropic and OpenAI tool loops are meant to differ only in field names,
  with the MCP layer shared, to make `EASYJOB_MODEL` swappable across
  providers — currently `agent_runtime.py` is Anthropic-only.
