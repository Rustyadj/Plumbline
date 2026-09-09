"""PLUMBLINE iteration-2 backend tests: settings, jobs/tasks/mistakes CRUD, leaderboard, admin reset."""
import os
import time
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

session = requests.Session()
session.headers.update({"Content-Type": "application/json"})

state = {}


def _walls_job_id():
    r = session.get(f"{API}/jobs")
    r.raise_for_status()
    for j in r.json():
        if j["name"] == "Walls Abilene Intermediate SS":
            return j["id"]
    return r.json()[0]["id"] if r.json() else None


# ── Root rebrand ──
def test_root_is_plumbline():
    r = session.get(f"{API}/")
    assert r.status_code == 200
    assert r.json()["app"] == "PLUMBLINE"


# ── Settings ──
def test_settings_get_auto_creates_with_defaults():
    r = session.get(f"{API}/settings")
    assert r.status_code == 200
    d = r.json()
    assert d["id"] == "global"
    # only assert defaults if doc never modified — read what's there but type-check
    assert isinstance(d["rework_cost_per_check"], (int, float))
    assert isinstance(d["photo_audit_value"], (int, float))
    state["orig_cost"] = d["rework_cost_per_check"]
    state["orig_photo"] = d["photo_audit_value"]


def test_settings_patch_persists_and_affects_dashboard_roi():
    job_id = _walls_job_id()
    assert job_id, "no seeded job found"
    state["job_id"] = job_id

    # snapshot before
    d0 = session.get(f"{API}/jobs/{job_id}/dashboard").json()
    failed_before = d0["validation_stats"]["failed"]
    cost_before = d0["roi"]["cost_per_check"]

    # patch to 1200
    new_cost = 1200.0
    r = session.patch(f"{API}/settings", json={"rework_cost_per_check": new_cost})
    assert r.status_code == 200, r.text
    assert r.json()["rework_cost_per_check"] == new_cost

    # GET to verify persistence
    g = session.get(f"{API}/settings")
    assert g.json()["rework_cost_per_check"] == new_cost

    # dashboard now uses new value
    d1 = session.get(f"{API}/jobs/{job_id}/dashboard").json()
    assert d1["roi"]["cost_per_check"] == new_cost
    # rework_dollars_saved == failed_checks * cost_per_check (using current failed count)
    failed_now = d1["validation_stats"]["failed"]
    assert d1["roi"]["rework_dollars_saved"] == failed_now * new_cost
    # if there were failed checks, the value must have changed when cost did
    if failed_now > 0 and cost_before != new_cost:
        assert d1["roi"]["rework_dollars_saved"] != failed_before * cost_before or cost_before == new_cost

    # restore original cost so other tests / UI demo unaffected
    session.patch(f"{API}/settings", json={"rework_cost_per_check": state["orig_cost"]})


# ── Jobs CRUD + cascade delete ──
def test_job_create_patch_delete_cascades():
    # create
    r = session.post(f"{API}/jobs", json={
        "name": "TEST_JobCRUD", "location": "Loc", "client": "ClientX", "budget_hours": 200
    })
    assert r.status_code == 200, r.text
    job = r.json()
    assert job["name"] == "TEST_JobCRUD"
    jid = job["id"]

    # patch
    r2 = session.patch(f"{API}/jobs/{jid}", json={"status": "paused", "location": "NewLoc"})
    assert r2.status_code == 200
    assert r2.json()["status"] == "paused"
    assert r2.json()["location"] == "NewLoc"

    # GET to verify persistence
    g = session.get(f"{API}/jobs/{jid}")
    assert g.json()["status"] == "paused"

    # add a task, validation step, entry — verify cascade
    t = session.post(f"{API}/jobs/{jid}/tasks", json={
        "name": "TEST_T1", "category": "Install", "estimated_hours": 5, "estimated_qty": 10
    })
    assert t.status_code == 200
    tid = t.json()["id"]
    step = session.post(f"{API}/tasks/{tid}/validation-steps",
                       json={"description": "TEST_step", "requires_photo": False}).json()
    e = session.post(f"{API}/tasks/{tid}/entries", json={
        "crew_member": "TEST_Crew", "role": "Installer", "hours": 1, "qty_completed": 1,
        "validations": [{"step_id": step["id"], "description": step["description"], "status": "pass"}],
    })
    assert e.status_code == 200

    # delete job
    d = session.delete(f"{API}/jobs/{jid}")
    assert d.status_code == 200

    # job gone
    assert session.get(f"{API}/jobs/{jid}").status_code == 404
    # task gone
    assert session.get(f"{API}/tasks/{tid}").status_code == 404
    # validation steps gone
    assert session.get(f"{API}/tasks/{tid}/validation-steps").json() == []
    # entries gone
    assert session.get(f"{API}/jobs/{jid}/entries").json() == []


