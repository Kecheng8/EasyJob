"""Web search MCP server — wraps Exa (swap for Tavily/Brave by changing _search).

Catches fresh postings on niche AI startups that haven't propagated to the big
aggregators yet. The freshness filter is applied at the provider so the agent
gets pre-scoped results.

Run standalone:  python -m backend.mcp_servers.web_search_server
"""
from __future__ import annotations

import datetime as dt
import os

import httpx
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("web-search-jobs")


def _since(days: int) -> str:
    return (dt.date.today() - dt.timedelta(days=days)).isoformat()


def _days_ago(date_str: str | None) -> int | None:
    if not date_str:
        return None
    try:
        return (dt.date.today() - dt.date.fromisoformat(str(date_str)[:10])).days
    except ValueError:
        return None


@mcp.tool()
async def search_web(query: str, recency_days: int = 10) -> list[dict]:
    """Search the open web for fresh job postings and careers pages.

    Use short, specific queries like '"Test Automation Lead" AI hiring' or
    '"Lead SDET" voice AI startup'. recency_days filters to results published
    within that window. Returns title, url, snippet, and published_date when
    available. Best for niche AI companies that don't post to Greenhouse,
    Lever, or Ashby.
    """
    api_key = os.environ.get("EXA_API_KEY")
    if not api_key:
        return [{"error": "EXA_API_KEY not set"}]
    async with httpx.AsyncClient(timeout=25) as client:
        r = await client.post(
            "https://api.exa.ai/search",
            headers={"x-api-key": api_key, "Content-Type": "application/json"},
            json={
                "query": query,
                "numResults": 10,
                "type": "auto",
                "startPublishedDate": _since(recency_days),
                "contents": {"text": {"maxCharacters": 1200}},
            },
        )
        r.raise_for_status()
        data = r.json()
    out = []
    for x in data.get("results", []):
        published = x.get("publishedDate")
        out.append({
            "title": x.get("title"),
            "url": x.get("url"),
            "snippet": x.get("text", "")[:1200],
            "posted_date": str(published)[:10] if published else None,
            "days_ago": _days_ago(published),
            "source": "web",
        })
    return out


if __name__ == "__main__":
    mcp.run(transport="stdio")
