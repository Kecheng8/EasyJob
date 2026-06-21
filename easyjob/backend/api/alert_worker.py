"""Saved-search alert worker.

Run on a schedule (cron, e.g. every 30 min). Re-executes each saved search
whose alerts are on, then pushes a notification when the agent stores roles
newer than the user last saw. Push delivery is stubbed — wire to APNs/FCM.

Usage:  python -m backend.api.alert_worker
"""
from __future__ import annotations

import asyncio
import uuid

from backend.agent.agent_runtime import run_search
from backend.db import database


async def run_due_searches() -> None:
    pool = await database.get_pool()
    rows = await pool.fetch(
        """SELECT s.*, COALESCE(p.seniority, NULL) AS seniority
             FROM saved_searches s
             LEFT JOIN profiles p ON p.user_id = s.user_id
            WHERE s.alerts_on = TRUE
              AND (s.last_run_at IS NULL OR s.last_run_at < now() - interval '30 minutes')"""
    )
    for s in rows:
        intent = dict(s["intent"]) if isinstance(s["intent"], dict) else {}
        intent.setdefault("user_id", s["user_id"])
        profile = await database.load_profile(s["user_id"])

        run_id = f"run_{uuid.uuid4().hex[:12]}"
        await database.create_run(run_id, s["user_id"], intent)

        before = await _job_count(pool, s["user_id"], s["gate_days"])
        await run_search(run_id, intent, profile)
        after = await _job_count(pool, s["user_id"], s["gate_days"])

        await pool.execute(
            "UPDATE saved_searches SET last_run_at = now() WHERE id = $1", s["id"]
        )
        new_count = max(0, after - before)
        if new_count:
            await _push(s["user_id"], s["name"], new_count, s["gate_days"])


async def _job_count(pool, user_id: str, gate_days: int) -> int:
    return await pool.fetchval(
        """SELECT count(*) FROM jobs
            WHERE user_id=$1 AND (days_ago IS NULL OR days_ago <= $2)""",
        user_id, gate_days,
    )


async def _push(user_id: str, search_name: str, n: int, gate_days: int) -> None:
    # Wire to APNs (iOS) / FCM (Android). Stubbed to a log line here.
    print(f"[push] {user_id}: {n} new roles in '{search_name}' "
          f"passed your {gate_days}-day gate")


if __name__ == "__main__":
    asyncio.run(run_due_searches())
