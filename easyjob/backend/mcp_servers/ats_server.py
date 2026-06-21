"""ATS MCP server — Greenhouse, Lever, and Ashby public board APIs.

This is the source-of-truth server: the boards expose public JSON, so no
scraping is needed and records are clean. Tool descriptions are written for the
model, since they are what it reads to decide what to call.

Run standalone:  python -m backend.mcp_servers.ats_server
"""
from __future__ import annotations

import datetime as dt

import httpx
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("ats-jobs")

_BOARD_URLS = {
    "greenhouse": "https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true",
    "lever": "https://api.lever.co/v0/postings/{slug}?mode=json",
    "ashby": "https://api.ashbyhq.com/posting-api/job-board/{slug}",
}


@mcp.tool()
async def search_ats(company_slug: str, board: str) -> list[dict]:
    """List all open roles for a company on an applicant-tracking-system board.

    board is one of: 'greenhouse', 'lever', 'ashby'.
    company_slug is the company's handle on that board (e.g. 'deepgram',
    'cresta'). Returns postings with title, location, url, and updated_at when
    the board exposes one. This is the most authoritative source — prefer it
    over web or LinkedIn results for the same role.
    """
    board = board.lower()
    if board not in _BOARD_URLS:
        return [{"error": f"unknown board '{board}'"}]
    url = _BOARD_URLS[board].format(slug=company_slug)
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(url)
        r.raise_for_status()
        return _normalize(board, company_slug, r.json())


@mcp.tool()
async def fetch_posting(url: str) -> dict:
    """Fetch the full text of a single posting URL so its description,
    seniority, and compensation can be extracted. Use after search_ats once a
    posting looks like a match and you need the body to score it.
    """
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        r = await client.get(url, headers={"User-Agent": "EasyJob/1.0"})
        # Strip to a reasonable size; the agent only needs the description.
        return {"url": url, "text": r.text[:20000]}


def _days_ago(date_str: str | None) -> int | None:
    if not date_str:
        return None
    try:
        d = dt.date.fromisoformat(str(date_str)[:10])
        return (dt.date.today() - d).days
    except ValueError:
        return None


def _normalize(board: str, slug: str, payload) -> list[dict]:
    if board == "greenhouse":
        rows = payload.get("jobs", [])
    elif board == "ashby":
        rows = payload.get("jobs", [])
    else:  # lever returns a bare list
        rows = payload
    out = []
    for j in rows:
        posted = j.get("updated_at") or j.get("createdAt") or j.get("publishedDate")
        # lever createdAt is epoch millis
        if isinstance(posted, (int, float)):
            posted = dt.date.fromtimestamp(posted / 1000).isoformat()
        location = (
            (j.get("location") or {}).get("name")
            if isinstance(j.get("location"), dict)
            else j.get("location")
        ) or j.get("categories", {}).get("location")
        out.append({
            "title": j.get("title") or j.get("text"),
            "company": slug,
            "url": j.get("absolute_url") or j.get("hostedUrl") or j.get("jobUrl"),
            "location": location,
            "posted_date": str(posted)[:10] if posted else None,
            "days_ago": _days_ago(posted),
            "source": board,
        })
    return out


if __name__ == "__main__":
    mcp.run(transport="stdio")
