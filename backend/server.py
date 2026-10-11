import asyncio
import hmac
import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Request, Header
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

load_dotenv(Path(__file__).parent / ".env")

import agents  # noqa: E402

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
app = FastAPI(title="AlzNexus")
api = APIRouter(prefix="/api")
logger = logging.getLogger("alznexus")
TASKS = set()
P = {"_id": 0}


def spawn_run(goal: str, origin: str, schedule_id: Optional[str] = None):
    run = {"id": str(uuid.uuid4()), "goal": goal, "origin": origin, "schedule_id": schedule_id, "status": "queued",
           "steps": [], "insight_ids": [], "created_at": agents.now()}
    return run


async def launch(goal, origin, schedule_id=None):
    run = spawn_run(goal, origin, schedule_id)
    await db.runs.insert_one(dict(run))
    t = asyncio.create_task(agents.execute_run(db, run["id"], goal))
    TASKS.add(t)
    t.add_done_callback(TASKS.discard)
    return run


class RunIn(BaseModel):
    goal: str = Field(min_length=5, max_length=1000)


class ScheduleIn(BaseModel):
    goal: str = Field(min_length=5, max_length=1000)
    interval_hours: int = Field(ge=1, le=720)
    enabled: bool = True


class ScheduleUpdate(BaseModel):
    goal: Optional[str] = None
    interval_hours: Optional[int] = Field(default=None, ge=1, le=720)
    enabled: Optional[bool] = None


@app.on_event("startup")
async def startup():
    for a in agents.AGENTS:
        await db.agents.update_one({"key": a["key"]}, {"$set": a, "$setOnInsert": {
            "tasks_completed": 0, "tasks_failed": 0, "registered_at": agents.now(), "status": "online"}}, upsert=True)
    await db.runs.update_many({"status": {"$in": ["queued", "running"]}}, {"$set": {"status": "failed", "error": "Interrupted by server restart"}})


@api.get("/")
async def root():
    return {"service": "AlzNexus", "status": "ok"}


@api.post("/runs")
async def create_run(body: RunIn):
    return await launch(body.goal, "manual")


@api.get("/runs")
async def list_runs(limit: int = 50):
    return await db.runs.find({}, {"_id": 0, "steps": 0}).sort("created_at", -1).to_list(limit)


@api.get("/runs/{run_id}")
async def get_run(run_id: str):
    r = await db.runs.find_one({"id": run_id}, P)
    if not r:
        raise HTTPException(404, "Run not found")
    r["insights"] = await db.insights.find({"run_id": run_id}, P).to_list(20)
    return r


@api.get("/insights")
async def list_insights(verdict: Optional[str] = None, starred: Optional[bool] = None):
    q = {}
    if verdict:
        q["verdict"] = verdict
    if starred is not None:
        q["starred"] = starred
    return await db.insights.find(q, P).sort("created_at", -1).to_list(500)


@api.post("/insights/{iid}/star")
async def star(iid: str):
    i = await db.insights.find_one({"id": iid}, P)
    if not i:
        raise HTTPException(404, "Insight not found")
    await db.insights.update_one({"id": iid}, {"$set": {"starred": not i.get("starred")}})
    return {"starred": not i.get("starred")}


@api.get("/agents")
async def list_agents():
    return await db.agents.find({}, P).to_list(50)


@api.get("/audit")
async def audit(agent: Optional[str] = None, run_id: Optional[str] = None, limit: int = 300):
    q = {k: v for k, v in {"agent": agent, "run_id": run_id}.items() if v}
    return await db.audit_logs.find(q, P).sort("timestamp", -1).to_list(limit)


@api.get("/learnings")
async def learnings():
    return await db.learnings.find({}, P).sort("created_at", -1).to_list(200)


