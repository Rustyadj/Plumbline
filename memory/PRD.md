# PLUMBLINE — Validation-Driven ICF Field Management System
*(formerly KreteOps — renamed by user request)*

## Original Problem Statement
User uploaded `Walls Abilene Intermediate SS.xlsx` (a sprawling, error-laden ICF production tracker) and asked: "build me something better for this." After clarifying, the user articulated the vision: a **Validation Layer** baked into the construction workflow. Crew enters production in real-time, each task has a verifiable checklist, errors are caught at the moment of install (6–10× cheaper than post-pour rework). Tagline: *"Build to the plumbline. Zero rework."*

## User Choices Captured
- AI generation: **Hybrid** — AI suggests validation rules, manager approves
- Seed data: **Walls Abilene Intermediate SS** as the demo job
- Auth: **No auth** — role selection (Crew / Manager) on load
- Photo capture on validation steps: **Yes**
- Visual style: **Industrial / jobsite** — dark high-contrast with safety orange + hi-vis yellow
- Brand: **PLUMBLINE** (4,000-year-old construction tool that means "the standard of accuracy")

## Architecture
- **Frontend**: React 19 + Tailwind + Recharts + lucide-react. Barlow Condensed (display) + IBM Plex Sans (body).
- **Backend**: FastAPI + Motor (async MongoDB). Settings collection drives ROI cost model.
- **LLM**: Claude Sonnet 4.6 via `emergentintegrations` (Emergent Universal Key).
- **Photo storage**: Base64 data URLs embedded in `TaskEntry.validations[]`.

## Implemented (June 24, 2026)

### Core (iteration 1)
- Onboarding (role pick + name) stored in localStorage.
- Field View: 115 ICF tasks across 8 categories × 5 courses with status pills, progress bars, filters, search.
- TaskSheet: log hours/qty/role, walk oversized pass/fail validation checklist, snap photo proof, AI fix-it guidance on failed checks, notes — body scrolls independently of sticky header & submit footer (mobile fix).
- Command Dashboard: 4 hero metric tiles, status bars, validation pass-rate, 7-day production trend, hours-by-phase Est-vs-Actual, rework list, crew on site.
- Tasks · AI Rules screen (manager): generate AI validation suggestions, approve/reject, add manual rules, "requires photo" flag.

### ROI + Rebrand (iteration 2)
- **PLUMBLINE rebrand** — "Build to the plumbline. Zero rework."
- **Rework Cost Saver** hero tile with live `$X protected` + 30-day cumulative area chart.
- **Foreman Leaderboard** on dashboard (top 3 get medals; score = pass_rate×100 + log(catches+1)×12 + log(photos+1)×6).
- **Super Admin** (manager-only): ROI Settings, Jobs CRUD, Tasks CRUD, Common Mistakes, Danger Zone reset/reseed.

### Multi-Job + Export + Drilldown + Import (iteration 3)
- **Multi-Job Nav** — Job switcher in Shell header dropdown, selected job persisted in localStorage.
- **Crew Drilldown** — Click any leaderboard row (or crew chip) → modal with hours, entries, pass-rate, catches, 14-day activity area chart, top-tasks bar breakdown, last 25 entries with task names + photos count.
- **Excel + PDF Export** — Buttons on Command dashboard. Excel is a 4-sheet styled workbook (Recap KPIs / Tasks / Leaderboard / Entries). PDF is a clean executive report (`reportlab`) with KPI tiles, validation stats, leaderboard, tasks-by-phase, rework hotlist.
- **AI-Assisted Import (CSV & Excel)** — SuperAdmin → Jobs → "Import CSV / Excel" button. Upload any spreadsheet, Claude Sonnet 4.6 maps rows to PLUMBLINE's task schema (category, course, unit, estimates) and creates a new Job + default validation steps. Handles both .csv (native `csv` module) and .xlsx (`openpyxl`).

## Endpoints
- Health: `GET /api/`
- Jobs: `GET/POST /api/jobs`, `GET/PATCH/DELETE /api/jobs/{id}`
- Tasks: `GET /api/jobs/{id}/tasks`, `POST /api/jobs/{id}/tasks`, `GET/PATCH/DELETE /api/tasks/{id}`
- Validation Steps: `GET /api/tasks/{id}/validation-steps`, `POST /api/tasks/{id}/validation-steps`, `POST /api/tasks/{id}/validation-steps/generate` (AI), `PATCH/DELETE /api/validation-steps/{id}`
- Entries: `GET /api/tasks/{id}/entries`, `POST /api/tasks/{id}/entries`, `GET /api/jobs/{id}/entries`
- AI: `POST /api/validation/fix-suggestion`
- Settings: `GET /api/settings`, `PATCH /api/settings`
- Common Mistakes: `GET/POST /api/common-mistakes`, `DELETE /api/common-mistakes/{id}`
- Dashboard: `GET /api/jobs/{id}/dashboard` (returns totals, status_counts, daily_trend, validation_stats, roi {+trend_30d}, leaderboard, rework_tasks, active_crew)
- Admin: `POST /api/admin/reset?keep_settings=true|false`
- Seed: `POST /api/seed?force=true|false` (idempotent)

## Tested
- Iteration 1: backend 16/16 pytest, frontend 100%
- Iteration 2: backend 10/10 pytest (admin endpoints + leaderboard), frontend 100%
- Real AI calls verified (Claude Sonnet 4.6 via Emergent Universal Key)

## Backlog
### P1
- Per-crew weekly recap drilldown
- PDF/Excel export of weekly recap (replicate the original spreadsheet's print output)
- Multi-job navigation in Shell (data model already supports many)
- Crew roster (currently free-text names)

### P2
- Excel re-import (drop in a new job spreadsheet, auto-parse)
- SMS / Slack alert when a task flips to rework
- Offline-first PWA caching for spotty jobsite Wi-Fi
- Photo gallery / wall view across all entries
- Per-task cost coefficients (rebar lap rework ≠ cleanup rework)

## Next Action Items
- Demo the new Admin page + Leaderboard to the user.
- Capture user's real `REWORK_COST_PER_CHECK` number and update via Admin → ROI Settings.
- If user requests: per-crew drilldown, PDF export, or Excel re-import flow.
