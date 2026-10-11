"""Backend tests for AlzNexus FastAPI service."""
import os
import time
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE:
    # fallback to frontend .env
    fe_env = Path("/app/frontend/.env").read_text()
    for line in fe_env.splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE = line.split("=", 1)[1].strip().rstrip("/")
CRON_SECRET = os.environ["WEBHOOK_CRON_SECRET"]

API = f"{BASE}/api"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# ---- Core read endpoints ----
def test_root(s):
    r = s.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_agents_seeded(s):
    r = s.get(f"{API}/agents")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 10, f"expected >=10 agents, got {len(data)}"
    for a in data:
        assert "key" in a and "_id" not in a


def test_runs_list(s):
    r = s.get(f"{API}/runs")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_run_detail_404(s):
    r = s.get(f"{API}/runs/does-not-exist-xyz")
    assert r.status_code == 404


def test_insights_filters(s):
    r = s.get(f"{API}/insights")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    r2 = s.get(f"{API}/insights", params={"verdict": "accept"})
    assert r2.status_code == 200
    for i in r2.json():
        assert i.get("verdict") == "accept"
    r3 = s.get(f"{API}/insights", params={"starred": "true"})
    assert r3.status_code == 200
    for i in r3.json():
        assert i.get("starred") is True


def test_stats(s):
    r = s.get(f"{API}/stats")
    assert r.status_code == 200
    d = r.json()
    for k in ["runs_total", "insights_total", "avg_novelty", "avg_confidence", "schedules_active", "series"]:
        assert k in d


def test_audit(s):
    r = s.get(f"{API}/audit")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    r2 = s.get(f"{API}/audit", params={"agent": "orchestrator"})
    assert r2.status_code == 200


def test_learnings(s):
    r = s.get(f"{API}/learnings")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ---- Star toggle on existing insight ----
def test_star_toggle(s):
    insights = s.get(f"{API}/insights").json()
    if not insights:
        pytest.skip("No existing insights to toggle star on")
    iid = insights[0]["id"]
    before = bool(insights[0].get("starred"))
    r = s.post(f"{API}/insights/{iid}/star")
    assert r.status_code == 200
    toggled = r.json()["starred"]
    assert toggled != before
    # toggle back
    r2 = s.post(f"{API}/insights/{iid}/star")
    assert r2.json()["starred"] == before


def test_star_404(s):
    r = s.post(f"{API}/insights/non-existent-id/star")
    assert r.status_code == 404


# ---- Schedules CRUD ----
@pytest.fixture
def schedule_cleanup(s):
    created = []
    yield created
    for sid in created:
        s.delete(f"{API}/schedules/{sid}")


def test_schedule_validation(s):
    r = s.post(f"{API}/schedules", json={"goal": "x", "interval_hours": 1})  # goal too short
    assert r.status_code == 422
    r = s.post(f"{API}/schedules", json={"goal": "a valid goal", "interval_hours": 0})
    assert r.status_code == 422
    r = s.post(f"{API}/schedules", json={"goal": "a valid goal", "interval_hours": 721})
    assert r.status_code == 422


def test_schedule_crud(s, schedule_cleanup):
    r = s.post(f"{API}/schedules", json={"goal": "TEST_ scheduled research goal", "interval_hours": 24, "enabled": False})
    assert r.status_code == 200
    doc = r.json()
    assert doc["goal"] == "TEST_ scheduled research goal"
    assert doc["interval_hours"] == 24
    assert doc["enabled"] is False
    sid = doc["id"]
    schedule_cleanup.append(sid)

    # list
    lst = s.get(f"{API}/schedules").json()
    assert any(x["id"] == sid for x in lst)

    # patch
    r2 = s.patch(f"{API}/schedules/{sid}", json={"interval_hours": 48, "enabled": True})
    assert r2.status_code == 200
    assert r2.json()["interval_hours"] == 48
    assert r2.json()["enabled"] is True

    # delete
    r3 = s.delete(f"{API}/schedules/{sid}")
    assert r3.status_code == 200
    schedule_cleanup.remove(sid)

    # patch non-existent
    assert s.patch(f"{API}/schedules/{sid}", json={"enabled": False}).status_code == 404


def test_schedule_trigger_404(s):
    r = s.post(f"{API}/schedules/nope-xyz/trigger")
    assert r.status_code == 404


# ---- Cron tick ----
def test_cron_unauth(s):
    r = s.post(f"{API}/cron/tick", json={})
    assert r.status_code == 401
    r2 = s.post(f"{API}/cron/tick", json={}, headers={"Authorization": "Bearer wrong"})
    assert r2.status_code == 401


def test_cron_authorised_and_dedupe(s):
    h = {"Authorization": f"Bearer {CRON_SECRET}", "X-Webhook-Id": f"TEST_webhook_{int(time.time())}"}
    r = s.post(f"{API}/cron/tick", json={}, headers=h)
    assert r.status_code == 200
    d = r.json()
    assert d.get("accepted") is True
    assert not d.get("duplicate")
    # duplicate
    r2 = s.post(f"{API}/cron/tick", json={}, headers=h)
    assert r2.status_code == 200
    assert r2.json().get("duplicate") is True


# ---- Create run (single launch) ----
def test_create_run_validation(s):
    r = s.post(f"{API}/runs", json={"goal": "abc"})  # too short
    assert r.status_code == 422


def test_create_run_launches(s):
    r = s.post(f"{API}/runs", json={"goal": "TEST_ verify APP + hippocampal autophagy briefly"})
    assert r.status_code == 200
    run = r.json()
    assert run["status"] in ("queued", "running")
    assert run["origin"] == "manual"
    rid = run["id"]
    # Poll briefly - don't wait for completion. Confirm steps progress without 429 concurrent_request_limit.
    deadline = time.time() + 45
    saw_steps = False
    last = None
    while time.time() < deadline:
        got = s.get(f"{API}/runs/{rid}").json()
        last = got
        if got.get("status") == "failed":
            err = (got.get("error") or "").lower()
            assert "concurrent_request_limit" not in err, f"Hit LLM concurrency limit: {err}"
            break
        if got.get("steps"):
            saw_steps = True
            break
        time.sleep(3)
    assert last is not None
    assert saw_steps or last.get("status") in ("queued", "running", "completed")
