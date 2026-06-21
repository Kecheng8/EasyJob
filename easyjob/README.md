# EasyJob

A job-search and application-tracking app that finds the *freshest* roles
(published within 3, 10, or 15 days) for specific titles (e.g. Lead SDET) at
specific kinds of company (e.g. AI-native). The backend is an **LLM agent that
drives MCP servers** as tools; the mobile app is a thin client.

```
mobile/   React Native (Expo) app — thin client to the orchestrator
backend/  Python: MCP servers, agent runtime, FastAPI orchestrator, Postgres
```

## Architecture (hybrid orchestration)

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

The phone never holds source credentials and never runs the multi-minute agent
loop. It POSTs a compact intent and subscribes for results. The agent decides
which tools to call; adding a new source means registering a new MCP server in
`backend/agent/mcp_client.py`, not writing a scraper.

## The four MCP servers

| Server | Tools | Role |
|---|---|---|
| `ats_server` | `search_ats`, `fetch_posting` | Greenhouse/Lever/Ashby public JSON — source of truth |
| `web_search_server` | `search_web` | Exa/Tavily/Brave — fresh startup roles |
| `linkedin_indeed_server` | `search_linkedin` | High volume, partial data behind walls |
| `internal_server` | `dedup_jobs`, `passes_freshness`, `score_match`, `upsert_jobs` | Judgement + persistence |

## Backend setup

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill in ANTHROPIC_API_KEY, EXA_API_KEY, DATABASE_URL

createdb easyjob
psql $DATABASE_URL -f db/schema.sql

# Run the API (it spawns the MCP servers per search as subprocesses)
uvicorn backend.api.orchestrator:app --reload --port 8000

# Saved-search alerts (run on a cron, e.g. every 30 min)
python -m backend.api.alert_worker
```

Trigger a search:

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

## Mobile setup

```bash
cd mobile
npm install
EXPO_PUBLIC_API_URL=http://localhost:8000 npm start   # then press i / a
```

Screens: `SearchScreen` (titles, industry, freshness gate) → `ResultsScreen`
(live agent status via SSE, then ranked cards) → `TrackerScreen`
(Saved → Applied → Interview → Offer). `src/api/client.ts` is the entire
network surface.

## The agent loop

`backend/agent/agent_runtime.py` connects to all four MCP servers via
`MCPHub`, hands the combined tool list to the model (`claude-opus-4-8` by
default; set `EASYJOB_MODEL` to change), and runs the standard tool-use loop:
expand title synonyms → call `search_ats` for known AI companies → `search_web`
for the rest → `dedup_jobs` → `passes_freshness` → `score_match` →
`upsert_jobs`, then stop. The full tool transcript is saved to `search_runs`
for auditability ("why did this rank #1?").

## What's verified

The deterministic core (`dedup_jobs`, `passes_freshness`, `score_match`) has
unit tests confirming: ATS wins dedup over LinkedIn, the freshness gate is
inclusive at its boundary and rejects unknown dates, and scoring is honest
(perfect alignment = 100, no overlap = 0). All backend modules import and the
MCP servers register their tools.

## Notes for production

- Run the four MCP tool calls concurrently when the model emits them in one
  turn; cache ATS board responses for a few minutes (users in the same
  industry hit the same boards).
- The LinkedIn/Indeed server degrades to title-only records rather than failing
  the loop when rate-limited.
- The orchestrator strips instructions embedded in fetched postings before they
  reach the model context, so a malicious posting can't redirect the agent.
- Swap the model by changing one env var; the Anthropic and OpenAI tool loops
  differ only in field names, and the MCP layer is shared.
