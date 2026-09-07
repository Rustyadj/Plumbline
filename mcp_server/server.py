#!/usr/bin/env python3
"""MCP adapter that lets Hermes operate the Something Better/PLUMBLINE API."""

from __future__ import annotations

import json
import os
from enum import Enum
from typing import Annotated, Any, Literal
from urllib.parse import quote

import httpx
from mcp.server import MCPServer
from mcp.types import ToolAnnotations
from pydantic import BaseModel, ConfigDict, Field

CHARACTER_LIMIT = 25_000
DEFAULT_TIMEOUT_SECONDS = 30.0
API_URL_ENV = "SOMETHING_BETTER_API_URL"
API_TOKEN_ENV = "SOMETHING_BETTER_API_TOKEN"
WRITES_ENABLED_ENV = "SOMETHING_BETTER_WRITES_ENABLED"


class ResponseFormat(str, Enum):
    JSON = "json"
    MARKDOWN = "markdown"


class ValidationInput(BaseModel):
    """One completed validation check attached to a production entry."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    step_id: str = Field(min_length=1, max_length=100, description="Validation-step UUID from task details.")
    description: str = Field(min_length=1, max_length=500, description="Exact validation-step description.")
    status: Literal["pass", "fail", "skipped"] = Field(description="Observed result of this check.")
    fix_notes: str | None = Field(default=None, max_length=2_000, description="Required corrective-action notes when a check fails.")


mcp = MCPServer(
    "something_better_mcp",
    instructions=(
        "Operate the Something Better (PLUMBLINE) ICF field-management app. "
        "Resolve human names to IDs with list tools before writing. Never invent IDs, measurements, "
        "hours, quantities, validation outcomes, or crew names. Do not mark a validation passed unless "
        "the user or field record explicitly confirms it. No delete/reset tools are exposed."
    ),
)


def _base_url() -> str:
    value = os.getenv(API_URL_ENV, "").strip().rstrip("/")
    if not value:
        raise RuntimeError(
            f"{API_URL_ENV} is not configured. Set it to the deployed API root, for example "
            "https://plumbline.example.com/api."
        )
    if not value.startswith(("http://", "https://")):
        raise RuntimeError(f"{API_URL_ENV} must start with http:// or https://.")
    return value


def _headers() -> dict[str, str]:
    token = os.getenv(API_TOKEN_ENV, "").strip()
    return {"Authorization": f"Bearer {token}"} if token else {}


def _writes_enabled() -> bool:
    return os.getenv(WRITES_ENABLED_ENV, "false").strip().lower() in {"1", "true", "yes", "on"}


def _require_writes() -> None:
    if not _writes_enabled():
        raise RuntimeError(
            f"Writes are disabled. Set {WRITES_ENABLED_ENV}=true in Nathan2's private Hermes environment "
            "after verifying the API URL."
        )


async def _request(method: str, path: str, *, params: dict[str, Any] | None = None, json_body: Any = None) -> Any:
    """Call the PLUMBLINE API and turn failures into actionable, secret-safe errors."""
    url = f"{_base_url()}/{path.lstrip('/')}"
    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT_SECONDS, follow_redirects=True) as client:
            response = await client.request(method, url, params=params, json=json_body, headers=_headers())
            response.raise_for_status()
    except httpx.TimeoutException as exc:
        raise RuntimeError("Something Better timed out. Retry once, then verify the API URL and service health.") from exc
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        if status in {401, 403}:
            message = "Something Better rejected the credentials. Verify the API token configured for Nathan2."
        elif status == 404:
            message = "The requested Something Better record was not found. Refresh IDs with a list/search tool."
        elif status == 409:
            message = "Something Better rejected the change because the record conflicts with current state. Refresh it and retry."
        elif status == 422:
            message = "Something Better rejected the supplied fields. Check allowed statuses, roles, units, and numeric values."
        elif status == 429:
            message = "Something Better rate-limited the request. Wait briefly and retry."
        else:
            message = f"Something Better API failed with HTTP {status}. Check service logs before retrying a write."
        raise RuntimeError(message) from exc
    except httpx.RequestError as exc:
        raise RuntimeError("Could not reach Something Better. Verify the API URL, DNS, TLS, and deployment health.") from exc

    if not response.content:
        return {"ok": True}
    try:
        return response.json()
    except ValueError as exc:
        raise RuntimeError("Something Better returned a non-JSON response; verify the API root ends in /api.") from exc


def _page(items: list[dict[str, Any]], *, offset: int, limit: int, item_key: str) -> dict[str, Any]:
    total = len(items)
    selected = items[offset : offset + limit]
    next_offset = offset + len(selected)
    return {
        "total_count": total,
        "count": len(selected),
        "offset": offset,
        item_key: selected,
        "has_more": next_offset < total,
        "next_offset": next_offset if next_offset < total else None,
    }


def _render(data: dict[str, Any], response_format: ResponseFormat, *, title: str) -> str:
    raw = json.dumps(data, indent=2, ensure_ascii=False)
    if len(raw) > CHARACTER_LIMIT:
        raise RuntimeError("Result is too large. Narrow the filters or lower limit before retrying.")
    if response_format == ResponseFormat.JSON:
        return raw
    lines = [f"# {title}", ""]
    for key, value in data.items():
        label = key.replace("_", " ").title()
        if isinstance(value, list):
            lines.append(f"## {label} ({len(value)})")
            for item in value:
                lines.append(f"- {json.dumps(item, ensure_ascii=False)}")
        elif isinstance(value, dict):
            lines.append(f"## {label}")
            for child_key, child_value in value.items():
                lines.append(f"- **{child_key.replace('_', ' ').title()}**: {child_value}")
        else:
            lines.append(f"- **{label}**: {value}")
    rendered = "\n".join(lines)
    if len(rendered) > CHARACTER_LIMIT:
        raise RuntimeError("Result is too large. Narrow the filters or lower limit before retrying.")
    return rendered


READ_ONLY = ToolAnnotations(read_only_hint=True, open_world_hint=True)
WRITE = ToolAnnotations(read_only_hint=False, destructive_hint=False, idempotent_hint=False, open_world_hint=True)
UPDATE = ToolAnnotations(read_only_hint=False, destructive_hint=False, idempotent_hint=True, open_world_hint=True)


@mcp.tool(name="something_better_health", title="Check Something Better", annotations=READ_ONLY)
async def health() -> dict[str, Any]:
    """Check whether Nathan2 can reach the configured Something Better API."""
    return await _request("GET", "/")


@mcp.tool(name="something_better_list_jobs", title="List Something Better Jobs", annotations=READ_ONLY, structured_output=False)
async def list_jobs(
    status: Literal["planning", "active", "complete", "paused"] | None = None,
    query: Annotated[str | None, Field(max_length=200, description="Case-insensitive job, client, or location search.")] = None,
    limit: Annotated[int, Field(ge=1, le=50, description="Maximum jobs to return.")] = 20,
    offset: Annotated[int, Field(ge=0, description="Jobs to skip for pagination.")] = 0,
    response_format: ResponseFormat = ResponseFormat.MARKDOWN,
) -> str:
    """List and resolve jobs before calling job-specific tools. Returns job IDs required by other tools."""
    jobs = await _request("GET", "/jobs")
    if status:
        jobs = [job for job in jobs if job.get("status") == status]
    if query:
        needle = query.casefold()
        jobs = [job for job in jobs if needle in " ".join(str(job.get(k, "")) for k in ("name", "client", "location")).casefold()]
    data = _page(jobs, offset=offset, limit=limit, item_key="jobs")
    return _render(data, response_format, title="Something Better Jobs")


@mcp.tool(name="something_better_job_overview", title="Get Job Overview", annotations=READ_ONLY, structured_output=False)
async def job_overview(
    job_id: Annotated[str, Field(min_length=1, max_length=100, description="Exact job UUID from something_better_list_jobs.")],
    response_format: ResponseFormat = ResponseFormat.MARKDOWN,
) -> str:
    """Get a job's dashboard: production, budget variance, validation pass rate, rework, ROI, and crew ranking."""
    data = await _request("GET", f"/jobs/{job_id}/dashboard")
    return _render(data, response_format, title=f"Job Overview: {data.get('job', {}).get('name', job_id)}")


