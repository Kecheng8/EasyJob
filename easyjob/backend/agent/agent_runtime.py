"""Agent runtime — the backend brain.

Connects to the four MCP servers, hands the combined tool list to the latest
model, and runs the standard tool-use loop until the model stops calling tools.
The model owns the plan: expand title synonyms, pick ATS slugs for known AI
companies, fire web searches for the rest, dedup, gate by freshness, score,
and store.

Model-agnostic in spirit: the Anthropic and OpenAI tool loops differ only in
field names; the MCP hub and dispatch are shared.
"""
from __future__ import annotations

import json
import os

import anthropic

from backend.agent.mcp_client import MCPHub
from backend.db import database

MODEL = os.environ.get("EASYJOB_MODEL", "claude-opus-4-8")

SYSTEM = """You are EasyJob's search agent. Given a user's titles, industries,
and a freshness gate in days, find the freshest matching roles and store them.

Plan:
1. Expand the user's titles to close synonyms (e.g. Lead SDET -> Test
   Automation Lead, QA Automation Lead, QA Engineering Manager).
2. For known AI companies, call search_ats with the right board + slug. ATS is
   the source of truth — prefer it for any role it covers.
3. For coverage, call search_web with tight, quoted queries scoped to the gate.
4. Optionally call search_linkedin. Expect partial bodies behind sign-in walls;
   do not retry those.
5. Call dedup_jobs on the union of all results. Then keep only rows where
   passes_freshness(posted_date, gate_days) is true. Then call score_match on
   each survivor against the profile, attaching match_score and match_notes.
6. Tag industry honestly: only 'ai' if the company is AI-native or its core
   product is AI. Prefer fewer, higher-quality matches.
7. Call upsert_jobs(user_id, jobs) with the final ranked set, then STOP.

Known AI-company ATS handles you may use: deepgram(ashby), cresta(greenhouse),
perplexityai(greenhouse), replicant(ashby), glean(greenhouse). Discover others
via search_web."""


async def run_search(run_id: str, intent: dict, profile: dict) -> dict:
    """Execute one search. Writes results via upsert_jobs and records the full
    tool transcript for auditability. Returns a small status summary."""
    transcript: list[dict] = []
    user_id = intent["user_id"]

    async with MCPHub() as hub:
        client = anthropic.AsyncAnthropic()
        messages = [{
            "role": "user",
            "content": (
                f"intent={json.dumps(intent)}\n"
                f"profile={json.dumps(profile)}\n"
                "Find, dedup, freshness-filter, score, and store the matches."
            ),
        }]

        for _ in range(12):  # hard cap on loop turns
            resp = await client.messages.create(
                model=MODEL,
                max_tokens=4096,
                system=SYSTEM,
                tools=hub.tools,
                messages=messages,
            )
            messages.append({"role": "assistant", "content": resp.content})

            tool_calls = [b for b in resp.content if b.type == "tool_use"]
            if not tool_calls:
                break

            tool_results = []
            for call in tool_calls:
                # Inject user_id for the storage tool so the model can't target
                # another user's data.
                args = dict(call.input)
                if call.name == "upsert_jobs":
                    args["user_id"] = user_id
                output = await hub.dispatch(call.name, args)
                transcript.append({
                    "tool": call.name,
                    "input": _truncate(args),
                    "output_summary": _truncate(output),
                })
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": call.id,
                    "content": str(output)[:20000],
                })
            messages.append({"role": "user", "content": tool_results})

    stored = await database.query_jobs(user_id, intent.get("freshness_days", 10))
    await database.finish_run(run_id, transcript, job_count=len(stored), status="done")
    return {"status": "done", "job_count": len(stored)}


def _truncate(obj, limit: int = 600) -> str:
    s = obj if isinstance(obj, str) else json.dumps(obj, default=str)
    return s[:limit]