@api.get("/stats")
async def stats():
    insights = await db.insights.find({}, {"_id": 0, "novelty": 1, "confidence": 1, "verdict": 1, "created_at": 1}).to_list(2000)
    avg = lambda k: round(sum(i.get(k, 0) for i in insights) / len(insights), 1) if insights else 0
    return {
        "runs_total": await db.runs.count_documents({}),
        "runs_completed": await db.runs.count_documents({"status": "completed"}),
        "runs_active": await db.runs.count_documents({"status": {"$in": ["queued", "running"]}}),
        "insights_total": len(insights),
        "insights_accepted": sum(1 for i in insights if i.get("verdict") == "accept"),
        "avg_novelty": avg("novelty"), "avg_confidence": avg("confidence"),
        "learnings_total": await db.learnings.count_documents({}),
        "schedules_active": await db.schedules.count_documents({"enabled": True}),
        "series": [{"t": i["created_at"][:10], "novelty": i.get("novelty", 0), "confidence": i.get("confidence", 0)} for i in reversed(insights[-60:])][::-1],
    }


@api.get("/schedules")
async def list_schedules():
    return await db.schedules.find({}, P).sort("created_at", -1).to_list(100)


@api.post("/schedules")
async def create_schedule(body: ScheduleIn):
    doc = {"id": str(uuid.uuid4()), **body.model_dump(), "last_run_at": None, "runs_triggered": 0, "created_at": agents.now()}
    await db.schedules.insert_one(dict(doc))
    return doc


@api.patch("/schedules/{sid}")
async def update_schedule(sid: str, body: ScheduleUpdate):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    r = await db.schedules.update_one({"id": sid}, {"$set": upd})
    if not r.matched_count:
        raise HTTPException(404, "Schedule not found")
    return await db.schedules.find_one({"id": sid}, P)


@api.delete("/schedules/{sid}")
async def delete_schedule(sid: str):
    await db.schedules.delete_one({"id": sid})
    return {"ok": True}


@api.post("/schedules/{sid}/trigger")
async def trigger_schedule(sid: str):
    s = await db.schedules.find_one({"id": sid}, P)
    if not s:
        raise HTTPException(404, "Schedule not found")
    await db.schedules.update_one({"id": sid}, {"$set": {"last_run_at": agents.now()}, "$inc": {"runs_triggered": 1}})
    return await launch(s["goal"], "schedule", sid)


async def run_due_schedules():
    now = datetime.now(timezone.utc)
    async for s in db.schedules.find({"enabled": True}, P):
        last = s.get("last_run_at")
        if last is None or now - datetime.fromisoformat(last) >= timedelta(hours=s["interval_hours"]):
            # atomic claim: only launch if last_run_at is unchanged (prevents double-trigger)
            claimed = await db.schedules.find_one_and_update(
                {"id": s["id"], "last_run_at": last},
                {"$set": {"last_run_at": now.isoformat()}, "$inc": {"runs_triggered": 1}})
            if claimed:
                await launch(s["goal"], "schedule", s["id"])


@api.post("/cron/tick")
async def cron_tick(request: Request, authorization: Optional[str] = Header(None), x_webhook_id: Optional[str] = Header(None)):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    token = authorization[7:] if authorization and authorization.startswith("Bearer ") else ""
    if not hmac.compare_digest(token, os.environ["WEBHOOK_CRON_SECRET"]):
        raise HTTPException(401, "Unauthorized")
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid body")
    run_id = x_webhook_id or (body or {}).get("run_id") or str(uuid.uuid4())
    if await db.cron_runs.find_one({"run_id": run_id}):
        return {"accepted": True, "duplicate": True}
    await db.cron_runs.insert_one({"run_id": run_id, "received_at": agents.now()})
    t = asyncio.create_task(run_due_schedules())
    TASKS.add(t)
    t.add_done_callback(TASKS.discard)
    return {"accepted": True}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
                   allow_methods=["*"], allow_headers=["*"])
logging.basicConfig(level=logging.INFO)


@app.on_event("shutdown")
async def shutdown():
    client.close()
