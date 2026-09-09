import pytest

import server


@pytest.fixture(autouse=True)
def configured_env(monkeypatch):
    monkeypatch.setenv("SOMETHING_BETTER_API_URL", "https://example.test/api")
    monkeypatch.setenv("SOMETHING_BETTER_WRITES_ENABLED", "true")


@pytest.mark.asyncio
async def test_list_jobs_filters_and_paginates(monkeypatch):
    async def fake_request(method, path, **kwargs):
        assert (method, path) == ("GET", "/jobs")
        return [
            {"id": "1", "name": "Walls Abilene", "status": "active", "client": "AISD", "location": "Abilene"},
            {"id": "2", "name": "Warehouse", "status": "paused", "client": "Acme", "location": "Denton"},
        ]

    monkeypatch.setattr(server, "_request", fake_request)
    result = await server.list_jobs(status="active", query="abilene", limit=20, offset=0, response_format=server.ResponseFormat.JSON)
    assert '"total_count": 1' in result
    assert '"id": "1"' in result
    assert '"id": "2"' not in result


@pytest.mark.asyncio
async def test_task_details_excludes_unapproved_steps(monkeypatch):
    async def fake_request(method, path, **kwargs):
        if path == "/tasks/t1":
            return {"id": "t1", "name": "Set vertical rebar"}
        if path.endswith("validation-steps"):
            return [{"id": "v1", "approved": True}, {"id": "v2", "approved": False}]
        if path.endswith("entries"):
            return [{"id": "e1"}, {"id": "e2"}]
        raise AssertionError(path)

    monkeypatch.setattr(server, "_request", fake_request)
    result = await server.task_details("t1", recent_entries_limit=1, response_format=server.ResponseFormat.JSON)
    assert '"id": "v1"' in result
    assert '"id": "v2"' not in result
    assert '"id": "e1"' in result
    assert '"id": "e2"' not in result


@pytest.mark.asyncio
async def test_write_gate_blocks_mutation(monkeypatch):
    monkeypatch.setenv("SOMETHING_BETTER_WRITES_ENABLED", "false")
    with pytest.raises(RuntimeError, match="Writes are disabled"):
        await server.create_job("Test Job")


@pytest.mark.asyncio
async def test_failed_validation_requires_fix_notes(monkeypatch):
    check = server.ValidationInput(step_id="v1", description="Wall is plumb", status="fail")
    with pytest.raises(RuntimeError, match="needs fix_notes"):
        await server.log_progress(task_id="t1", crew_member="Rusty", validations=[check])


@pytest.mark.asyncio
async def test_log_progress_posts_validated_payload(monkeypatch):
    captured = {}

    async def fake_request(method, path, **kwargs):
        captured.update({"method": method, "path": path, **kwargs})
        return {"id": "e1", "has_failed_check": False}

    monkeypatch.setattr(server, "_request", fake_request)
    check = server.ValidationInput(step_id="v1", description="Wall is plumb", status="pass")
    result = await server.log_progress(
        task_id="t1", crew_member="Rusty", role="Foreman", hours=2.5, qty_completed=80, validations=[check]
    )
    assert result["id"] == "e1"
    assert captured["method"] == "POST"
    assert captured["path"] == "/tasks/t1/entries"
    assert captured["json_body"]["hours"] == 2.5
    assert captured["json_body"]["validations"][0]["status"] == "pass"


@pytest.mark.asyncio
async def test_job_activity_filters_failures(monkeypatch):
    async def fake_request(method, path, **kwargs):
        assert (method, path) == ("GET", "/jobs/j1/entries")
        return [
            {"id": "e1", "crew_member": "Rusty", "has_failed_check": True},
            {"id": "e2", "crew_member": "Rusty", "has_failed_check": False},
            {"id": "e3", "crew_member": "Cody", "has_failed_check": True},
        ]

    monkeypatch.setattr(server, "_request", fake_request)
    result = await server.job_activity(
        "j1", crew_member="Rusty", failures_only=True, limit=25, offset=0, response_format=server.ResponseFormat.JSON
    )
    assert '"id": "e1"' in result
    assert '"id": "e2"' not in result
    assert '"id": "e3"' not in result
