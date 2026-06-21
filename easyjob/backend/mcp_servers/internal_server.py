"""Internal MCP server — the judgement + persistence tools.

dedup_jobs / passes_freshness / score_match are deterministic and auditable.
upsert_jobs writes through the shared database layer so the app can read
results immediately.

Run standalone:  python -m backend.mcp_servers.internal_server
"""
from __future__ import annotations

import datetime as dt
import re

from mcp.server.fastmcp import FastMCP

from backend.db import database

mcp = FastMCP("easyjob-internal")

# ATS is most authoritative; Indeed least. Used to pick the survivor on dedup.
SOURCE_PRIORITY = ["greenhouse", "lever", "ashby", "web", "linkedin", "indeed"]


def _norm_title(t: str | None) -> str:
    t = (t or "").lower()
    t = re.sub(r"\(remote\)|-\s*us\b|\b(i{1,3})\b", " ", t)
    t = re.sub(r"\s+", " ", t)
    return t.strip()


@mcp.tool()
def dedup_jobs(jobs: list[dict]) -> list[dict]:
    """Collapse duplicate postings across sources.

    Two postings are the same role if they share (company, normalized_title).
    Keeps the entry from the most authoritative source (ATS > web > LinkedIn >
    Indeed) and records the rest in 'also_seen_on'. Call this once on the union
    of all search results before filtering or scoring.
    """
    groups: dict[tuple, list[dict]] = {}
    for j in jobs:
        if not j.get("title") or not j.get("url"):
            continue
        key = ((j.get("company") or "").lower(), _norm_title(j.get("title")))
        groups.setdefault(key, []).append(j)

    survivors = []
    for items in groups.values():
        items.sort(key=lambda j: SOURCE_PRIORITY.index(j["source"])
                   if j.get("source") in SOURCE_PRIORITY else 99)
        best = dict(items[0])
        best["also_seen_on"] = sorted({i.get("source") for i in items[1:] if i.get("source")})
        survivors.append(best)
    return survivors


@mcp.tool()
def passes_freshness(posted_date: str, gate_days: int) -> bool:
    """Return true if a posting falls within the freshness gate.

    Accepts an ISO date ('2026-06-10') or a relative string ('3 days ago').
    A missing/unparseable date returns false — unknown freshness is not fresh.
    """
    if not posted_date:
        return False
    m = re.search(r"(\d+)\s*day", str(posted_date))
    if m:
        return int(m.group(1)) <= gate_days
    try:
        age = (dt.date.today() - dt.date.fromisoformat(str(posted_date)[:10])).days
        return age <= gate_days
    except ValueError:
        return False


@mcp.tool()
def score_match(job: dict, profile: dict) -> dict:
    """Score a job 0-100 against a candidate profile and explain why.

    profile has titles[], industries[], seniority, locations[]. Scoring is
    honest, not generous: 90+ means title, industry, seniority and location
    all align. Returns {match_score, match_notes}.
    """
    score, reasons = 0, []
    title = (job.get("title") or "").lower()
    if any(t.lower() in title for t in profile.get("titles", [])):
        score += 40
        reasons.append("title match")
    if job.get("industry") and job["industry"] in profile.get("industries", []):
        score += 30
        reasons.append("industry match")
    if job.get("seniority") and job["seniority"] == profile.get("seniority"):
        score += 15
        reasons.append("seniority match")
    loc = (job.get("location") or "").lower()
    if any(l.lower() in loc for l in profile.get("locations", [])):
        score += 15
        reasons.append("location match")
    return {"match_score": score, "match_notes": ", ".join(reasons) or "weak match"}


@mcp.tool()
async def upsert_jobs(user_id: str, jobs: list[dict]) -> int:
    """Persist the final scored, deduped, fresh jobs for a user and return the
    count written. The mobile app reads these to render results and the
    tracker. Call this last, then stop.
    """
    return await database.upsert_jobs(user_id, jobs)


if __name__ == "__main__":
    mcp.run(transport="stdio")
