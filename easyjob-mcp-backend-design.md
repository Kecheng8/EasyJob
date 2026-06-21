# EasyJob — MCP Agent Backend Design

Redesign of the EasyJob backend so that an **LLM agent** drives the job hunt by
calling **MCP servers** as tools, instead of a hand-written crawler with one
bespoke parser per site. Orchestration is **hybrid**: the phone triggers and
displays; the cloud runs the agent loop and the heavy retrieval.

The design choice that pays off: when you add a new source (a new ATS, a niche
job board, a new search provider), you register an MCP server — you do **not**
write a new scraper, a new normalizer, or touch the agent. The model already
knows how to call a well-described tool and reshape whatever it returns.

---

## 1. Why MCP + an LLM agent

The previous design baked each source into code: a Greenhouse parser, a LinkedIn
scraper, a dedup function, a scoring function. Every source change broke
something. The new design inverts it.

- The **agent** owns intent and judgement: which titles count as synonyms, which
  companies are "AI-native" vs "AI-adjacent", whether a posting truly falls
  inside the freshness gate, how strong a match is.
- The **MCP servers** own access: each exposes a small set of typed tools
  (`search_jobs`, `fetch_posting`, `dedup_batch`, `score_against_profile`). The
  agent calls them; it never imports them.
- The contract between them is the tool schema. New capability = new tool,
  discoverable at runtime via the MCP `list_tools` handshake.

This is exactly the pattern from the original job-search workflow — search
several sources, normalize to one schema, dedup keeping the ATS as source of
truth, score, rank — but now the steps are tools the model chooses, not a fixed
script.

---

## 2. Hybrid orchestration

```
Phone (thin)                         Cloud (heavy)
------------                         -------------
Build search intent      ──POST──▶   Orchestrator API: validate, enqueue
Poll / open socket                   Agent runtime: the LLM tool loop
Render results + tracker  ◀──push──   MCP servers: ATS, web, LinkedIn, internal
Store nothing sensitive              Postgres: jobs, dedup keys, user profiles
```

The phone never holds API keys for OpenAI/Anthropic, Greenhouse, Exa, etc., and
never runs the multi-minute agent loop on battery. It sends a compact intent
object and subscribes for results. Saved searches re-run server-side on a cron
and push notifications when new roles clear the gate.

A single search intent looks like this:

```json
{
  "titles": ["Lead SDET", "Test Automation Lead", "QA Automation Lead"],
  "industries": ["ai"],
  "freshness_days": 10,
  "locations": ["Remote US", "San Diego, CA"],
  "user_id": "u_123"
}
```

---

## 3. The MCP servers

Four servers, each a separate process the agent connects to. Tool names and
descriptions are what the model reads to decide what to call, so they are written
for the model, not for humans.

### 3a. ATS MCP — source of truth

Greenhouse, Lever, and Ashby all publish public JSON board APIs, so this server
needs no scraping and returns clean records.

```python
# ats_mcp_server.py
from mcp.server.fastmcp import FastMCP
import httpx, datetime as dt

mcp = FastMCP("ats-jobs")

@mcp.tool()
async def search_ats(company_slug: str, board: str) -> list[dict]:
    """List all open roles for a company on an ATS board.
    board is one of: 'greenhouse', 'lever', 'ashby'.
    company_slug is the company's handle on that board, e.g. 'deepgram'.
    Returns raw postings with title, location, url, and an updated_at date
    when the board exposes one. This is the most authoritative source; prefer
    it over web or LinkedIn results for the same role."""
    urls = {
        "greenhouse": f"https://boards-api.greenhouse.io/v1/boards/{company_slug}/jobs?content=true",
        "lever":      f"https://api.lever.co/v0/postings/{company_slug}?mode=json",
        "ashby":      f"https://api.ashbyhq.com/posting-api/job-board/{company_slug}",
    }
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(urls[board])
        r.raise_for_status()
        return _normalize(board, r.json())

@mcp.tool()
async def fetch_posting(url: str) -> dict:
    """Fetch the full text of a single posting URL so its description,
    seniority, and compensation can be extracted. Use after search_ats when
    a posting looks like a match and you need the body."""
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        r = await client.get(url)
        return {"url": url, "html": r.text}

def _normalize(board, payload):
    # Each board nests jobs differently; flatten to one shape.
    rows = {"greenhouse": payload.get("jobs", []),
            "lever": payload,
            "ashby": payload.get("jobs", [])}[board]
    out = []
    for j in rows:
        out.append({
            "title": j.get("title") or j.get("text"),
            "url": j.get("absolute_url") or j.get("hostedUrl") or j.get("jobUrl"),
            "location": (j.get("location") or {}).get("name")
                        or j.get("categories", {}).get("location"),
            "updated_at": j.get("updated_at") or j.get("createdAt"),
            "source": board,
        })
    return out

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

### 3b. Web search MCP — fresh startup roles

Wraps a search provider (Exa, Tavily, Brave) to catch postings that have not
propagated to the big aggregators yet.

```python
# web_search_mcp_server.py
from mcp.server.fastmcp import FastMCP
import os, httpx

