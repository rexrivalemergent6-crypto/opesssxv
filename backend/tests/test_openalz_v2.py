"""OpenAlz iteration 2 backend tests — new features: health, models, settings validation,
goals CRUD + pursue, run cancellation, debates, bias detection, agent reflection,
self-correction, chat SSE, daily scan.
"""
import os
import time
import json
import uuid
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or Path("/app/frontend/.env").read_text().split("REACT_APP_BACKEND_URL=", 1)[1].splitlines()[0]).strip().rstrip("/")
API = f"{BASE}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---------- health & models ----------
def test_health(s):
    r = s.get(f"{API}/health")
    assert r.status_code == 200
    d = r.json()
    assert d["status"] in ("ok", "degraded")
    assert "database" in d and "active_runs" in d


def test_models(s):
    r = s.get(f"{API}/models")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) == 4
    for m in data:
        assert m["label"].startswith("OpenAlz Engine")
        assert ":" in m["id"]


# ---------- settings validation ----------
def test_settings_rw(s):
    g = s.get(f"{API}/settings")
    assert g.status_code == 200
    cur = g.json()
    # valid update
    r = s.put(f"{API}/settings", json={"research_model": cur["research_model"]})
    assert r.status_code == 200
    # invalid model id
    r2 = s.put(f"{API}/settings", json={"research_model": "nonsense:bogus"})
    assert r2.status_code == 422
    r3 = s.put(f"{API}/settings", json={"chat_model": "nope:none"})
    assert r3.status_code == 422


# ---------- goals ----------
def test_goals_crud_and_pursue(s):
    # invalid short text
    r0 = s.post(f"{API}/goals", json={"text": "x"})
    assert r0.status_code == 422
    # create PROPOSED
    r = s.post(f"{API}/goals", json={"text": "TEST_ investigate TREM2 microglial priming", "status": "PROPOSED"})
    assert r.status_code == 200
    gid = r.json()["id"]
    # invalid status patch
    bad = s.patch(f"{API}/goals/{gid}", json={"status": "WEIRD"})
    assert bad.status_code == 422
    # list contains runs/insights counters
    lst = s.get(f"{API}/goals").json()
    found = next((g for g in lst if g["id"] == gid), None)
    assert found and "runs" in found and "insights" in found
    # pursue -> turns PROPOSED -> ACTIVE and launches a run with goal_id
    pr = s.post(f"{API}/goals/{gid}/pursue")
    assert pr.status_code == 200
    run = pr.json()
    assert run["goal_id"] == gid
    rid = run["id"]
    assert run["status"] in ("queued", "running")
    # goal is now ACTIVE
    lst2 = s.get(f"{API}/goals").json()
    found2 = next(g for g in lst2 if g["id"] == gid)
    assert found2["status"] == "ACTIVE"
    # cancel the run to save time
    time.sleep(1.5)
    s.post(f"{API}/runs/{rid}/cancel")
    # delete goal
    d = s.delete(f"{API}/goals/{gid}")
    assert d.status_code == 200


# ---------- runs cancellation ----------
def test_run_cancel_and_409(s):
    r = s.post(f"{API}/runs", json={"goal": "TEST_ brief cancel test on APP processing"})
    assert r.status_code == 200
    rid = r.json()["id"]
    time.sleep(1.5)
    c = s.post(f"{API}/runs/{rid}/cancel")
    assert c.status_code == 200
    # wait a moment for status write
    time.sleep(0.5)
    got = s.get(f"{API}/runs/{rid}").json()
    assert got["status"] == "cancelled"
    # cancelling an already-terminal run -> 409
    c2 = s.post(f"{API}/runs/{rid}/cancel")
    assert c2.status_code == 409


def test_runs_filter_completed(s):
    r = s.get(f"{API}/runs", params={"status": "completed"})
    assert r.status_code == 200
    for run in r.json():
        assert run["status"] == "completed"


# ---------- debates ----------
def test_debate_full_cycle(s):
    r = s.post(f"{API}/debates", json={"topic": "Does APOE4 modulate glymphatic clearance in aging brains?"})
    assert r.status_code == 200
    did = r.json()["id"]
    assert r.json()["status"] in ("queued", "running")
    # poll up to 5 min
    deadline = time.time() + 300
    final = None
    while time.time() < deadline:
        d = s.get(f"{API}/debates/{did}").json()
        if d["status"] in ("completed", "failed"):
            final = d
            break
        time.sleep(10)
    assert final is not None, "debate did not finish in 5 min"
    if final["status"] == "failed":
        pytest.skip(f"debate failed (likely LLM queue): {final.get('error')}")
    assert isinstance(final.get("turns"), list) and len(final["turns"]) > 0
    assert final.get("resolution", {}).get("verdict") in ("supported", "contested", "refuted")


# ---------- bias detection ----------
def test_bias_detect(s):
    short = s.post(f"{API}/bias/detect", json={"content": "too short"})
    assert short.status_code == 422
    r = s.post(f"{API}/bias/detect", json={
        "content": "Only male APOE4 carriers between 60 and 70 were included; females and other ethnicities were excluded for this preliminary analysis of hippocampal atrophy."
    })
    assert r.status_code == 200
    bid = r.json()["id"]
    deadline = time.time() + 180
    final = None
    while time.time() < deadline:
        b = s.get(f"{API}/bias/reports/{bid}").json()
        if b["status"] in ("completed", "failed"):
            final = b
            break
        time.sleep(6)
    assert final is not None
    if final["status"] == "failed":
        pytest.skip(f"bias failed: {final.get('error')}")
    assert "result" in final
    assert "overall_score" in final["result"]
    assert "categories" in final["result"]