@mcp.tool(name="something_better_list_tasks", title="List Something Better Tasks", annotations=READ_ONLY, structured_output=False)
async def list_tasks(
    job_id: Annotated[str, Field(min_length=1, max_length=100, description="Exact job UUID from something_better_list_jobs.")],
    status: Literal["not_started", "in_progress", "validated", "rework"] | None = None,
    category: Annotated[str | None, Field(max_length=100, description="Exact category such as Install, Rebar, or Pour.")] = None,
    query: Annotated[str | None, Field(max_length=200, description="Case-insensitive task-name search.")] = None,
    limit: Annotated[int, Field(ge=1, le=100, description="Maximum tasks to return.")] = 30,
    offset: Annotated[int, Field(ge=0, description="Tasks to skip for pagination.")] = 0,
    response_format: ResponseFormat = ResponseFormat.MARKDOWN,
) -> str:
    """List and filter tasks for one job. Returns task IDs required for details, updates, and production logging."""
    tasks = await _request("GET", f"/jobs/{job_id}/tasks")
    if status:
        tasks = [task for task in tasks if task.get("status") == status]
    if category:
        tasks = [task for task in tasks if str(task.get("category", "")).casefold() == category.casefold()]
    if query:
        needle = query.casefold()
        tasks = [task for task in tasks if needle in str(task.get("name", "")).casefold()]
    data = _page(tasks, offset=offset, limit=limit, item_key="tasks")
    return _render(data, response_format, title="Something Better Tasks")