mcp = FastMCP("web-search-jobs")

@mcp.tool()
async def search_web(query: str, recency_days: int = 10) -> list[dict]:
    """Search the open web for fresh job postings and careers pages.
    Use short, specific queries like '\"Test Automation Lead\" AI hiring'.
    recency_days filters to results published within that window. Returns
    title, url, snippet, and published_date when available. Good for niche
    AI startups that don't post to Greenhouse/Lever/Ashby."""
    async with httpx.AsyncClient(timeout=25) as client:
        r = await client.post(
            "https://api.exa.ai/search",
            headers={"x-api-key": os.environ["EXA_API_KEY"]},
            json={"query": query, "numResults": 10,
                  "startPublishedDate": _since(recency_days),
                  "contents": {"text": {"maxCharacters": 1200}}},
        )
        data = r.json()
    return [{"title": x["title"], "url": x["url"],
             "snippet": x.get("text", ""), "published_date": x.get("publishedDate"),
             "source": "web"} for x in data.get("results", [])]

def _since(days):
    import datetime as dt
    return (dt.date.today() - dt.timedelta(days=days)).isoformat()

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

### 3c. LinkedIn / Indeed MCP — high volume, partial data

These block logged-out fetches often, so the tool description tells the agent to
expect partial records and not to retry forever.

```python
# linkedin_indeed_mcp_server.py
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("linkedin-indeed-jobs")

@mcp.tool()
async def search_linkedin(role: str, location: str, recency_days: int = 10) -> list[dict]:
    """Search LinkedIn job listings. High volume but bodies are frequently
    behind a sign-in wall, so some results return title/company/url only with
    no description — that is expected, do not retry. Indeed is queried in the
    same call when available. Returns posted_age in days when the listing shows
    'posted N days ago'."""
    # Calls a managed scraping/partner API under the hood; omitted for brevity.
    ...

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

### 3d. Internal MCP — dedup, scoring, storage

The judgement-heavy tools. Dedup and freshness are deterministic; scoring can be
deterministic or delegated back to the model — here it is a tool so the loop
stays auditable.

```python
# internal_mcp_server.py
from mcp.server.fastmcp import FastMCP
import re, datetime as dt

mcp = FastMCP("easyjob-internal")

SOURCE_PRIORITY = ["greenhouse", "lever", "ashby", "web", "linkedin", "indeed"]

@mcp.tool()
def dedup_jobs(jobs: list[dict]) -> list[dict]:
    """Collapse duplicate postings. Two postings are the same role if they
    share (company, normalized_title). Keep the entry from the most
    authoritative source (ATS > web > LinkedIn > Indeed) and record the others
    in 'also_seen_on'."""
    def norm(t):
        t = (t or "").lower()
        t = re.sub(r"\(remote\)|- us|ii|iii|\s+", " ", t)
        return t.strip()
    groups = {}
    for j in jobs:
        key = (j.get("company", "").lower(), norm(j.get("title")))
        groups.setdefault(key, []).append(j)
    out = []
    for items in groups.values():
        items.sort(key=lambda j: SOURCE_PRIORITY.index(j.get("source", "indeed"))
                   if j.get("source") in SOURCE_PRIORITY else 99)
        best = dict(items[0])
        best["also_seen_on"] = sorted({i["source"] for i in items[1:]})
        out.append(best)
    return out

@mcp.tool()
def passes_freshness(posted_date: str, gate_days: int) -> bool:
    """Return true if a posting's date falls within the freshness gate.
    Accepts ISO dates or a 'N days ago' string."""
    if not posted_date:
        return False
    m = re.search(r"(\d+)\s*day", posted_date)
    age = int(m.group(1)) if m else (dt.date.today()
          - dt.date.fromisoformat(posted_date[:10])).days
    return age <= gate_days

@mcp.tool()
def score_match(job: dict, profile: dict) -> dict:
    """Score a job 0-100 against a candidate profile (titles, industries,
    seniority, location). Returns score and a one-line reason. Honest, not
    generous: a 90+ means title, industry, seniority and location all align."""
    s, reasons = 0, []
    if any(t.lower() in job.get("title", "").lower() for t in profile["titles"]):
        s += 40; reasons.append("title match")
    if job.get("industry") in profile["industries"]:
        s += 30; reasons.append("industry match")
    if job.get("seniority") == profile.get("seniority"):
        s += 15; reasons.append("seniority match")
    if any(l.lower() in (job.get("location") or "").lower() for l in profile["locations"]):
        s += 15; reasons.append("location match")
    return {"match_score": s, "match_notes": ", ".join(reasons) or "weak match"}

@mcp.tool()
def upsert_jobs(user_id: str, jobs: list[dict]) -> int:
    """Persist scored, deduped jobs for a user and return the count written.
    The app reads these to render results and the tracker."""
    # INSERT ... ON CONFLICT (user_id, url) DO UPDATE; omitted for brevity.
    return len(jobs)

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

