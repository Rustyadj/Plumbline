"""In-app AI assistant (@bot) powered by the user's own LLM key (BYOK).

Uses emergentintegrations LlmChat with tool/function calling so the bot can make
real changes in the app. Tool execution is delegated to a `dispatch` coroutine
provided by server.py (which owns the DB + models).
"""
import json
from emergentintegrations.llm.chat import LlmChat, UserMessage

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
    chat = (
        LlmChat(api_key=api_key, session_id=session_id,
                system_message=SYSTEM_PROMPT.format(bot_name=bot_name))
        .with_model(provider, model)
        .with_tools(TOOLS, tool_choice="auto")
    )
    actions = []
    response = await chat.send_message_with_tools(UserMessage(text=user_text))
    guard = 0
    while getattr(response, "tool_calls", None) and guard < 8:
        guard += 1
        for tc in response.tool_calls:
            args = tc.arguments if isinstance(tc.arguments, dict) else json.loads(tc.arguments or "{}")
            result = await dispatch(tc.name, args)
            actions.append({"name": tc.name, "args": args, "result": result})
            chat.add_tool_result(tc.id, json.dumps(result, default=str))
        response = await chat.send_message_with_tools()
    reply = getattr(response, "content", None)
    if not isinstance(reply, str):
        reply = str(reply) if reply else ""
    if not reply.strip() and actions:
        reply = "Done."
    return {"reply": reply.strip(), "actions": actions}
