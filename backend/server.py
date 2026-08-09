"""PLUMBLINE — ICF Validation-Driven Field Management System Backend."""
from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import base64
import json
import uuid
import io
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta

from emergentintegrations.llm.chat import LlmChat, UserMessage

from seed_tasks import TASK_TEMPLATES, DEFAULT_VALIDATION_STEPS, COMMON_MISTAKES
from exports import build_recap_xlsx, build_recap_pdf, parse_xlsx_for_import, parse_csv_for_import
from importer import parse_and_map_tasks

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ── DB ─────────────────────────────────────────────────────────────
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

app = FastAPI(title="PLUMBLINE API")
api_router = APIRouter(prefix="/api")


# ── HELPERS ─────────────────────────────────────────────────────────
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


# ── MODELS ─────────────────────────────────────────────────────────
class Job(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    name: str
    location: str = ""
    client: str = ""
    start_date: str = Field(default_factory=now_iso)
    status: Literal["planning", "active", "complete", "paused"] = "active"
    budget_hours: float = 0.0
    cover_image: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class Task(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    job_id: str
    name: str
    category: str
    course: str = "all"  # 1st / 2nd / 3rd / 4th / 5th / all
    unit: Optional[str] = None
    estimated_hours: Optional[float] = None
    estimated_qty: Optional[float] = None
    actual_hours: float = 0.0
    actual_qty: float = 0.0
    status: Literal["not_started", "in_progress", "validated", "rework"] = "not_started"
    sort_order: int = 0
    created_at: str = Field(default_factory=now_iso)


class ValidationStep(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    task_id: str
    description: str
    requires_photo: bool = False
    source: Literal["manual", "ai_suggested", "ai_approved", "default"] = "manual"
    approved: bool = True
    order: int = 0
    created_at: str = Field(default_factory=now_iso)


class ValidationCheck(BaseModel):
    step_id: str
    description: str
    status: Literal["pass", "fail", "skipped"]
    photo_b64: Optional[str] = None  # data url string
    fix_notes: Optional[str] = None
    timestamp: str = Field(default_factory=now_iso)


class TaskEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    task_id: str
    job_id: str
    crew_member: str
    role: Literal["Foreman", "Installer", "Apprentice", "Laborer", "Forklift"] = "Installer"
    hours: float = 0.0
    qty_completed: float = 0.0
    notes: str = ""
    validations: List[ValidationCheck] = []
    has_failed_check: bool = False
    created_at: str = Field(default_factory=now_iso)


class CommonMistake(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    task_id: Optional[str] = None
    category: Optional[str] = None
    title: str
    fix: str


# ── REQUEST/RESPONSE BODIES ────────────────────────────────────────
class JobCreate(BaseModel):
    name: str
    location: str = ""
    client: str = ""
    budget_hours: float = 0.0


class ValidationStepCreate(BaseModel):
    description: str
    requires_photo: bool = False
    source: Literal["manual", "ai_suggested", "ai_approved", "default"] = "manual"
    approved: bool = True


class ValidationStepPatch(BaseModel):
    description: Optional[str] = None
    requires_photo: Optional[bool] = None
    approved: Optional[bool] = None


class TaskEntryCreate(BaseModel):
    crew_member: str
    role: Literal["Foreman", "Installer", "Apprentice", "Laborer", "Forklift"] = "Installer"
    hours: float = 0.0
    qty_completed: float = 0.0
    notes: str = ""
    validations: List[ValidationCheck] = []


class FixSuggestionRequest(BaseModel):
    task_name: str
    task_category: str
    failed_check: str
    notes: str = ""


# ── ADMIN MODELS ───────────────────────────────────────────────────
class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "global"
    rework_cost_per_check: float = 850.0
    photo_audit_value: float = 75.0
    ai_model: str = "claude-sonnet-4-6"
    company_name: str = "Titan ICF"
    updated_at: str = Field(default_factory=now_iso)


class SettingsUpdate(BaseModel):
    rework_cost_per_check: Optional[float] = None
    photo_audit_value: Optional[float] = None
    ai_model: Optional[str] = None
    company_name: Optional[str] = None


class JobUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    client: Optional[str] = None
    status: Optional[Literal["planning", "active", "complete", "paused"]] = None
    budget_hours: Optional[float] = None
    cover_image: Optional[str] = None


class TaskCreate(BaseModel):
    name: str
    category: str
    course: str = "all"
    unit: Optional[str] = None
    estimated_hours: Optional[float] = None
    estimated_qty: Optional[float] = None


class TaskUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    course: Optional[str] = None
    unit: Optional[str] = None
    estimated_hours: Optional[float] = None
    estimated_qty: Optional[float] = None
    status: Optional[Literal["not_started", "in_progress", "validated", "rework"]] = None


class CommonMistakeCreate(BaseModel):
    title: str
    fix: str
    category: Optional[str] = None
    task_id: Optional[str] = None


async def get_settings() -> Settings:
    doc = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not doc:
        s = Settings()
        await db.settings.insert_one(s.model_dump())
        return s
    return Settings(**doc)


# ── LLM HELPERS ────────────────────────────────────────────────────
async def llm_chat(system: str, user: str, session_id: str) -> str:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system,
    ).with_model("anthropic", "claude-sonnet-4-6")
    resp = await chat.send_message(UserMessage(text=user))
    return resp if isinstance(resp, str) else str(resp)


# ── ROUTES ─────────────────────────────────────────────────────────
@api_router.get("/")
async def root():
    return {"app": "PLUMBLINE", "status": "online"}


# ── JOBS ───────────────────────────────────────────────────────────
@api_router.get("/jobs", response_model=List[Job])
async def list_jobs():
    docs = await db.jobs.find({}, {"_id": 0}).to_list(500)
    return [Job(**d) for d in docs]


@api_router.get("/jobs/{job_id}", response_model=Job)
async def get_job(job_id: str):
    doc = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Job not found")
    return Job(**doc)


@api_router.post("/jobs", response_model=Job)
async def create_job(payload: JobCreate):
    job = Job(**payload.model_dump())
    await db.jobs.insert_one(job.model_dump())
    return job


@api_router.patch("/jobs/{job_id}", response_model=Job)
async def update_job(job_id: str, payload: JobUpdate):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(400, "No fields")
    result = await db.jobs.find_one_and_update(
        {"id": job_id}, {"$set": update}, return_document=True, projection={"_id": 0}
    )
    if not result:
        raise HTTPException(404, "Job not found")
    return Job(**result)


@api_router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    await db.jobs.delete_one({"id": job_id})
    # cascade
    tasks = await db.tasks.find({"job_id": job_id}, {"id": 1, "_id": 0}).to_list(5000)
    task_ids = [t["id"] for t in tasks]
    await db.tasks.delete_many({"job_id": job_id})
    if task_ids:
        await db.validation_steps.delete_many({"task_id": {"$in": task_ids}})
    await db.task_entries.delete_many({"job_id": job_id})
    return {"ok": True}


# ── TASKS ──────────────────────────────────────────────────────────
@api_router.get("/jobs/{job_id}/tasks", response_model=List[Task])
async def list_tasks(job_id: str):
    docs = await db.tasks.find({"job_id": job_id}, {"_id": 0}).sort("sort_order", 1).to_list(2000)
    return [Task(**d) for d in docs]


@api_router.get("/tasks/{task_id}", response_model=Task)
async def get_task(task_id: str):
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Task not found")
    return Task(**doc)


@api_router.post("/jobs/{job_id}/tasks", response_model=Task)
async def create_task(job_id: str, payload: TaskCreate):
    if not await db.jobs.find_one({"id": job_id}, {"_id": 0}):
        raise HTTPException(404, "Job not found")
    last = await db.tasks.count_documents({"job_id": job_id})
    task = Task(job_id=job_id, sort_order=last, **payload.model_dump())
    await db.tasks.insert_one(task.model_dump())
    return task


@api_router.patch("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, payload: TaskUpdate):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(400, "No fields")
    result = await db.tasks.find_one_and_update(
        {"id": task_id}, {"$set": update}, return_document=True, projection={"_id": 0}
    )
    if not result:
        raise HTTPException(404, "Task not found")
    return Task(**result)


@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    await db.tasks.delete_one({"id": task_id})
    await db.validation_steps.delete_many({"task_id": task_id})
    await db.task_entries.delete_many({"task_id": task_id})
    return {"ok": True}


# ── SETTINGS ───────────────────────────────────────────────────────
@api_router.get("/settings", response_model=Settings)
async def read_settings():
    return await get_settings()


@api_router.patch("/settings", response_model=Settings)
async def update_settings(payload: SettingsUpdate):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(400, "No fields")
    update["updated_at"] = now_iso()
    await db.settings.update_one({"id": "global"}, {"$set": update}, upsert=True)
    return await get_settings()


# ── COMMON MISTAKES CRUD ───────────────────────────────────────────
@api_router.post("/common-mistakes", response_model=CommonMistake)
async def create_common_mistake(payload: CommonMistakeCreate):
    cm = CommonMistake(**payload.model_dump())
    await db.common_mistakes.insert_one(cm.model_dump())
    return cm


@api_router.delete("/common-mistakes/{cm_id}")
async def delete_common_mistake(cm_id: str):
    await db.common_mistakes.delete_one({"id": cm_id})
    return {"ok": True}


# ── DANGER ZONE ────────────────────────────────────────────────────
@api_router.post("/admin/reset")
async def admin_reset(keep_settings: bool = True):
    """Wipes all jobs, tasks, validation steps, entries, common mistakes. Re-seeds Walls Abilene."""
    await db.jobs.delete_many({})
    await db.tasks.delete_many({})
    await db.validation_steps.delete_many({})
    await db.task_entries.delete_many({})
    await db.common_mistakes.delete_many({})
    if not keep_settings:
        await db.settings.delete_many({})
    # re-seed
    return await seed_demo(force=True)


# ── VALIDATION STEPS ───────────────────────────────────────────────
@api_router.get("/tasks/{task_id}/validation-steps", response_model=List[ValidationStep])
async def list_validation_steps(task_id: str):
    docs = await db.validation_steps.find({"task_id": task_id}, {"_id": 0}).sort("order", 1).to_list(200)
    return [ValidationStep(**d) for d in docs]


@api_router.post("/tasks/{task_id}/validation-steps", response_model=ValidationStep)
async def create_validation_step(task_id: str, payload: ValidationStepCreate):
    task_doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task_doc:
        raise HTTPException(404, "Task not found")
    count = await db.validation_steps.count_documents({"task_id": task_id})
    step = ValidationStep(task_id=task_id, order=count, **payload.model_dump())
    await db.validation_steps.insert_one(step.model_dump())
    return step


@api_router.patch("/validation-steps/{step_id}", response_model=ValidationStep)
async def update_validation_step(step_id: str, payload: ValidationStepPatch):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(400, "No fields to update")
    result = await db.validation_steps.find_one_and_update(
        {"id": step_id}, {"$set": update}, return_document=True, projection={"_id": 0}
    )
    if not result:
        raise HTTPException(404, "Step not found")
    return ValidationStep(**result)


@api_router.delete("/validation-steps/{step_id}")
async def delete_validation_step(step_id: str):
    result = await db.validation_steps.delete_one({"id": step_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Step not found")
    return {"ok": True}


@api_router.post("/tasks/{task_id}/validation-steps/generate")
async def ai_generate_validation_steps(task_id: str):
    """AI generates suggested validation steps for this task (saved as ai_suggested, NOT auto-approved)."""
    task_doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task_doc:
        raise HTTPException(404, "Task not found")
    task = Task(**task_doc)

    system = (
        "You are a senior ICF (Insulated Concrete Forms) construction foreman. "
        "When given a specific ICF task, you generate 4-6 concise verifiable validation steps "
        "that a field crew member can self-check as they finish the task. Each step must be specific, "
        "actionable, and rooted in real ICF best-practice. Output ONLY valid JSON in this exact format: "
        '{"steps":[{"description":"...","requires_photo":true_or_false}, ...]}.'
        " Mark requires_photo=true for steps where visual proof prevents the most common rework "
        "(plumb, level, dimensions, rebar spacing, lap length, final wall state)."
    )
    user_msg = (
        f"Task: {task.name}\nCategory: {task.category}\nCourse/Level: {task.course}\n"
        f"Unit: {task.unit or 'N/A'}\nGenerate validation checklist."
    )
    try:
        raw = await llm_chat(system, user_msg, f"validation-gen-{task_id}")
        # extract JSON
        start = raw.find("{")
        end = raw.rfind("}")
        if start == -1 or end == -1:
            raise ValueError("No JSON in LLM response")
        parsed = json.loads(raw[start : end + 1])
        steps_data = parsed.get("steps", [])
    except Exception as e:
        logging.exception("LLM validation gen failed")
        raise HTTPException(500, f"AI generation failed: {e}")

    # save as ai_suggested (NOT yet approved — manager must approve)
    created = []
    base_order = await db.validation_steps.count_documents({"task_id": task_id})
    for i, s in enumerate(steps_data):
        step = ValidationStep(
            task_id=task_id,
            description=s.get("description", "").strip(),
            requires_photo=bool(s.get("requires_photo", False)),
            source="ai_suggested",
            approved=False,
            order=base_order + i,
        )
        await db.validation_steps.insert_one(step.model_dump())
        created.append(step.model_dump())
    return {"created": created}


@api_router.post("/validation/fix-suggestion")
async def ai_fix_suggestion(payload: FixSuggestionRequest):
    system = (
        "You are a senior ICF construction foreman helping a field crew member fix a failed check. "
        "Respond with a SHORT, actionable fix — 2-4 sentences, plain English, no fluff. "
        "Mention exact tools, measurements, or sequence. Do not preface with 'sure' or 'great question'."
    )
    user = (
        f"Task: {payload.task_name} ({payload.task_category})\n"
        f"Failed check: {payload.failed_check}\n"
        f"Crew notes: {payload.notes or '(none)'}\n"
        "Give me the fix."
    )
    try:
        fix = await llm_chat(system, user, f"fix-{uuid.uuid4()}")
        return {"fix": fix.strip()}
    except Exception as e:
        logging.exception("Fix-suggestion failed")
        raise HTTPException(500, f"AI failed: {e}")


# ── TASK ENTRIES (production + validations) ────────────────────────
@api_router.get("/tasks/{task_id}/entries", response_model=List[TaskEntry])
async def list_entries(task_id: str):
    docs = await db.task_entries.find({"task_id": task_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [TaskEntry(**d) for d in docs]


@api_router.get("/jobs/{job_id}/entries", response_model=List[TaskEntry])
async def list_job_entries(job_id: str):
    docs = await db.task_entries.find({"job_id": job_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [TaskEntry(**d) for d in docs]


@api_router.post("/tasks/{task_id}/entries", response_model=TaskEntry)
async def create_entry(task_id: str, payload: TaskEntryCreate):
    task_doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task_doc:
        raise HTTPException(404, "Task not found")
    task = Task(**task_doc)
    has_failed = any(v.status == "fail" for v in payload.validations)
    entry = TaskEntry(
        task_id=task_id,
        job_id=task.job_id,
        has_failed_check=has_failed,
        **payload.model_dump(),
    )
    await db.task_entries.insert_one(entry.model_dump())

    # update task aggregates + status
    new_actual_hours = task.actual_hours + payload.hours
    new_actual_qty = task.actual_qty + payload.qty_completed
    new_status = task.status
    if has_failed:
        new_status = "rework"
    elif payload.validations and all(v.status == "pass" for v in payload.validations):
        # only mark validated when there ARE validation checks and all passed
        # AND quantity has met estimate (if estimate set)
        if task.estimated_qty and new_actual_qty >= task.estimated_qty:
            new_status = "validated"
        else:
            new_status = "in_progress"
    elif new_actual_hours > 0 or new_actual_qty > 0:
        new_status = "in_progress" if new_status != "rework" else "rework"

    await db.tasks.update_one(
        {"id": task_id},
        {"$set": {
            "actual_hours": new_actual_hours,
            "actual_qty": new_actual_qty,
            "status": new_status,
        }},
    )
    return entry


# ── COMMON MISTAKES ────────────────────────────────────────────────
@api_router.get("/common-mistakes")
async def list_common_mistakes(category: Optional[str] = None):
    q = {"category": category} if category else {}
    docs = await db.common_mistakes.find(q, {"_id": 0}).to_list(200)
    return docs


# ── DASHBOARD ──────────────────────────────────────────────────────
@api_router.get("/jobs/{job_id}/dashboard")
async def job_dashboard(job_id: str):
    job_doc = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job_doc:
        raise HTTPException(404, "Job not found")
    tasks = await db.tasks.find({"job_id": job_id}, {"_id": 0}).to_list(2000)
    entries = await db.task_entries.find({"job_id": job_id}, {"_id": 0}).to_list(5000)

    total_est_hours = sum(t.get("estimated_hours") or 0 for t in tasks)
    total_actual_hours = sum(t.get("actual_hours") or 0 for t in tasks)
    earned_hours = 0.0
    for t in tasks:
        est_h = t.get("estimated_hours") or 0
        est_q = t.get("estimated_qty") or 0
        if est_q and est_h:
            pct = min(1.0, (t.get("actual_qty") or 0) / est_q)
            earned_hours += pct * est_h
        elif est_h:
            # task without quantity — earned = pct of hours if status validated
            if t.get("status") == "validated":
                earned_hours += est_h
            elif t.get("status") == "in_progress":
                earned_hours += est_h * 0.5
    ratio = (earned_hours / total_actual_hours) if total_actual_hours > 0 else 0.0

    status_counts = {"not_started": 0, "in_progress": 0, "validated": 0, "rework": 0}
    category_breakdown: dict = {}
    for t in tasks:
        s = t.get("status", "not_started")
        status_counts[s] = status_counts.get(s, 0) + 1
        c = t.get("category", "Other")
        if c not in category_breakdown:
            category_breakdown[c] = {"total": 0, "validated": 0, "rework": 0, "est_hours": 0, "actual_hours": 0}
        category_breakdown[c]["total"] += 1
        if s == "validated":
            category_breakdown[c]["validated"] += 1
        if s == "rework":
            category_breakdown[c]["rework"] += 1
        category_breakdown[c]["est_hours"] += t.get("estimated_hours") or 0
        category_breakdown[c]["actual_hours"] += t.get("actual_hours") or 0

    # weekly trend (last 7 days)
    today = datetime.now(timezone.utc).date()
    daily = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_entries = [e for e in entries if e.get("created_at", "").startswith(day.isoformat())]
        hours = sum(e.get("hours", 0) for e in day_entries)
        qty = sum(e.get("qty_completed", 0) for e in day_entries)
        failed = sum(1 for e in day_entries if e.get("has_failed_check"))
        daily.append({
            "date": day.isoformat(),
            "day_label": day.strftime("%a"),
            "hours": round(hours, 1),
            "qty": round(qty, 1),
            "failed_checks": failed,
        })

    # validation stats
    total_validations = 0
    passed_validations = 0
    failed_validations = 0
    photos_captured = 0
    for e in entries:
        for v in e.get("validations", []):
            total_validations += 1
            if v.get("status") == "pass":
                passed_validations += 1
            elif v.get("status") == "fail":
                failed_validations += 1
            if v.get("photo_b64"):
                photos_captured += 1

    # Rework Cost Saver: every failed check caught in the field = rework dollars NOT spent later.
    # Industry rule-of-thumb: rework caught at install ≈ $250 avg; same defect caught post-pour ≈ 6–10x.
    settings = await get_settings()
    REWORK_COST_PER_CHECK = settings.rework_cost_per_check
    rework_dollars_saved = failed_validations * REWORK_COST_PER_CHECK
    # Photos also count as audit-trail value (defensible against disputes)
    PHOTO_AUDIT_VALUE = settings.photo_audit_value
    audit_value = photos_captured * PHOTO_AUDIT_VALUE

    # 30-day ROI trend: per-day $ saved + cumulative running total
    roi_trend = []
    cumulative = 0
    for i in range(29, -1, -1):
        day = today - timedelta(days=i)
        day_iso = day.isoformat()
        day_failed = 0
        day_photos = 0
        for e in entries:
            if not e.get("created_at", "").startswith(day_iso):
                continue
            for v in e.get("validations", []):
                if v.get("status") == "fail":
                    day_failed += 1
                if v.get("photo_b64"):
                    day_photos += 1
        day_saved = day_failed * REWORK_COST_PER_CHECK + day_photos * PHOTO_AUDIT_VALUE
        cumulative += day_saved
        roi_trend.append({
            "date": day_iso,
            "day_label": day.strftime("%b %d"),
            "short": day.strftime("%d") if day.day != 1 else day.strftime("%b %d"),
            "saved": day_saved,
            "cumulative": cumulative,
            "checks": day_failed,
            "photos": day_photos,
        })

    # rework tasks (with names)
    rework_tasks = [
        {"id": t["id"], "name": t["name"], "category": t.get("category"), "course": t.get("course")}
        for t in tasks if t.get("status") == "rework"
    ][:10]

    # Foreman / Crew Leaderboard
    import math
    crew_stats = {}
    for e in entries:
        name = e.get("crew_member") or "Unknown"
        if name not in crew_stats:
            crew_stats[name] = {
                "name": name, "role": e.get("role", "Installer"),
                "hours": 0.0, "qty": 0.0, "entries": 0,
                "checks_total": 0, "checks_passed": 0, "checks_failed": 0, "photos": 0,
            }
        cs = crew_stats[name]
        cs["hours"] += e.get("hours", 0)
        cs["qty"] += e.get("qty_completed", 0)
        cs["entries"] += 1
        for v in e.get("validations", []):
            cs["checks_total"] += 1
            if v.get("status") == "pass":
                cs["checks_passed"] += 1
            elif v.get("status") == "fail":
                cs["checks_failed"] += 1
            if v.get("photo_b64"):
                cs["photos"] += 1
    leaderboard = []
    for cs in crew_stats.values():
        pr = cs["checks_passed"] / cs["checks_total"] if cs["checks_total"] else 0
        score = pr * 100 + math.log(cs["checks_failed"] + 1) * 12 + math.log(cs["photos"] + 1) * 6
        leaderboard.append({**cs, "pass_rate": round(pr, 2), "score": round(score, 1),
                            "hours": round(cs["hours"], 1), "qty": round(cs["qty"], 1)})
    leaderboard.sort(key=lambda x: x["score"], reverse=True)

    return {
        "job": job_doc,
        "totals": {
            "tasks": len(tasks),
            "estimated_hours": round(total_est_hours, 1),
            "actual_hours": round(total_actual_hours, 1),
            "earned_hours": round(earned_hours, 1),
            "ratio": round(ratio, 2),
            "variance_hours": round(earned_hours - total_actual_hours, 1),
            "production_per_man_per_day": round(earned_hours / max(1, total_actual_hours) * 8, 2),
        },
        "status_counts": status_counts,
        "category_breakdown": category_breakdown,
        "daily_trend": daily,
        "validation_stats": {
            "total": total_validations,
            "passed": passed_validations,
            "failed": failed_validations,
            "photos_captured": photos_captured,
            "pass_rate": round(passed_validations / total_validations, 2) if total_validations else 0,
        },
        "roi": {
            "rework_dollars_saved": rework_dollars_saved,
            "audit_value": audit_value,
            "total_value_protected": rework_dollars_saved + audit_value,
            "cost_per_check": REWORK_COST_PER_CHECK,
            "photo_audit_value": PHOTO_AUDIT_VALUE,
            "checks_caught": failed_validations,
            "trend_30d": roi_trend,
        },
        "rework_tasks": rework_tasks,
        "active_crew": list({e.get("crew_member") for e in entries if e.get("crew_member")}),
        "leaderboard": leaderboard,
    }


# ── SEED ───────────────────────────────────────────────────────────
@api_router.post("/seed")
async def seed_demo(force: bool = False):
    """Seed Walls Abilene Intermediate SS demo job. Idempotent unless force=true."""
    existing = await db.jobs.find_one({"name": "Walls Abilene Intermediate SS"}, {"_id": 0})
    if existing and not force:
        return {"status": "already_seeded", "job_id": existing["id"]}
    if existing and force:
        await db.jobs.delete_many({"name": "Walls Abilene Intermediate SS"})
        await db.tasks.delete_many({"job_id": existing["id"]})
        await db.validation_steps.delete_many({})  # nuke all for clean state
        await db.task_entries.delete_many({"job_id": existing["id"]})

    job = Job(
        name="Walls Abilene Intermediate SS",
        location="Abilene, TX",
        client="Abilene ISD",
        status="active",
        budget_hours=3200.0,
        cover_image="https://images.pexels.com/photos/7108785/pexels-photo-7108785.jpeg",
    )
    await db.jobs.insert_one(job.model_dump())

    sort_idx = 0
    created_tasks = 0
    created_steps = 0
    for (category, name, unit, est_h, est_q, courses) in TASK_TEMPLATES:
        for course in courses:
            full_name = name if course == "all" else f"{course.title()} Course — {name}"
            task = Task(
                job_id=job.id,
                name=full_name,
                category=category,
                course=course,
                unit=unit,
                estimated_hours=est_h,
                estimated_qty=est_q,
                sort_order=sort_idx,
            )
            await db.tasks.insert_one(task.model_dump())
            sort_idx += 1
            created_tasks += 1

            # seed default validation steps for the category
            defaults = DEFAULT_VALIDATION_STEPS.get(category, [])
            for i, (desc, requires_photo) in enumerate(defaults):
                step = ValidationStep(
                    task_id=task.id,
                    description=desc,
                    requires_photo=requires_photo,
                    source="default",
                    approved=True,
                    order=i,
                )
                await db.validation_steps.insert_one(step.model_dump())
                created_steps += 1

    # common mistakes
    await db.common_mistakes.delete_many({})
    for category, mistakes in COMMON_MISTAKES.items():
        for title, fix in mistakes:
            cm = CommonMistake(category=category, title=title, fix=fix)
            await db.common_mistakes.insert_one(cm.model_dump())

    return {
        "status": "seeded",
        "job_id": job.id,
        "tasks": created_tasks,
        "validation_steps": created_steps,
    }


# ── CREW DRILLDOWN ─────────────────────────────────────────────────
@api_router.get("/jobs/{job_id}/crew/{name}/stats")
async def crew_drilldown(job_id: str, name: str):
    """Per-crew member breakdown for a single job."""
    entries = await db.task_entries.find(
        {"job_id": job_id, "crew_member": name}, {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    if not entries:
        return {"name": name, "found": False, "entries": [], "stats": {}, "daily": [], "task_breakdown": []}

    tasks = await db.tasks.find({"job_id": job_id}, {"_id": 0}).to_list(2000)
    task_map = {t["id"]: t for t in tasks}

    total_hours = sum(e.get("hours", 0) for e in entries)
    total_qty = sum(e.get("qty_completed", 0) for e in entries)
    checks_total = checks_passed = checks_failed = photos = 0
    for e in entries:
        for v in e.get("validations", []):
            checks_total += 1
            if v.get("status") == "pass":
                checks_passed += 1
            elif v.get("status") == "fail":
                checks_failed += 1
            if v.get("photo_b64"):
                photos += 1

    # daily for last 14 days
    today = datetime.now(timezone.utc).date()
    daily = []
    for i in range(13, -1, -1):
        day = today - timedelta(days=i)
        day_entries = [e for e in entries if e.get("created_at", "").startswith(day.isoformat())]
        daily.append({
            "date": day.isoformat(),
            "day_label": day.strftime("%a"),
            "short": day.strftime("%b %d"),
            "hours": round(sum(e.get("hours", 0) for e in day_entries), 1),
            "qty": round(sum(e.get("qty_completed", 0) for e in day_entries), 1),
            "entries": len(day_entries),
            "failed_checks": sum(1 for e in day_entries if e.get("has_failed_check")),
        })

    # task breakdown — top tasks by hours spent
    task_agg = {}
    for e in entries:
        tid = e.get("task_id")
        if tid not in task_agg:
            t = task_map.get(tid, {})
            task_agg[tid] = {"task_id": tid, "name": t.get("name", "?"), "category": t.get("category", "?"),
                              "course": t.get("course", "all"), "hours": 0, "qty": 0, "entries": 0}
        task_agg[tid]["hours"] += e.get("hours", 0)
        task_agg[tid]["qty"] += e.get("qty_completed", 0)
        task_agg[tid]["entries"] += 1
    task_breakdown = sorted(task_agg.values(), key=lambda x: x["hours"], reverse=True)
    for t in task_breakdown:
        t["hours"] = round(t["hours"], 1)
        t["qty"] = round(t["qty"], 1)

    # recent entries (last 25, with task names)
    recent = []
    for e in entries[:25]:
        t = task_map.get(e.get("task_id"), {})
        recent.append({
            "id": e.get("id"),
            "task_name": t.get("name", "?"),
            "category": t.get("category", "?"),
            "hours": e.get("hours", 0),
            "qty_completed": e.get("qty_completed", 0),
            "role": e.get("role"),
            "has_failed_check": e.get("has_failed_check"),
            "validations_count": len(e.get("validations", [])),
            "photos_count": sum(1 for v in e.get("validations", []) if v.get("photo_b64")),
            "created_at": e.get("created_at"),
            "notes": e.get("notes", ""),
        })

    pass_rate = checks_passed / checks_total if checks_total else 0
    return {
        "name": name,
        "found": True,
        "role": entries[0].get("role") if entries else None,
        "stats": {
            "total_hours": round(total_hours, 1),
            "total_qty": round(total_qty, 1),
            "entries": len(entries),
            "checks_total": checks_total,
            "checks_passed": checks_passed,
            "checks_failed": checks_failed,
            "photos": photos,
            "pass_rate": round(pass_rate, 2),
        },
        "daily": daily,
        "task_breakdown": task_breakdown[:15],
        "recent": recent,
    }


# ── EXPORTS ────────────────────────────────────────────────────────
async def _gather_job_data(job_id: str):
    job_doc = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job_doc:
        raise HTTPException(404, "Job not found")
    tasks = await db.tasks.find({"job_id": job_id}, {"_id": 0}).sort("sort_order", 1).to_list(5000)
    entries = await db.task_entries.find({"job_id": job_id}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    dashboard = await job_dashboard(job_id)
    return job_doc, tasks, entries, dashboard


@api_router.get("/jobs/{job_id}/export/xlsx")
async def export_xlsx(job_id: str):
    job, tasks, entries, dashboard = await _gather_job_data(job_id)
    data = build_recap_xlsx(job, tasks, entries, dashboard)
    fname = f"PLUMBLINE-{job['name'].replace(' ', '_')}.xlsx"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@api_router.get("/jobs/{job_id}/export/pdf")
async def export_pdf(job_id: str):
    job, tasks, entries, dashboard = await _gather_job_data(job_id)
    data = build_recap_pdf(job, tasks, entries, dashboard)
    fname = f"PLUMBLINE-{job['name'].replace(' ', '_')}.pdf"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


# ── DETERMINISTIC IMPORT (NO AI) ───────────────────────────────────
class ImportedTask(BaseModel):
    name: str
    category: str = "Other"
    course: str = "all"
    unit: Optional[str] = None
    estimated_hours: Optional[float] = None
    estimated_qty: Optional[float] = None


class ImportCommitRequest(BaseModel):
    name: str
    location: str = ""
    client: str = ""
    budget_hours: float = 0.0
    tasks: List[ImportedTask]


@api_router.post("/admin/import/preview")
async def import_preview(
    file: UploadFile = File(...),
    task_col: Optional[str] = None,
    hours_col: Optional[str] = None,
    qty_col: Optional[str] = None,
):
    """Parse a CSV or XLSX and return the deterministic task mapping — no DB writes.

    Optional query params `task_col`, `hours_col`, `qty_col` override auto-detection with a specific column header name.
    Response: {tasks, stats, detected_columns, sheets}
    """
    content = await file.read()
    try:
        result = parse_and_map_tasks(
            content, file.filename or "", max_tasks=1000,
            task_col_override=task_col,
            hours_col_override=hours_col,
            qty_col_override=qty_col,
        )
    except Exception as e:
        raise HTTPException(400, f"Could not parse file: {e}")
    if not result["tasks"]:
        raise HTTPException(400, "No task rows found in file. Try picking a different Task Name column.")
    return result


@api_router.post("/admin/import/commit")
async def import_commit(payload: ImportCommitRequest):
    """Create a new Job + the provided tasks + default validation steps for each."""
    if not payload.name.strip():
        raise HTTPException(400, "Job name is required")
    if not payload.tasks:
        raise HTTPException(400, "No tasks to import")

    job = Job(
        name=payload.name.strip(),
        location=payload.location,
        client=payload.client,
        status="active",
        budget_hours=payload.budget_hours,
    )
    await db.jobs.insert_one(job.model_dump())

    allowed_cats = {"Precon", "Startup", "Layout", "Install", "Rebar", "Pour", "Strip", "Cleanup", "Other"}
    allowed_courses = {"all", "1st", "2nd", "3rd", "4th", "5th"}
    allowed_units = {"LF", "SF", "EA", "HRS", "%"}

    created = 0
    for i, t in enumerate(payload.tasks):
        cat = t.category if t.category in allowed_cats else "Other"
        crs = t.course if t.course in allowed_courses else "all"
        unit = t.unit if t.unit in allowed_units else None
        task = Task(
            job_id=job.id,
            name=(t.name or "Unnamed task")[:200],
            category=cat,
            course=crs,
            unit=unit,
            estimated_hours=t.estimated_hours,
            estimated_qty=t.estimated_qty,
            sort_order=i,
        )
        await db.tasks.insert_one(task.model_dump())
        created += 1
        for j, (desc, requires_photo) in enumerate(DEFAULT_VALIDATION_STEPS.get(cat, [])):
            step = ValidationStep(
                task_id=task.id, description=desc, requires_photo=requires_photo,
                source="default", approved=True, order=j,
            )
            await db.validation_steps.insert_one(step.model_dump())

    return {"status": "imported", "job_id": job.id, "tasks": created}


# ── REGISTER ───────────────────────────────────────────────────────
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