---

## 4. The agent loop

This is the whole backend brain. It connects to the four MCP servers, hands the
combined tool list to the model, and runs the standard tool loop until the model
stops calling tools. The model decides the plan: expand title synonyms, pick ATS
slugs for known AI companies, fire web searches for the rest, then dedup, filter
by the gate, score, and store.

```python
# agent_runtime.py  (Anthropic SDK; the OpenAI equivalent is structurally identical)
import anthropic
from mcp_client import connect_servers   # thin helper: launches the 4 servers, returns tool specs + a dispatch fn

SYSTEM = """You are EasyJob's search agent. Given a user's titles, industries,
and a freshness gate in days, find the freshest matching roles.

Plan:
1. Expand titles to close synonyms (Lead SDET -> Test Automation Lead, QA
   Automation Lead, QA Engineering Manager).
2. For known AI companies, call search_ats with the right board + slug. ATS is
   source of truth.
3. For coverage, call search_web with tight queries scoped to the gate.
4. Optionally call search_linkedin; expect partial bodies, don't retry walls.
5. Call dedup_jobs on everything, then passes_freshness on each, then
   score_match against the profile.
6. Call upsert_jobs with the final ranked set. Then stop.

Be honest about industry: only tag a company 'ai' if it is AI-native or its
core product is AI. Prefer fewer, higher-quality matches."""

async def run_search(intent: dict, profile: dict):
    tools, dispatch = await connect_servers([
        "ats_mcp_server.py", "web_search_mcp_server.py",
        "linkedin_indeed_mcp_server.py", "internal_mcp_server.py",
    ])
    client = anthropic.AsyncAnthropic()
    messages = [{"role": "user", "content":
                 f"intent={intent}\nprofile={profile}\nFind and store matches."}]

    while True:
        resp = await client.messages.create(
            model="claude-opus-4-8",        # latest model; swap per deployment
            max_tokens=4096, system=SYSTEM,
            tools=tools, messages=messages,
        )
        messages.append({"role": "assistant", "content": resp.content})

        tool_calls = [b for b in resp.content if b.type == "tool_use"]
        if not tool_calls:                  # model is done planning + storing
            return resp

        results = []
        for call in tool_calls:
            output = await dispatch(call.name, call.input)   # routes to the right MCP server
            results.append({"type": "tool_result",
                            "tool_use_id": call.id,
                            "content": str(output)})
        messages.append({"role": "user", "content": results})
```

`connect_servers` is the only MCP glue you write once: it spawns each server
(stdio or HTTP transport), calls `list_tools` on each to assemble the combined
spec the model sees, and returns a `dispatch(name, input)` that forwards a call
to whichever server owns that tool. Adding a fifth server is one line in that
list — the agent discovers its tools automatically.

---

## 5. Orchestrator API (the trigger boundary)

The phone talks only to this. It validates the intent, enqueues a job, and
streams results back. The agent loop runs in a worker, not in the request.

```python
# orchestrator.py  (FastAPI)
from fastapi import FastAPI
from agent_runtime import run_search
import asyncio

app = FastAPI()

@app.post("/v1/search")
async def search(intent: dict):
    profile = load_profile(intent["user_id"])
    # Fire and forget; results land in Postgres via upsert_jobs, app polls/subscribes.
    asyncio.create_task(run_search(intent, profile))
    return {"status": "queued", "gate_days": intent["freshness_days"]}

@app.get("/v1/results/{user_id}")
async def results(user_id: str, gate_days: int = 10):
    return query_jobs(user_id, gate_days)   # ranked by match_score desc

# Saved-search alerts: a cron re-POSTs stored intents on a schedule and pushes
# a notification when upsert_jobs writes rows newer than the user's last seen.
```

---

## 6. What changed vs the old backend

| Concern | Old (hard-coded crawler) | New (MCP agent) |
|---|---|---|
| Add a source | Write a scraper + parser + tests | Register an MCP server |
| Normalize results | Per-source mapping code | Agent reshapes to schema |
| Synonyms / industry calls | Static keyword lists | Model judgement in the loop |
| Dedup / score | Buried functions | Auditable MCP tools |
| Where it runs | Monolith cron | Hybrid: device triggers, cloud loops |
| Swap the model | n/a | Change one model string |

---

## 7. Notes for a real deployment

- **Cost / latency:** cache ATS board responses for a few minutes; most users in
  the same industry hit the same boards. Run the four MCP calls concurrently
  when the model emits them in one turn.
- **Rate limits:** the LinkedIn/Indeed server should back off and degrade to
  title-only records rather than failing the whole loop.
- **Auditability:** persist the full tool-call transcript per search. When a user
  asks "why did this rank #1", you can replay the exact `score_match` inputs.
- **Safety:** the orchestrator strips any instructions embedded in fetched
  postings before they reach the model context, so a malicious posting can't
  redirect the agent.
- **Model choice:** the loop is model-agnostic. The Anthropic and OpenAI tool-use
  loops differ only in field names; the MCP servers and dispatch layer are shared.