# ── Tasks CRUD + cascade ──
def test_task_create_patch_delete_cascades():
    job_id = state.get("job_id") or _walls_job_id()
    # how many tasks at start
    before = session.get(f"{API}/jobs/{job_id}/tasks").json()
    n_before = len(before)
    max_sort = max((t["sort_order"] for t in before), default=-1)

    # create
    r = session.post(f"{API}/jobs/{job_id}/tasks", json={
        "name": "TEST_NewTask", "category": "Install", "course": "all",
        "unit": "lf", "estimated_hours": 6.5, "estimated_qty": 12
    })
    assert r.status_code == 200, r.text
    new_t = r.json()
    assert new_t["name"] == "TEST_NewTask"
    assert new_t["sort_order"] == n_before  # appended at end (sort_order = count)
    assert new_t["sort_order"] > max_sort or n_before == 0
    tid = new_t["id"]

    # patch
    p = session.patch(f"{API}/tasks/{tid}", json={
        "name": "TEST_NewTask_Updated", "estimated_hours": 9.0, "category": "Pour"
    })
    assert p.status_code == 200
    assert p.json()["name"] == "TEST_NewTask_Updated"
    assert p.json()["estimated_hours"] == 9.0
    assert p.json()["category"] == "Pour"

    # GET persistence
    assert session.get(f"{API}/tasks/{tid}").json()["name"] == "TEST_NewTask_Updated"

    # add a validation step + entry to verify cascade
    step = session.post(f"{API}/tasks/{tid}/validation-steps",
                       json={"description": "TEST_v", "requires_photo": False}).json()
    session.post(f"{API}/tasks/{tid}/entries", json={
        "crew_member": "TEST_Crew", "role": "Installer", "hours": 1, "qty_completed": 1,
        "validations": [{"step_id": step["id"], "description": "TEST_v", "status": "pass"}],
    })

    # delete task
    d = session.delete(f"{API}/tasks/{tid}")
    assert d.status_code == 200
    # task gone
    assert session.get(f"{API}/tasks/{tid}").status_code == 404
    # steps gone
    assert session.get(f"{API}/tasks/{tid}/validation-steps").json() == []
    # entries gone
    assert session.get(f"{API}/tasks/{tid}/entries").json() == []


# ── Common mistakes ──
def test_common_mistakes_create_filter_delete():
    r = session.post(f"{API}/common-mistakes", json={
        "title": "TEST_mistake", "fix": "TEST_fix", "category": "Install"
    })
    assert r.status_code == 200
    cm = r.json()
    cm_id = cm["id"]
    assert cm["title"] == "TEST_mistake"

    # filter by category
    g = session.get(f"{API}/common-mistakes?category=Install")
    assert g.status_code == 200
    titles = [x["title"] for x in g.json()]
    assert "TEST_mistake" in titles
    # all returned items have category Install
    assert all(x.get("category") == "Install" for x in g.json())

    # filter by Pour — TEST_mistake should NOT appear
    g2 = session.get(f"{API}/common-mistakes?category=Pour")
    assert "TEST_mistake" not in [x["title"] for x in g2.json()]

    # delete
    d = session.delete(f"{API}/common-mistakes/{cm_id}")
    assert d.status_code == 200
    after = session.get(f"{API}/common-mistakes?category=Install").json()
    assert "TEST_mistake" not in [x["title"] for x in after]


# ── Leaderboard ──
def test_dashboard_leaderboard_shape_and_sorted():
    job_id = state.get("job_id") or _walls_job_id()
    # ensure at least one entry exists — create one
    tasks = session.get(f"{API}/jobs/{job_id}/tasks").json()
    t = next((x for x in tasks if x.get("estimated_qty")), tasks[0])
    steps = session.get(f"{API}/tasks/{t['id']}/validation-steps").json()
    if steps:
        validations = [{"step_id": steps[0]["id"], "description": steps[0]["description"], "status": "pass"}]
    else:
        validations = []
    session.post(f"{API}/tasks/{t['id']}/entries", json={
        "crew_member": "TEST_LBFM", "role": "Foreman", "hours": 2, "qty_completed": 3,
        "validations": validations,
    })

    d = session.get(f"{API}/jobs/{job_id}/dashboard").json()
    assert "leaderboard" in d, "dashboard missing leaderboard"
    lb = d["leaderboard"]
    assert isinstance(lb, list) and len(lb) >= 1
    required = {"name", "role", "hours", "qty", "entries", "checks_total",
                "checks_passed", "checks_failed", "photos", "pass_rate", "score"}
    for row in lb:
        missing = required - set(row.keys())
        assert not missing, f"leaderboard row missing: {missing}"
    # sorted desc by score
    scores = [row["score"] for row in lb]
    assert scores == sorted(scores, reverse=True), f"leaderboard not sorted desc: {scores}"
    # TEST_LBFM should be present
    names = [row["name"] for row in lb]
    assert "TEST_LBFM" in names


# ── Admin reset + reseed ──
def test_admin_reset_wipes_and_reseeds_preserves_settings():
    # set a known custom setting
    custom_cost = 999.0
    session.patch(f"{API}/settings", json={"rework_cost_per_check": custom_cost})
    assert session.get(f"{API}/settings").json()["rework_cost_per_check"] == custom_cost

    # add some throwaway data
    r = session.post(f"{API}/jobs", json={"name": "TEST_DoomedJob"})
    assert r.status_code == 200
    doomed_id = r.json()["id"]

    # reset (default keep_settings=true)
    rr = session.post(f"{API}/admin/reset", timeout=60)
    assert rr.status_code == 200, rr.text
    body = rr.json()
    assert body.get("status") == "seeded"
    assert body.get("tasks", 0) >= 100  # 115 expected

    # settings preserved
    s = session.get(f"{API}/settings").json()
    assert s["rework_cost_per_check"] == custom_cost, "keep_settings=true should preserve settings"

    # doomed job gone
    assert session.get(f"{API}/jobs/{doomed_id}").status_code == 404
    # walls present, 115 tasks
    walls_id = _walls_job_id()
    assert walls_id
    tasks = session.get(f"{API}/jobs/{walls_id}/tasks").json()
    assert len(tasks) == 115, f"expected 115 tasks after reseed, got {len(tasks)}"

    # restore original cost (best-effort)
    if "orig_cost" in state:
        session.patch(f"{API}/settings", json={"rework_cost_per_check": state["orig_cost"]})


def test_zzz_final_seed_idempotent():
    """Ensure demo data intact after all tests."""
    r = session.post(f"{API}/seed")
    assert r.status_code == 200
    walls_id = _walls_job_id()
    tasks = session.get(f"{API}/jobs/{walls_id}/tasks").json()
    assert len(tasks) == 115