@mcp.tool(name="something_better_task_details", title="Get Task Details", annotations=READ_ONLY, structured_output=False)
async def task_details(
    task_id: Annotated[str, Field(min_length=1, max_length=100, description="Exact task UUID from something_better_list_tasks.")],
    recent_entries_limit: Annotated[int, Field(ge=0, le=25, description="Recent production entries to include; 0 omits entries.")] = 5,
    response_format: ResponseFormat = ResponseFormat.MARKDOWN,
) -> str:
    """Get one task, its approved validation checklist, and optional recent production entries."""
    task = await _request("GET", f"/tasks/{task_id}")
    steps = await _request("GET", f"/tasks/{task_id}/validation-steps")
    entries = await _request("GET", f"/tasks/{task_id}/entries") if recent_entries_limit else []
    data = {
        "task": task,
        "validation_steps": [step for step in steps if step.get("approved", True)],
        "recent_entries": entries[:recent_entries_limit],
    }
    return _render(data, response_format, title=f"Task Details: {task.get('name', task_id)}")


@mcp.tool(name="something_better_crew_stats", title="Get Crew Performance", annotations=READ_ONLY, structured_output=False)
async def crew_stats(
    job_id: Annotated[str, Field(min_length=1, max_length=100, description="Exact job UUID from something_better_list_jobs.")],
    crew_member: Annotated[str, Field(min_length=1, max_length=120, description="Exact crew-member name from the job overview.")],
    response_format: ResponseFormat = ResponseFormat.MARKDOWN,
) -> str:
    """Get one crew member's hours, quantity, pass rate, failures, photos, task breakdown, and recent entries."""
    data = await _request("GET", f"/jobs/{job_id}/crew/{quote(crew_member, safe='')}/stats")
    return _render(data, response_format, title=f"Crew Performance: {crew_member}")


