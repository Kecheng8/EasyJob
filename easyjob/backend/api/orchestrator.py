"""Orchestrator API — the boundary the mobile app talks to.

Hybrid design: the phone POSTs a compact intent and subscribes for results;
the agent loop runs in a background task in the cloud, never in the request
and never on the device. Results land in Postgres via the internal MCP server's
upsert_jobs tool; the app polls /v1/results or opens the SSE stream.
"""
from __future__ import annotations

import asyncio
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.agent.agent_runtime import run_search
from backend.db import database

app = FastAPI(title="EasyJob Orchestrator")


@app.on_event("startup")
async def _startup() -> None:
    await database.init_schema()


# ---- request/response models ---------------------------------------------

class SearchIntent(BaseModel):
    user_id: str
    titles: list[str]
    industries: list[str] = Field(default_factory=list)
    freshness_days: int = 10
    locations: list[str] = Field(default_factory=list)


class StageUpdate(BaseModel):
    user_id: str
    job_id: int
    stage: str  # Saved | Applied | Interview | Offer


class ProfileBody(BaseModel):
    titles: list[str] = Field(default_factory=list)
    industries: list[str] = Field(default_factory=list)
    seniority: str | None = None
    locations: list[str] = Field(default_factory=list)


# ---- search trigger + results --------------------------------------------

@app.post("/v1/search")
async def start_search(intent: SearchIntent):
    run_id = f"run_{uuid.uuid4().hex[:12]}"
    profile = await database.load_profile(intent.user_id)
    # Merge any per-search overrides into the stored profile for scoring.
    profile["titles"] = intent.titles or profile["titles"]
    profile["industries"] = intent.industries or profile["industries"]
    profile["locations"] = intent.locations or profile["locations"]

    await database.create_run(run_id, intent.user_id, intent.model_dump())
    # Fire and forget — the agent writes results as it finishes.
    asyncio.create_task(_run(run_id, intent.model_dump(), profile))
    return {"run_id": run_id, "status": "queued", "gate_days": intent.freshness_days}


async def _run(run_id: str, intent: dict, profile: dict) -> None:
    try:
        await run_search(run_id, intent, profile)
    except Exception as exc:  # noqa: BLE001 — record then surface via run status
        await database.finish_run(run_id, [], 0, status="error", error=str(exc))


@app.get("/v1/results/{user_id}")
async def get_results(user_id: str, gate_days: int = 10):
    return {"jobs": await database.query_jobs(user_id, gate_days)}


@app.get("/v1/runs/{run_id}/stream")
async def stream_run(run_id: str):
    """Server-sent events: emit status until the run is done, so the app can
    show a live 'searching…' state and then refresh results."""
    async def gen():
        pool = await database.get_pool()
        while True:
            row = await pool.fetchrow(
                "SELECT status, job_count FROM search_runs WHERE id=$1", run_id
            )
            if row is None:
                yield "event: error\ndata: unknown run\n\n"
                return
            yield f"data: {{\"status\": \"{row['status']}\", \"job_count\": {row['job_count']}}}\n\n"
            if row["status"] in ("done", "error"):
                return
            await asyncio.sleep(1.5)

    return StreamingResponse(gen(), media_type="text/event-stream")


# ---- tracker --------------------------------------------------------------

@app.get("/v1/applications/{user_id}")
async def get_applications(user_id: str):
    return {"applications": await database.list_applications(user_id)}


@app.post("/v1/applications/stage")
async def update_stage(body: StageUpdate):
    if body.stage not in ("Saved", "Applied", "Interview", "Offer"):
        raise HTTPException(400, "invalid stage")
    await database.set_stage(body.user_id, body.job_id, body.stage)
    return {"ok": True}


@app.delete("/v1/applications/{user_id}/{job_id}")
async def delete_application(user_id: str, job_id: int):
    await database.remove_application(user_id, job_id)
    return {"ok": True}


# ---- profile --------------------------------------------------------------

@app.put("/v1/profile/{user_id}")
async def put_profile(user_id: str, body: ProfileBody):
    await database.save_profile(user_id, body.model_dump())
    return {"ok": True}
