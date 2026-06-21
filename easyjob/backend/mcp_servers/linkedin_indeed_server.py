"""LinkedIn / Indeed MCP server.

High volume but bodies are frequently behind a sign-in wall, so the tool is
explicit that partial records (title/company/url only) are expected and the
agent should not retry walls. In production the fetch goes through a managed
partner/scraping API; here it is structured so you can drop that client in.

Run standalone:  python -m backend.mcp_servers.linkedin_indeed_server
"""
from __future__ import annotations

import datetime as dt
import os
import re

import httpx
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("linkedin-indeed-jobs")


def _parse_age(text: str | None) -> int | None:
    """Turn 'Posted 3 days ago' / 'Reposted 1 week ago' into a day count."""
    if not text:
        return None
    text = text.lower()
    if "hour" in text or "today" in text or "just" in text:
        return 0
    m = re.search(r"(\d+)\s*(day|week|month)", text)
    if not m:
        return None
    n, unit = int(m.group(1)), m.group(2)
    return n * {"day": 1, "week": 7, "month": 30}[unit]


@mcp.tool()
async def search_linkedin(role: str, location: str = "United States",
                          recency_days: int = 10) -> list[dict]:
    """Search LinkedIn (and Indeed where available) job listings.

    High volume, but many results return title/company/url only with no
    description because the body is behind a sign-in wall — that is EXPECTED,
    do not retry those. Returns days_ago when the listing shows 'posted N days
    ago'. Filter to recency_days yourself using days_ago; entries without a
    date should be treated as unknown freshness, not as fresh.
    """
    base = os.environ.get("JOBS_PARTNER_API")  # e.g. a compliant data partner
    if not base:
        # Graceful empty result keeps the agent loop healthy in dev.
        return [{"note": "JOBS_PARTNER_API not configured; skipping LinkedIn/Indeed"}]
    async with httpx.AsyncClient(timeout=25) as client:
        r = await client.get(base, params={
            "q": role, "location": location, "sort": "date",
        }, headers={"Authorization": f"Bearer {os.environ.get('JOBS_PARTNER_KEY','')}"})
        r.raise_for_status()
        raw = r.json().get("results", [])
    out = []
    for j in raw:
        age = _parse_age(j.get("posted_text"))
        out.append({
            "title": j.get("title"),
            "company": j.get("company"),
            "location": j.get("location"),
            "url": j.get("url"),
            "comp": j.get("salary"),
            "posted_date": (dt.date.today() - dt.timedelta(days=age)).isoformat()
                           if age is not None else None,
            "days_ago": age,
            "source": j.get("source", "linkedin"),
        })
    return out


if __name__ == "__main__":
    mcp.run(transport="stdio")
