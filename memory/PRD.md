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

### Deterministic Import Rebuild (iteration 5) — Zero AI Required
- **New backend module `/app/backend/importer.py`** — heuristic parser: auto-detects the task-name column, extracts category from keyword matching, extracts course from `1st/2nd/…/5th` prefix, pulls estimated hours + qty from column-header hints (`hrs`, `qty`, `lf`, `sf`, `ea`) or falls back to numeric-scale scanning (smallest = hours, largest = qty). Filters `#REF!`, totals, headers, employee names, and single-word junk.
- **Two-step API replaces the old AI endpoint**:
  - `POST /api/admin/import/preview` (multipart file) → returns `{tasks, stats, detected_columns}` — no DB writes
  - `POST /api/admin/import/commit` (JSON with selected tasks + job info) → creates Job + Tasks + default validation steps
- **New ImportDialog UX**:
  - Step 1: giant drag-and-drop zone (browse or drop CSV/XLSX)
  - Step 2: preview view with 5 KPI tiles (Rows Scanned, Tasks Found, Selected, Categories, Est. Hours), inline job-info form, category filter chips with per-category counts, search, per-row include/exclude checkbox, "Select/Deselect Visible" bulk toggle
  - Step 3: success confirmation with job name + tasks-created count
- Performance: your real 872 KB Walls Abilene SS → **586 unique tasks parsed in ~500ms** (was 3,141 → dumped junk, no LLM calls, zero cost). Categories: Precon 13, Startup 17, Layout 44, Install 210, Rebar 97, Pour 25, Strip 77, Cleanup 34, Other 69.
- **Task + validation-step caching** in localStorage per job/task on every online load, so the field crew can open PLUMBLINE with no signal and still see their tasks + checklists.
- **Offline queue** for TaskEntry POSTs — when submit fires while offline (or an API call fails mid-submit), the entry is stored locally with all validations, notes, and photos. No lost data.
- **Auto-sync** on `online` event fires the queue at the backend; also runs 800ms after boot to catch pending items from previous sessions.
- **Live status banner** at top of Shell — orange when offline (with pending count), amber when online with pending, flash green after successful sync.
- **Submit button** dynamically changes to "Queue Entry (Offline)" with a WifiOff icon when the crew is offline.
- **Quota safety** — if localStorage fills up, the helper drops photos from queued entries before losing the entry data itself.

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

## MobileOps Re-skin + Bulk Task Edit (iteration 6 — Aug 31, 2026)
- **Full UI re-skin** from dark industrial theme → light corporate SaaS ("MobileOps" style) per `/app/design_guidelines.json`:
  - New palette: light bg `#F8FAFC`, navy sidebar `#0F172A`, blue primary `#2563EB`, emerald success `#10B981`. Fonts: Manrope (display) + IBM Plex Sans (body). `index.css` `k-*` classes fully restyled.
  - **App Shell rewritten** (`Shell.jsx`): collapsible navy **left sidebar** with grouped nav (OVERVIEW / FIELD / ADMIN) + collapse toggle (persisted in localStorage) + mobile drawer; white **top bar** with job switcher, global search, "New Job", user avatar, logout.
  - Sidebar Admin group deep-links into SuperAdmin sections; `App.js` now holds `view`, `adminSection`, and global `query` state. `SuperAdmin` is controlled via `section`/`onSection` props (internal tab bar removed).
  - Top-bar **global search** drives Field View + Validation Rules (`query` prop); disabled on Dashboard/Admin; cleared on nav.
  - All content components re-themed: Dashboard, FieldView (+TaskSheet), TasksAdmin, CrewDrilldown, Onboarding, OfflineBanner. Modals now close on backdrop click + Escape. Sidebar nav items keyboard-accessible.
- **Bulk task edit** (Admin → Tasks, `SuperAdmin.jsx` TasksPanel): dense data **table** with per-row checkboxes + select-all; sticky **bulk action bar** (N selected) → Set Category, Set Course, Bulk Delete, Clear. Category filter chips with counts.
  - New backend endpoints: `PATCH /api/tasks/bulk/update` `{task_ids, category?, course?, unit?}` and `POST /api/tasks/bulk/delete` `{task_ids}`.
- **Import full de-selectable view**: ImportDialog preview is now a full task **table** (checkbox per row + select-all header, category filter chips, search) so users deselect anything not applicable before committing. On commit the newly created job becomes active and the view jumps to Admin → Tasks for review.
- **Tested**: testing_agent iteration_3 — 100% of requested frontend flows pass (onboarding, all 8 sidebar routes + active state, collapse persistence, bulk edit incl. persistence, full CSV import, global search, job switcher, Field/Dashboard regression), zero console errors. Bulk endpoints curl-verified. Import→new-job landing verified via screenshot.

