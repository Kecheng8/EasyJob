"""Async database access layer for EasyJob (asyncpg over PostgreSQL).

A single connection pool is shared across the API and the internal MCP server.
Every function here is intentionally small so the MCP tools can call them
directly without an ORM in the way.
"""
from __future__ import annotations

import json
import os
from typing import Any

import asyncpg

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=os.environ.get("DATABASE_URL", "postgresql://localhost/easyjob"),
            min_size=1,
            max_size=10,
        )
    return _pool


async def init_schema() -> None:
    """Apply schema.sql (idempotent)."""
    here = os.path.dirname(__file__)
    with open(os.path.join(here, "schema.sql")) as f:
        ddl = f.read()
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(ddl)


# ---- profiles -------------------------------------------------------------

async def load_profile(user_id: str) -> dict[str, Any]:
    pool = await get_pool()
    row = await pool.fetchrow("SELECT * FROM profiles WHERE user_id = $1", user_id)
    if row is None:
        # Sensible default so a brand-new user still gets a useful search.
        return {"titles": [], "industries": [], "seniority": None, "locations": []}
    return {
        "titles": json.loads(row["titles"]),
        "industries": json.loads(row["industries"]),
        "seniority": row["seniority"],
        "locations": json.loads(row["locations"]),
    }


async def save_profile(user_id: str, profile: dict[str, Any]) -> None:
    pool = await get_pool()
    await pool.execute(
        """INSERT INTO profiles (user_id, titles, industries, seniority, locations, updated_at)
           VALUES ($1, $2, $3, $4, $5, now())
           ON CONFLICT (user_id) DO UPDATE
             SET titles=$2, industries=$3, seniority=$4, locations=$5, updated_at=now()""",
        user_id,
        json.dumps(profile.get("titles", [])),
        json.dumps(profile.get("industries", [])),
        profile.get("seniority"),
        json.dumps(profile.get("locations", [])),
    )


# ---- jobs -----------------------------------------------------------------

async def upsert_jobs(user_id: str, jobs: list[dict[str, Any]]) -> int:
    pool = await get_pool()
    written = 0
    async with pool.acquire() as conn:
        async with conn.transaction():
            for j in jobs:
                await conn.execute(
                    """INSERT INTO jobs
                         (user_id, title, company, industry, tag, location, seniority,
                          comp, source, also_seen_on, url, posted_date, days_ago,
                          match_score, match_notes, summary)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
                       ON CONFLICT (user_id, url) DO UPDATE SET
                         match_score=$14, match_notes=$15, summary=$16,
                         days_ago=$13, also_seen_on=$10""",
                    user_id, j.get("title"), j.get("company"), j.get("industry"),
                    j.get("tag"), j.get("location"), j.get("seniority"),
                    j.get("comp"), j.get("source"),
                    json.dumps(j.get("also_seen_on", [])), j.get("url"),
                    j.get("posted_date"), j.get("days_ago"),
                    j.get("match_score", 0), j.get("match_notes"), j.get("summary"),
                )
                written += 1
    return written


async def query_jobs(user_id: str, gate_days: int = 10) -> list[dict[str, Any]]:
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT j.*, a.stage
             FROM jobs j
             LEFT JOIN applications a ON a.job_id = j.id AND a.user_id = j.user_id
            WHERE j.user_id = $1
              AND (j.days_ago IS NULL OR j.days_ago <= $2)
            ORDER BY j.match_score DESC, j.posted_date DESC""",
        user_id, gate_days,
    )
    return [dict(r) for r in rows]


# ---- applications (tracker) ----------------------------------------------

async def set_stage(user_id: str, job_id: int, stage: str) -> None:
    pool = await get_pool()
    await pool.execute(
        """INSERT INTO applications (user_id, job_id, stage, updated_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (user_id, job_id) DO UPDATE SET stage=$3, updated_at=now()""",
        user_id, job_id, stage,
    )


async def remove_application(user_id: str, job_id: int) -> None:
    pool = await get_pool()
    await pool.execute(
        "DELETE FROM applications WHERE user_id=$1 AND job_id=$2", user_id, job_id
    )


async def list_applications(user_id: str) -> list[dict[str, Any]]:
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT a.stage, a.updated_at, j.*
             FROM applications a JOIN jobs j ON j.id = a.job_id
            WHERE a.user_id = $1
            ORDER BY a.updated_at DESC""",
        user_id,
    )
    return [dict(r) for r in rows]


# ---- search runs (audit) --------------------------------------------------

async def create_run(run_id: str, user_id: str, intent: dict[str, Any]) -> None:
    pool = await get_pool()
    await pool.execute(
        """INSERT INTO search_runs (id, user_id, intent, status)
           VALUES ($1, $2, $3, 'queued')""",
        run_id, user_id, json.dumps(intent),
    )


async def finish_run(run_id: str, transcript: list[dict], job_count: int,
                     status: str = "done", error: str | None = None) -> None:
    pool = await get_pool()
    await pool.execute(
        """UPDATE search_runs
              SET transcript=$2, job_count=$3, status=$4, error=$5
            WHERE id=$1""",
        run_id, json.dumps(transcript), job_count, status, error,
    )