@mcp.tool(name="something_better_job_activity", title="List Job Activity", annotations=READ_ONLY, structured_output=False)
async def job_activity(
    job_id: Annotated[str, Field(min_length=1, max_length=100, description="Exact job UUID from something_better_list_jobs.")],
    crew_member: Annotated[str | None, Field(max_length=120, description="Optional exact crew-member name filter.")] = None,
    failures_only: Annotated[bool, Field(description="Return only entries containing a failed validation check.")] = False,
    limit: Annotated[int, Field(ge=1, le=100, description="Maximum entries to return.")] = 25,
    offset: Annotated[int, Field(ge=0, description="Entries to skip for pagination.")] = 0,
    response_format: ResponseFormat = ResponseFormat.MARKDOWN,
) -> str:
    """List recent field-production entries for a job, optionally filtered by crew member or failed checks."""
    entries = await _request("GET", f"/jobs/{job_id}/entries")
    if crew_member:
        entries = [entry for entry in entries if str(entry.get("crew_member", "")).casefold() == crew_member.casefold()]
    if failures_only:
        entries = [entry for entry in entries if entry.get("has_failed_check")]
    data = _page(entries, offset=offset, limit=limit, item_key="entries")
    return _render(data, response_format, title="Job Activity")


@mcp.tool(name="something_better_common_mistakes", title="List Common ICF Mistakes", annotations=READ_ONLY, structured_output=False)
async def common_mistakes(
    category: Annotated[str | None, Field(max_length=100, description="Optional exact task category such as Install, Rebar, or Pour.")] = None,
    response_format: ResponseFormat = ResponseFormat.MARKDOWN,
) -> str:
    """List approved common ICF mistakes and corrective guidance, optionally for one category."""
    data = await _request("GET", "/common-mistakes", params={"category": category} if category else None)
    return _render({"mistakes": data}, response_format, title="Common ICF Mistakes")


@mcp.tool(name="something_better_create_job", title="Create Something Better Job", annotations=WRITE)
async def create_job(
    name: Annotated[str, Field(min_length=1, max_length=200, description="Job name exactly as the team should see it.")],
    location: Annotated[str, Field(max_length=300, description="Jobsite city/address text.")] = "",
    client: Annotated[str, Field(max_length=200, description="Client/company name.")] = "",
    budget_hours: Annotated[float, Field(ge=0, le=1_000_000, description="Approved labor-hour budget.")] = 0.0,
) -> dict[str, Any]:
    """Create a job after the user supplies its name. This does not import or create tasks."""
    _require_writes()
    return await _request("POST", "/jobs", json_body={"name": name, "location": location, "client": client, "budget_hours": budget_hours})


@mcp.tool(name="something_better_create_task", title="Create Something Better Task", annotations=WRITE)
async def create_task(
    job_id: Annotated[str, Field(min_length=1, max_length=100, description="Exact job UUID from something_better_list_jobs.")],
    name: Annotated[str, Field(min_length=1, max_length=200, description="Specific field task name.")],
    category: Annotated[str, Field(min_length=1, max_length=100, description="Task category such as Install, Rebar, or Pour.")],
    course: Annotated[str, Field(max_length=30, description="all, 1st, 2nd, 3rd, 4th, or 5th.")] = "all",
    unit: Literal["LF", "SF", "EA", "HRS", "%"] | None = None,
    estimated_hours: Annotated[float | None, Field(ge=0, le=1_000_000)] = None,
    estimated_qty: Annotated[float | None, Field(ge=0, le=1_000_000_000)] = None,
) -> dict[str, Any]:
    """Create one task in an existing job. Resolve the job ID first; never guess estimates."""
    _require_writes()
    payload = {"name": name, "category": category, "course": course, "unit": unit, "estimated_hours": estimated_hours, "estimated_qty": estimated_qty}
    return await _request("POST", f"/jobs/{job_id}/tasks", json_body=payload)


