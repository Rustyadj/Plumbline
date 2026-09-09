"""KreteOps backend API tests - covers seed, jobs, tasks, validation steps, entries, dashboard, AI."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"

session = requests.Session()
session.headers.update({"Content-Type": "application/json"})

# shared state across tests
state = {}


# ── root / health ──
def test_root():
    r = session.get(f"{API}/")
    assert r.status_code == 200
    body = r.json()
    assert body == {"app": "PLUMBLINE", "status": "online"}


# ── seed idempotency ──
def test_seed_idempotent():
    r1 = session.post(f"{API}/seed")
    assert r1.status_code == 200
    d1 = r1.json()
    assert "job_id" in d1 or d1.get("status") == "already_seeded"
    r2 = session.post(f"{API}/seed")
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2.get("status") == "already_seeded"


# ── jobs ──
def test_list_jobs_contains_walls_abilene():
    r = session.get(f"{API}/jobs")
    assert r.status_code == 200
    jobs = r.json()
    assert isinstance(jobs, list) and len(jobs) >= 1
    walls = next((j for j in jobs if j["name"] == "Walls Abilene Intermediate SS"), None)
    assert walls is not None
    assert walls["location"] == "Abilene, TX"
    assert walls["client"] == "Abilene ISD"
    assert walls["status"] == "active"
    state["job_id"] = walls["id"]


def test_get_job_by_id():
    r = session.get(f"{API}/jobs/{state['job_id']}")
    assert r.status_code == 200
    assert r.json()["id"] == state["job_id"]


def test_get_job_404():
    r = session.get(f"{API}/jobs/does-not-exist")
    assert r.status_code == 404


# ── tasks ──
def test_list_tasks_has_115_with_categories_and_courses():
    r = session.get(f"{API}/jobs/{state['job_id']}/tasks")
    assert r.status_code == 200
    tasks = r.json()
    assert len(tasks) == 115, f"expected 115 tasks, got {len(tasks)}"
    cats = {t["category"] for t in tasks}
    expected = {"Precon", "Layout", "Install", "Rebar", "Pour", "Strip", "Cleanup", "Startup"}
    assert expected.issubset(cats), f"missing categories: {expected - cats}"
    courses = {t["course"] for t in tasks}
    assert {"all", "1st", "2nd", "3rd"}.issubset(courses)
    state["tasks"] = tasks
    # pick task per category for later
    state["install_task"] = next(t for t in tasks if t["category"] == "Install")
    state["pour_task"] = next(t for t in tasks if t["category"] == "Pour")
    state["layout_task"] = next(t for t in tasks if t["category"] == "Layout" and t.get("estimated_qty"))


# ── default validation steps ──
def test_default_validation_steps_for_install():
    task = state["install_task"]
    r = session.get(f"{API}/tasks/{task['id']}/validation-steps")
    assert r.status_code == 200
    steps = r.json()
    assert len(steps) >= 3, f"expected default install steps, got {len(steps)}"
    # all default seeded should be approved
    assert all(s["approved"] for s in steps)
    assert all(s["source"] == "default" for s in steps)
    state["install_steps"] = steps


# ── AI generate validation steps ──
def test_ai_generate_validation_steps():
    task = state["pour_task"]
    # retry once if network fails
    last_err = None
    for attempt in range(2):
        try:
            r = session.post(f"{API}/tasks/{task['id']}/validation-steps/generate", timeout=90)
            if r.status_code == 200:
                created = r.json().get("created", [])
                assert 4 <= len(created) <= 8, f"expected 4-6 steps, got {len(created)}"
                assert all(s["source"] == "ai_suggested" for s in created)
                assert all(s["approved"] is False for s in created)
                assert all(s["description"] for s in created)
                state["ai_step_id"] = created[0]["id"]
                return
            last_err = f"status={r.status_code} body={r.text[:300]}"
        except Exception as e:
            last_err = str(e)
        time.sleep(2)
    pytest.fail(f"AI generation failed after 2 attempts: {last_err}")


# ── approve ai step ──
def test_approve_ai_step():
    if "ai_step_id" not in state:
        pytest.skip("no ai step created")
    r = session.patch(f"{API}/validation-steps/{state['ai_step_id']}", json={"approved": True})
    assert r.status_code == 200
    assert r.json()["approved"] is True


# ── create manual step + delete ──
def test_create_and_delete_manual_step():
    task = state["install_task"]
    r = session.post(
        f"{API}/tasks/{task['id']}/validation-steps",
        json={"description": "TEST_manual step", "requires_photo": True, "source": "manual", "approved": True},
    )
    assert r.status_code == 200
    step = r.json()
    assert step["description"] == "TEST_manual step"
    assert step["requires_photo"] is True
    # delete
    d = session.delete(f"{API}/validation-steps/{step['id']}")
    assert d.status_code == 200
    assert d.json()["ok"] is True
    # delete again 404
    d2 = session.delete(f"{API}/validation-steps/{step['id']}")
    assert d2.status_code == 404


# ── task entries (production + validation status logic) ──
def test_entry_with_all_pass_validations_marks_in_progress():
    task = state["layout_task"]
    steps_r = session.get(f"{API}/tasks/{task['id']}/validation-steps")
    steps = steps_r.json()
    assert len(steps) > 0
    validations = [{"step_id": s["id"], "description": s["description"], "status": "pass"} for s in steps]
    qty = (task["estimated_qty"] or 100) / 2.0  # half — should still be in_progress (qty not met)
    r = session.post(
        f"{API}/tasks/{task['id']}/entries",
        json={
            "crew_member": "TEST_Foreman",
            "role": "Foreman",
            "hours": 4.0,
            "qty_completed": qty,
            "notes": "TEST half done",
            "validations": validations,
        },
    )
    assert r.status_code == 200, r.text
    # verify status updated
    tr = session.get(f"{API}/tasks/{task['id']}")
    assert tr.status_code == 200
    t = tr.json()
    assert t["actual_hours"] >= 4.0
    assert t["status"] == "in_progress", f"expected in_progress (qty not met), got {t['status']}"


def test_entry_with_fail_marks_rework():
    task = state["install_task"]
    steps = state["install_steps"]
    validations = [
        {"step_id": steps[0]["id"], "description": steps[0]["description"], "status": "fail", "fix_notes": "TEST fail"}
    ]
    r = session.post(
        f"{API}/tasks/{task['id']}/entries",
        json={
            "crew_member": "TEST_Crew",
            "role": "Installer",
            "hours": 1.0,
            "qty_completed": 1.0,
            "validations": validations,
        },
    )
    assert r.status_code == 200
    tr = session.get(f"{API}/tasks/{task['id']}")
    assert tr.json()["status"] == "rework"


def test_entry_full_qty_pass_marks_validated():
    task = state["layout_task"]
    steps_r = session.get(f"{API}/tasks/{task['id']}/validation-steps")
    steps = [s for s in steps_r.json() if s["approved"]]
    validations = [{"step_id": s["id"], "description": s["description"], "status": "pass"} for s in steps]
    # send another huge qty to meet/exceed estimate
    r = session.post(
        f"{API}/tasks/{task['id']}/entries",
        json={
            "crew_member": "TEST_Foreman",
            "role": "Foreman",
            "hours": 2.0,
            "qty_completed": (task["estimated_qty"] or 100) * 2,
            "validations": validations,
        },
    )
    assert r.status_code == 200
    tr = session.get(f"{API}/tasks/{task['id']}")
    assert tr.json()["status"] == "validated", f"expected validated, got {tr.json()['status']}"


# ── AI fix suggestion ──
def test_ai_fix_suggestion():
    last_err = None
    for attempt in range(2):
        try:
            r = session.post(
                f"{API}/validation/fix-suggestion",
                json={
                    "task_name": "Buck plumb check",
                    "task_category": "Install",
                    "failed_check": "Buck not plumb",
                    "notes": "off by 1/2 inch at top",
                },
                timeout=60,
            )
            if r.status_code == 200:
                fix = r.json().get("fix", "")
                assert isinstance(fix, str) and len(fix) > 10
                return
            last_err = f"{r.status_code} {r.text[:300]}"
        except Exception as e:
            last_err = str(e)
        time.sleep(2)
    pytest.fail(f"fix-suggestion failed: {last_err}")


# ── dashboard ──
def test_dashboard_metrics():
    r = session.get(f"{API}/jobs/{state['job_id']}/dashboard")
    assert r.status_code == 200
    d = r.json()
    # totals
    assert "totals" in d
    for k in ["estimated_hours", "actual_hours", "earned_hours", "ratio", "variance_hours"]:
        assert k in d["totals"]
    # status_counts
    sc = d["status_counts"]
    for k in ["not_started", "in_progress", "validated", "rework"]:
        assert k in sc
    assert sc["rework"] >= 1
    assert sc["validated"] >= 1
    # category breakdown
    assert "Install" in d["category_breakdown"]
    # daily trend
    assert len(d["daily_trend"]) == 7
    assert all("day_label" in x and "hours" in x for x in d["daily_trend"])
    # validation stats
    vs = d["validation_stats"]
    for k in ["pass_rate", "photos_captured", "passed", "failed", "total"]:
        assert k in vs
    # rework + crew
    assert isinstance(d["rework_tasks"], list)
    assert "TEST_Crew" in d["active_crew"] or "TEST_Foreman" in d["active_crew"]


# ── common mistakes ──
def test_common_mistakes():
    r = session.get(f"{API}/common-mistakes?category=Install")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
