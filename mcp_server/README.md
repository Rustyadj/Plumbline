# Something Better MCP for Hermes Nathan2

This stdio MCP server gives Nathan2 a controlled operational interface to PLUMBLINE/Something Better. It can read jobs, dashboards, tasks, validation steps, entries, and crew performance; create/update jobs and tasks; and log verified field production. It intentionally exposes no delete, reset, bulk-delete, settings, import, or AI-rule mutation tools.

## Install on Nathan2's Hermes host

```bash
cd /opt/something-better
python3 -m venv .venv-mcp
.venv-mcp/bin/pip install -r mcp_server/requirements.txt
```

Put secrets/settings in `~/.hermes/.env` (never commit them):

```dotenv
SOMETHING_BETTER_API_URL=https://YOUR-DEPLOYED-HOST/api
SOMETHING_BETTER_WRITES_ENABLED=true
# Optional when the API gains bearer-token auth:
# SOMETHING_BETTER_API_TOKEN=replace-me
```

Merge this block into `~/.hermes/config.yaml`, replacing `/opt/something-better` if the clone lives elsewhere:

```yaml
mcp_servers:
  something_better:
    command: "/opt/something-better/.venv-mcp/bin/python"
    args: ["/opt/something-better/mcp_server/server.py"]
    enabled: true
    timeout: 45
    connect_timeout: 20
    trust: untrusted
    tools:
      include:
        - something_better_health
        - something_better_list_jobs
        - something_better_job_overview
        - something_better_list_tasks
        - something_better_task_details
        - something_better_crew_stats
        - something_better_job_activity
        - something_better_common_mistakes
        - something_better_create_job
        - something_better_create_task
        - something_better_update_job
        - something_better_update_task
        - something_better_log_progress
      prompts: false
      resources: false
```

Then run:

```bash
hermes mcp test something_better
```

Inside Nathan2's active chat, run `/reload-mcp`. A safe smoke test is: `Use something_better_health, then list active jobs without changing anything.`

## Required operating rule

Add this to Nathan2's system prompt/agent instructions:

> Use Something Better MCP as the source of truth for job production. Resolve job/task IDs with read tools before every write. Never invent hours, quantities, measurements, crew names, or validation outcomes. Ask Rusty for missing facts. Read a task's validation checklist before logging progress. Do not mark a check passed unless a person explicitly confirms it. Treat rework, completion, and budget changes as approval-required actions.

The app currently has no user authentication. Keep this MCP local to Nathan2's host, do not expose it as a public HTTP endpoint, and enable backend auth before treating the underlying API as secure.