@mcp.tool(name="something_better_update_job", title="Update Something Better Job", annotations=UPDATE)
async def update_job(
    job_id: Annotated[str, Field(min_length=1, max_length=100, description="Exact job UUID from something_better_list_jobs.")],
    name: Annotated[str | None, Field(min_length=1, max_length=200)] = None,
    location: Annotated[str | None, Field(max_length=300)] = None,
    client: Annotated[str | None, Field(max_length=200)] = None,
    status: Literal["planning", "active", "complete", "paused"] | None = None,
    budget_hours: Annotated[float | None, Field(ge=0, le=1_000_000)] = None,
) -> dict[str, Any]:
    """Update only supplied job fields. Read the job first and do not infer completion or budget values."""
    _require_writes()
    payload = {k: v for k, v in {"name": name, "location": location, "client": client, "status": status, "budget_hours": budget_hours}.items() if v is not None}
    if not payload:
        raise RuntimeError("No job changes supplied. Provide at least one field.")
    return await _request("PATCH", f"/jobs/{job_id}", json_body=payload)


@mcp.tool(name="something_better_update_task", title="Update Something Better Task", annotations=UPDATE)
async def update_task(
    task_id: Annotated[str, Field(min_length=1, max_length=100, description="Exact task UUID from something_better_list_tasks.")],
    status: Literal["not_started", "in_progress", "validated", "rework"] | None = None,
    estimated_hours: Annotated[float | None, Field(ge=0, le=1_000_000)] = None,
    estimated_qty: Annotated[float | None, Field(ge=0, le=1_000_000_000)] = None,
) -> dict[str, Any]:
    """Update a task's status or estimates. Never mark validated without explicit field confirmation."""
    _require_writes()
    payload = {k: v for k, v in {"status": status, "estimated_hours": estimated_hours, "estimated_qty": estimated_qty}.items() if v is not None}
    if not payload:
        raise RuntimeError("No task changes supplied. Provide status or an estimate.")
    return await _request("PATCH", f"/tasks/{task_id}", json_body=payload)


@mcp.tool(name="something_better_log_progress", title="Log Field Production", annotations=WRITE)
async def log_progress(
    task_id: Annotated[str, Field(min_length=1, max_length=100, description="Exact task UUID verified with something_better_task_details.")],
    crew_member: Annotated[str, Field(min_length=1, max_length=120, description="Crew member's real name, supplied by the user or existing record.")],
    role: Literal["Foreman", "Installer", "Apprentice", "Laborer", "Forklift"] = "Installer",
    hours: Annotated[float, Field(ge=0, le=24, description="Actual hours for this entry; never estimate or infer.")] = 0.0,
    qty_completed: Annotated[float, Field(ge=0, le=1_000_000_000, description="Actual completed quantity in the task's unit.")] = 0.0,
    notes: Annotated[str, Field(max_length=4_000, description="Field notes supplied by the user.")] = "",
    validations: Annotated[list[ValidationInput] | None, Field(max_length=50, description="Observed checks from task details. Omit when no checks were actually performed.")] = None,
) -> dict[str, Any]:
    """Record real production and observed validation results. This changes task totals/status and cannot be undone through MCP."""
    _require_writes()
    observed = validations or []
    if hours == 0 and qty_completed == 0 and not notes and not observed:
        raise RuntimeError("Empty progress entry rejected. Supply actual hours, quantity, notes, or observed validations.")
    for check in observed:
        if check.status == "fail" and not check.fix_notes:
            raise RuntimeError(f"Failed validation '{check.description}' needs fix_notes before logging.")
    payload = {
        "crew_member": crew_member,
        "role": role,
        "hours": hours,
        "qty_completed": qty_completed,
        "notes": notes,
        "validations": [check.model_dump(exclude_none=True) for check in observed],
    }
    return await _request("POST", f"/tasks/{task_id}/entries", json_body=payload)


if __name__ == "__main__":
    mcp.run()