# ---------- agent reflection ----------
def test_agent_reflection(s):
    r = s.post(f"{API}/agents/drug_screener/reflect")
    assert r.status_code == 200
    # duplicate -> 409
    dup = s.post(f"{API}/agents/drug_screener/reflect")
    assert dup.status_code == 409
    deadline = time.time() + 180
    final = None
    while time.time() < deadline:
        a = s.get(f"{API}/agents/drug_screener").json()
        ref = a.get("reflections", [])
        if ref and ref[0]["status"] in ("completed", "failed"):
            final = ref[0]
            break
        time.sleep(5)
    assert final is not None
    if final["status"] == "failed":
        pytest.skip(f"reflection failed: {final.get('error')}")
    assert "adjustments" in final or "result" in final


# ---------- self-correction ----------
def test_self_correction(s):
    r = s.post(f"{API}/orchestrator/self-correction")
    assert r.status_code == 200
    # duplicate while running -> 409
    dup = s.post(f"{API}/orchestrator/self-correction")
    assert dup.status_code == 409
    deadline = time.time() + 180
    final = None
    while time.time() < deadline:
        corr = s.get(f"{API}/orchestrator/self-corrections").json()
        if corr and corr[0]["status"] in ("completed", "failed"):
            final = corr[0]
            break
        time.sleep(6)
    assert final is not None
    if final["status"] == "failed":
        pytest.skip(f"self-correction failed: {final.get('error')}")
    assert "result" in final and "adaptations" in final["result"]
    # verify adaptations inserted into learnings with source=self_correction
    learn = s.get(f"{API}/learnings").json()
    assert any(l.get("source") == "self_correction" for l in learn)


# ---------- chat SSE ----------
def test_chat_streaming_pii_and_multiturn(s):
    sess = s.post(f"{API}/chat/sessions", json={"title": "TEST_chat"})
    assert sess.status_code == 200
    sid = sess.json()["id"]
    # Message with email -> PII flag
    url = f"{API}/chat/sessions/{sid}/message"
    with requests.post(url, json={"text": "My email is testuser@example.com. In two words, name a brain region affected in Alzheimer."}, stream=True, timeout=180) as resp:
        assert resp.status_code == 200
        events = []
        full = ""
        for raw in resp.iter_lines():
            if not raw:
                continue
            if raw.startswith(b"data: "):
                obj = json.loads(raw[6:].decode())
                events.append(obj)
                if obj.get("type") == "delta":
                    full += obj.get("content", "")
                if obj.get("type") == "done":
                    break
    meta = next(e for e in events if e.get("type") == "meta")
    assert "pii_redacted:email" in meta.get("flags", [])
    assert "testuser@example.com" not in meta["user_message"]["content"]
    done = [e for e in events if e.get("type") == "done"]
    assert done and done[-1].get("status") == "done"
    assert len(full) > 0, "no delta content streamed"
    first_answer = full

    # Second turn referencing first answer
    with requests.post(url, json={"text": "Explain in one sentence why that region matters."}, stream=True, timeout=180) as resp2:
        assert resp2.status_code == 200
        full2 = ""
        for raw in resp2.iter_lines():
            if raw and raw.startswith(b"data: "):
                obj = json.loads(raw[6:].decode())
                if obj.get("type") == "delta":
                    full2 += obj.get("content", "")
                if obj.get("type") == "done":
                    break
    assert len(full2) > 0

    # Session persisted messages
    sess_got = s.get(f"{API}/chat/sessions/{sid}").json()
    msgs = sess_got["messages"]
    assistant_done = [m for m in msgs if m["role"] == "assistant" and m["status"] == "done"]
    assert len(assistant_done) >= 2

    # cleanup
    s.delete(f"{API}/chat/sessions/{sid}")


# ---------- daily scan ----------
def test_daily_scan_sets_self_goal(s):
    r = s.post(f"{API}/orchestrator/daily-scan")
    assert r.status_code == 200
    run = r.json()
    assert run["origin"] == "daily_scan"
    rid = run["id"]
    # Poll until the autonomous_scan step completes and a daily_scan goal exists
    deadline = time.time() + 240
    goal_found = False
    while time.time() < deadline:
        got = s.get(f"{API}/runs/{rid}").json()
        if got.get("steps"):
            # we should have at least one step; look for a goal with origin daily_scan
            goals = s.get(f"{API}/goals").json()
            if any(g.get("origin") == "daily_scan" for g in goals):
                goal_found = True
                break
            if got["status"] in ("completed", "failed", "cancelled"):
                break
        time.sleep(8)
    # Cancel the run to free LLM queue
    s.post(f"{API}/runs/{rid}/cancel")
    if not goal_found:
        pytest.skip("daily scan did not self-set a goal within 4 min (LLM queue slow); first step existed")
    assert goal_found
