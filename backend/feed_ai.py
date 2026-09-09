"""In-app AI assistant (@bot) powered by the user's own LLM key (BYOK).

LiteLLM provides a provider-neutral interface while tool execution remains in
server.py, which owns the database and application models.
"""
import json
from litellm import acompletion

CATEGORIES = ["Precon", "Startup", "Layout", "Install", "Rebar", "Pour", "Strip", "Cleanup", "Other"]

SYSTEM_PROMPT = (
    "You are {bot_name}, the AI teammate embedded inside PLUMBLINE — a field production + "
    "validation app for ICF (Insulated Concrete Forms) construction crews. You chat inside a "
    "company Live Feed. Coworkers talk to each other here and mention you with your handle to get help.\n\n"
    "You can READ and CHANGE data in the app using the provided tools. Always prefer calling a tool "
    "over guessing. Resolve jobs and tasks by name (case-insensitive, partial match is fine). "
    "If a name is ambiguous or missing, ask a short clarifying question instead of guessing.\n\n"
    "Task categories are exactly: " + ", ".join(CATEGORIES) + ". Courses are like '1st','2nd','all'.\n"
    "Tolerances are free text (e.g. 'Plumb ± 1/4 in', '16 in O.C. ± 1/2 in'). Spec refs like 'S-201 / ACI 318'.\n\n"
    "Be concise and practical, like a jobsite foreman. Confirm what you did in one or two sentences. "
    "When you change something, state the concrete result (e.g. 'Created job \"Grandview\" and added 3 tasks')."
)

TOOLS = [
    {"type": "function", "function": {
        "name": "get_overview",
        "description": "List all jobs (id + name + status), the current ROI settings, and task category counts for a job if given.",
        "parameters": {"type": "object", "properties": {"job": {"type": "string", "description": "optional job name or id to summarize"}}},
    }},
    {"type": "function", "function": {
        "name": "list_tasks",
        "description": "List tasks for a job, optionally filtered by category or status.",
        "parameters": {"type": "object", "properties": {
            "job": {"type": "string"},
            "category": {"type": "string"},
            "status": {"type": "string", "enum": ["not_started", "in_progress", "validated", "rework"]},
        }, "required": ["job"]},
    }},
    {"type": "function", "function": {
        "name": "create_job",
        "description": "Create a new job/project.",
        "parameters": {"type": "object", "properties": {
            "name": {"type": "string"}, "location": {"type": "string"}, "client": {"type": "string"},
        }, "required": ["name"]},
    }},
    {"type": "function", "function": {
        "name": "add_task",
        "description": "Add a task to a job.",
        "parameters": {"type": "object", "properties": {
            "job": {"type": "string"}, "name": {"type": "string"},
            "category": {"type": "string"}, "course": {"type": "string"}, "unit": {"type": "string"},
            "estimated_hours": {"type": "number"}, "estimated_qty": {"type": "number"},
        }, "required": ["job", "name", "category"]},
    }},
    {"type": "function", "function": {
        "name": "add_validation_rule",
        "description": "Add a validation rule (safety-net check) to a task, optionally with an engineering tolerance and spec reference.",
        "parameters": {"type": "object", "properties": {
            "job": {"type": "string"}, "task": {"type": "string"}, "description": {"type": "string"},
            "tolerance": {"type": "string", "description": "e.g. 'Plumb ± 1/4 in'"},
            "spec_reference": {"type": "string"},
            "requires_measurement": {"type": "boolean"}, "unit": {"type": "string"},
            "requires_photo": {"type": "boolean"},
        }, "required": ["job", "task", "description"]},
    }},
    {"type": "function", "function": {
        "name": "recategorize_tasks",
        "description": "Move every task in a job from one category to another (bulk).",
        "parameters": {"type": "object", "properties": {
            "job": {"type": "string"}, "from_category": {"type": "string"}, "to_category": {"type": "string"},
        }, "required": ["job", "from_category", "to_category"]},
    }},
    {"type": "function", "function": {
        "name": "update_roi_settings",
        "description": "Update global ROI / cost settings.",
        "parameters": {"type": "object", "properties": {
            "rework_cost_per_check": {"type": "number"},
            "photo_audit_value": {"type": "number"},
            "company_name": {"type": "string"},
        }},
    }},
]


async def run_agent(user_text, *, bot_name, provider, model, api_key, dispatch, session_id="feed"):
    model_name = model if "/" in model else f"{provider}/{model}"
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT.format(bot_name=bot_name)},
        {"role": "user", "content": user_text},
    ]
    actions = []
    for _ in range(9):
        response = await acompletion(
            model=model_name,
            api_key=api_key,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
        )
        message = response.choices[0].message
        messages.append(message.model_dump(exclude_none=True))
        tool_calls = message.tool_calls or []
        if not tool_calls:
            reply = message.content or ("Done." if actions else "")
            return {"reply": reply.strip(), "actions": actions}
        for tool_call in tool_calls:
            name = tool_call.function.name
            raw_args = tool_call.function.arguments or "{}"
            args = raw_args if isinstance(raw_args, dict) else json.loads(raw_args)
            result = await dispatch(name, args)
            actions.append({"name": name, "args": args, "result": result})
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(result, default=str),
            })
    return {"reply": "I stopped after too many tool calls. Please narrow the request.", "actions": actions}


async def complete_text(system, user, *, provider, model, api_key):
    """Return one provider-neutral text completion for non-agent AI features."""
    model_name = model if "/" in model else f"{provider}/{model}"
    response = await acompletion(
        model=model_name,
        api_key=api_key,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
    )
    return (response.choices[0].message.content or "").strip()
