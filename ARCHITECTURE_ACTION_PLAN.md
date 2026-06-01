# QMS Platform — Enterprise Architecture & Interconnection Action Plan

**Document type:** Architecture redesign + implementation roadmap
**Prepared as:** Senior Enterprise Architect review of the current MVP
**Scope:** Convert the current "six independent modules" MVP into a single, interconnected, multi-tenant, production-grade product platform.
**Repo analyzed:** `github.com/kiranvarmap/qms` (active stack = Next.js 16 / React 19 / TypeScript / Drizzle ORM / PostgreSQL)
**Constraint honored:** This is a *plan only*. No code was modified.

---

## 0. How to read this document

The plan is sequenced the way the work should actually happen:

1. **Part A — Understanding the current system** (what exists, honestly).
2. **Part B — The interconnection model** (how modules *should* relate).
3. **Part C — Target architecture** (layers, services, events, security).
4. **Part D — Redesigned data model** (ERD, tables, keys, indexes, constraints).
5. **Part E — APIs, data flow, and end-to-end workflows.**
6. **Part F — Non-functional design** (scale, performance, security, maintainability).
7. **Part G — Implementation roadmap** (MVP → production, phased, with exit criteria).

Throughout, I distinguish **strong relationships** (enforced FKs, cascade rules, transactional integrity) from **loose coupling** (events, links, eventual consistency). Getting that distinction right is the core of turning this from an MVP into a platform.

---

# PART A — Understanding the Current System

The product is a **Quality Management System** organized around **Workspaces** as the intended tenant boundary. Six modules exist today. Below is what each one genuinely does in the code, the data it owns, what it depends on, and — critically — **how connected it actually is right now**.

## A.1 Module: Project & Task Boards (Monday.com-style)

| Aspect | Detail |
|---|---|
| **Purpose** | Flexible work tracking. `workspace → board → group → item`, with a dynamic column system (11 types: text, number, status, date, person, dropdown, checkbox, link, priority, rating, formula). |
| **Owns (creates)** | `boards`, `groups`, `columns`, `items`, `cellValues`, `activityLog`, `comments`, `automations`, `automationLogs`, `statusNotifications`, `forms`, `formFields`. |
| **Consumes** | `users` (assignees, creators), `workspaces` (scope), `workspaceMembers` (access). |
| **Updates** | `cellValues` (the actual data grid), item positions/groups. |
| **Outcomes** | A live work surface; status changes that *fan out* to email + in-app notifications + automated field changes. |
| **Interconnection today** | **This is the only module with a real event engine.** `runAutomations()` fires on `item_created`, `column_changed`, `form_submitted`. Status changes trigger both `statusNotifications` (email) and in-app `notifications`. |

This module is the natural **hub** of the platform. Everything else should hang off "an item is a unit of work."

## A.2 Module: Inspections / Audits

| Aspect | Detail |
|---|---|
| **Purpose** | Template-driven inspections & audits with weighted scoring, conditional logic, NCR support, corrective actions, and immutable PDF reports. |
| **Owns** | `inspectionTemplates`, `templateSections`, `templateQuestions`, `inspections`, `inspectionResponses`, `inspectionActions`, `inspectionSignatures`, `inspectionAuditLog`, `ncrSequences`, `sops`, `templateSopLinks`, `pdfTemplates`. |
| **Consumes** | `users` (`conductedBy`), `employees` (signatures), `boards`/`items` (a template can target a board; inspections can link to items), `workspaces` (nullable scope). |
| **Key design strength** | `inspections.templateSnapshot` — a full JSON snapshot of the template at conduct time, so later template edits never rewrite history. This is correct and should be preserved. |
| **Outcomes** | A score (0–100), flagged responses, corrective actions, signatures, and a PDF report. |
| **Interconnection today — the gap** | `inspectionActions` (corrective actions) **has no `itemId`** — a failed inspection cannot automatically create a task on a board. `inspections → items` linking exists but is **manual** (`POST /api/items/[id]/inspections`). Submitting an inspection (`/submit`) only computes score + status; it **emits no event**, creates no follow-up work, and notifies nobody. |

## A.3 Module: Employee Management

| Aspect | Detail |
|---|---|
| **Purpose** | HR-style master records: `employees` (badge/HR code), `workshops` (physical stations), `empProjects`, `empTasks`. |
| **Owns** | `employees`, `workshops`, `empProjects`, `empTasks`. |
| **Consumes** | Linked *loosely* to `users` via `users.employeeId`. |
| **Outcomes** | A roster of real people + the work areas/projects they can be assigned to and clock into. |
| **Interconnection today — the big gap** | **None of these tables have a `workspaceId`.** They are global/un-tenanted. In a multi-tenant product this is a correctness and data-isolation problem. Also, **`employees` and `users` are two separate identities** loosely joined — see A.7. |

## A.4 Module: Time Clock

| Aspect | Detail |
|---|---|
| **Purpose** | Public clock-in / clock-out with photos, tied to workshop / project / task. |
| **Owns** | `timeLogs`, `timeLogItemLinks`. |
| **Consumes** | `employees`, `workshops`, `empProjects`, `empTasks`, and (via links) board `items`. |
| **Outcomes** | Attendance + labor-time records; minutes that can roll up to a project/task/board item. |
| **Interconnection today** | `timeLogItemLinks` lets a time log attach to a board item (good seam, manual). But like Employee Mgmt, **`timeLogs` is not workspace-scoped**, and there is no automatic roll-up of labor minutes into board items or inspections. |

## A.5 Module: Document Signing (e-signature)

| Aspect | Detail |
|---|---|
| **Purpose** | DocuSign-style multi-recipient signing: ordered recipients, placed fields, tokenized links, event log. |
| **Owns** | `signDocuments`, `signRecipients`, `signFields`, `signEvents`. |
| **Consumes** | `users` (creator), `workspaces` (nullable scope). Recipients are **email strings**, not necessarily platform users. |
| **Outcomes** | A completed, legally-meaningful signed PDF + an audit trail of view/sign/decline events. |
| **Interconnection today** | Self-contained. Not linked to board items, inspections, or employees. A "this contract is signed" event does not flow anywhere. |

## A.6 Module: User Management & Access

| Aspect | Detail |
|---|---|
| **Purpose** | Invitation-based registry; roles `admin/manager/user`; per-workspace sub-app permission flags; employee linking. |
| **Owns** | `users`, `accounts`, `sessions`, `verificationTokens`, `invitations`, `workspaceMembers`, `workspaceLabels`, `boardColumnPermissions`, `boardItemPermissions`. |
| **Auth model** | NextAuth v5, JWT sessions, bcrypt credentials. **No `middleware.ts`** — every route calls `await auth()` itself. RBAC is enforced ad hoc, route by route. |
| **Permission model** | Three layers coexist: global `users.role`; `workspaceMembers` role + `canAccess*` flags; and board-level column/item ACLs. There is no single, composable authorization function. |

## A.7 The two cross-cutting problems that define the redesign

1. **Dual identity: `users` vs `employees`.**
   - `users` = login identity (auth, sessions, board membership, "conducted by").
   - `employees` = HR/operational identity (badge ID, signs inspections, clocks in).
   - They are joined only by a nullable `users.employeeId`. The result: the same human can exist twice, permissions don't follow the employee, and reporting ("show me everything Person X did") requires stitching two tables. **This must be resolved with a clear identity strategy** (Part D.3).

2. **Inconsistent tenancy.** `workspaceId` is present-but-nullable on inspections/sign/sops/pdfTemplates, and **entirely absent** on the whole Employee/Time-Clock module. There is no enforced tenant boundary, so true multi-tenant isolation is impossible today.

3. **Only Boards emit events.** Inspections, Sign, and Time-Clock are write-only islands. The platform's value proposition ("everything connects to the work it belongs to") is not yet realized in code.

---

# PART B — The Interconnection Model (the heart of the redesign)

The single most important design decision: **establish "Work" as the connective spine.** A board `item` is the universal unit of work that every other module can attach to. Inspections, signed documents, time logs, and corrective actions all become *evidence and activity* against an item, surfaced in one place.

## B.1 The connective spine

```
                         ┌─────────────────────────┐
                         │       WORKSPACE          │  ← tenant boundary (everything scoped here)
                         └─────────────┬───────────┘
                                       │
              ┌────────────────────────┼─────────────────────────┐
              │                        │                          │
        ┌─────▼─────┐           ┌──────▼──────┐            ┌───────▼───────┐
        │  PEOPLE   │           │   WORK ITEM │  ◄── SPINE  │   TEMPLATES   │
        │ users +   │           │ (board item)│            │ inspection +  │
        │ employees │           └──────┬──────┘            │ pdf + forms   │
        └─────┬─────┘                  │                   └───────────────┘
              │            ┌───────────┼───────────┬──────────────┐
              │            │           │           │              │
        actor/assignee  INSPECTION  TIME LOG   SIGN DOC      CORRECTIVE
         on everything   (evidence) (labor)   (compliance)   ACTION (task)
```

**Reading it:** A *workspace* contains *people* and *work items*. Every operational artifact — an inspection, a time log, a signed document, a corrective action — is produced by a person and (optionally but ideally) **linked to a work item**. The work item becomes the 360° record.

## B.2 Relationship decisions: strong vs loose

| Relationship | Coupling | Rationale |
|---|---|---|
| `workspace → board → group → item → cellValue` | **Strong** (FK, cascade) | Structural ownership; deleting a board must clean up its grid. |
| `template → section → question` | **Strong** (FK, cascade) | A template is meaningless without its tree. |
| `inspection → template` | **Strong but RESTRICT + snapshot** | Keep referential integrity, but never let template edits mutate history — snapshot already solves this. Keep it. |
| `inspection → item` | **Loose (link table)** | An inspection may exist standalone (ad-hoc audit) or attach to work. Many-to-one allowed; never cascade-delete an inspection because an item was removed → use `SET NULL` semantics on the link, retain the inspection. |
| `corrective action → item` | **Should become strong-ish (new FK)** | A corrective action is *literally* a task. It should be able to **become** a board item (or reference one). This closes the inspection→work loop. |
| `time log → item` | **Loose (link table)** | Labor may or may not map to a tracked item. |
| `sign document → item / inspection` | **Loose (polymorphic link)** | A signed doc can relate to a task *or* be evidence on an inspection (e.g., signed NCR). |
| `user ↔ employee` | **Strong 1:1 (redesigned)** | One human = one identity record. See D.3. |
| `automation/event → any module` | **Loose (event bus)** | Modules react to events without direct calls. This is what makes the system extensible without becoming tangled. |

## B.3 The business loops we are enabling

These are the "outcomes connect to outcomes" flows that the MVP cannot do yet:

1. **Quality loop:** Inspection fails / flags a response → auto-create a **corrective action task** on the relevant board item → assignee notified → task closed → inspection marked remediated.
2. **Compliance loop:** NCR raised in inspection → generate signed document (e.g., disposition approval) → signature completes → NCR status advances → audit trail stitched across both modules.
3. **Labor loop:** Employee clocks in against a task → minutes roll up to the board item and the inspection it supports → cost/effort reporting.
4. **Intake loop (already partly works):** Public form submitted → board item created → automation routes/notifies → optionally spawns an inspection.
5. **People loop:** One identity drives auth, board assignment, inspection sign-off, and time tracking — no double-entry.

## B.4 Configurable Linking & Scope Governance (the "freedom + flexibility" model)

A platform requirement: **every artifact-creating action — start an inspection, clock in, send a document for signing, submit a form — must be able to link to the work hierarchy at *any depth, or not at all*, and an admin governs how much freedom the user has at each step.** This is the mechanism that delivers connectivity *without forcing* it.

### B.4.1 The Scope Ladder

There is one universal ladder that every module attaches to. A user (or an admin-defined rule) chooses how far down to go:

```
   (none / general)         ← attached to nothing; standalone artifact
        │
   WORKSPACE                ← "belongs to Plant-A", nothing more specific
        │
   BOARD                    ← "belongs to the Welding QC board"
        │
   GROUP                    ← "belongs to the June Batch group"   (optional rung)
        │
   ITEM (task)              ← "belongs to Job #4471"   ← deepest = most connected
```

**Rule:** picking a rung implies all rungs above it (an item implies its group → board → workspace). So "link to item" auto-fills the full ancestry; "link to board" fills workspace+board and leaves group/item null; "general" leaves everything but the tenant null.

### B.4.2 The three governance dials (admin-defined, per workspace × module)

For each module in each workspace, an admin sets a **link policy** with three dials:

| Dial | Options | Meaning |
|---|---|---|
| **1. Mode** | `disabled` / `optional` / `required` | Is linking turned off, allowed-but-skippable, or mandatory? |
| **2. Depth** | `min_level` … `max_level` on the ladder | How shallow may they stop, and how deep may they go? e.g. min=`board`, max=`item` means "must pick at least a board, may drill to a task." |
| **3. Selection per rung** | `locked` / `free` / `predefined` | At each rung: is the value fixed by admin (`locked` to a default), freely browsable (`free`), or chosen from an admin-curated list (`predefined`)? |

This is exactly the "either the user selects options or uses predefined values, and it's admin-defined at every step" behavior you described — expressed as a reusable policy instead of hard-coded per feature.

### B.4.3 How it plays out per module (worked configurations)

**Inspection (admin wants tight governance):**
`mode=required, min=board, max=item`, board rung=`free`, group rung=`predefined`, item rung=`free`.
→ The inspector *must* pick a board, then chooses a group only from a curated list, then any task on it. Cannot create a "floating" inspection.

**Inspection (admin wants flexibility):**
`mode=optional, allow_general=true, min=none, max=item`.
→ Inspector can run a quick ad-hoc audit linked to nothing, or drill all the way to a task — their choice.

**Time-Clock (shop floor):**
`mode=required, min=board, max=item`, plus the **labor structure** (`workshop → emp_project → emp_task`) selectable in parallel.
→ Worker must clock in *against a board task* (so minutes roll up), and also tags *which workshop/station* they're at. "Just workspace" or "just board" is allowed only if the admin sets `min=workspace`/`min=board`.

**DocSign (creator's discretion):**
`mode=optional, allow_general=true`.
→ The document creator decides at send-time whether to attach the document to a task, to an inspection (as evidence), or leave it standalone — nothing is forced.

### B.4.4 The user experience: progressive disclosure

```
START CREATE  ──▶  read link_policy(workspace, module)
                        │
            mode=disabled│         mode=optional/required
                        │                  │
                        ▼                  ▼
                  no link UI        show ladder, starting at min_level
                  (general)                │
                                  ┌─────────┴──────────┐
                                  │ rung selection_mode │
                                  ├── locked → show default, read-only
                                  ├── free   → searchable picker of all targets at this rung
                                  └── predefined → dropdown of admin-curated options only
                                            │
                              user picks ───┤  picking reveals the NEXT rung (if max_level deeper)
                                            │  user may STOP here (if level ≥ min_level)
                                            ▼
                                  resolve full ancestry → validate against policy → save
```

### B.4.5 Why this is the right design

- **One mechanism, every module** — inspection, clock-in, docsign, forms all read the same `link_policy` and write the same ancestry columns. No per-feature linking code.
- **Freedom and control coexist** — the same engine supports "link to anything you want" and "you must link to a curated task," chosen by config, not code.
- **Connectivity is captured uniformly** — because every artifact stores its resolved ancestry (`workspace/board/group/item`), the 360° item view, roll-ups, and reporting all work the same way regardless of which module produced the data.

## B.5 The 360° Work Item & Hierarchical Roll-up (everything tracked at every level)

The goal: **once an employee has linked his time, inspection, or document to a task, all of it shows up on that task's detail — and aggregates upward to the board and the workspace.** This is the direct payoff of B.4's ancestry columns: because every artifact carries `workspace_id / board_id / group_id / item_id`, "show me everything for this X" is a single indexed query at any level.

### B.5.1 The aggregation is free, by construction

```
SELECT … WHERE item_id = :id        → the 360° TASK view (one task's full history)
SELECT … WHERE board_id = :id       → BOARD roll-up (totals across its tasks)
SELECT … WHERE workspace_id = :id   → WORKSPACE portfolio (totals across boards)
```
The same three queries run against `time_logs`, `inspections`, `sign_documents`, `comments` — no special per-module reporting code.

### B.5.2 The Task (Item) Detail panel — the 360° record

When you open a task, the detail panel shows tabs, each populated by `WHERE item_id = :id`:

```
┌─ TASK: "Weld Job #4471"  (board: Welding QC · workspace: Plant-A) ──────────┐
│ Overview │ ⏱ Time │ ✅ Inspections │ ✍ Documents │ 💬 Comments │ 🕓 Activity │
├──────────────────────────────────────────────────────────────────────────┤
│ ⏱ Time         → time_logs WHERE item_id  → who clocked in/out, minutes,   │
│                                              total labor on this task        │
│ ✅ Inspections → inspections WHERE item_id → each inspection + score +       │
│                                              status + 📄 PDF report link      │
│ ✍ Documents    → sign_documents WHERE item_id → linked/signed docs +         │
│                                              status + completed PDF           │
│ 💬 Comments     → comments WHERE item_id                                      │
│ 🕓 Activity     → unified timeline (see B.5.4)                                │
└──────────────────────────────────────────────────────────────────────────┘
```
The **inspection "file"** the employee produces is the generated PDF (already supported via the PDF export route + `pdf_templates`); its path is stored on the inspection and surfaced here as a download link. Same for the completed/signed document PDF.

### B.5.3 Roll-up at each level

| Level | What you see |
|---|---|
| **Task (item)** | Full detail: every clock-in, every inspection + report file, every document, every comment for that one task. |
| **Board** | Aggregates across its tasks: total labor hours, inspection pass-rate / average score, open vs. resolved corrective actions, documents pending signature. |
| **Workspace** | Portfolio view across boards: labor by department/workshop, quality trend, compliance (docs signed vs. outstanding), overdue corrective actions. |

### B.5.4 Read model: the unified activity feed (the timeline backbone)

Querying five tables and merging on every page load is fine at small scale but won't hold up. Add a **projection table** populated by the `event_outbox` worker (B.3 / D.5) — one denormalized row per meaningful action, carrying full ancestry:
```
activity_feed
  id            bigserial PK
  workspace_id  uuid NOT NULL
  board_id      uuid
  group_id      uuid
  item_id       uuid
  actor_user_id uuid
  ref_type      varchar     -- 'time_log' | 'inspection' | 'sign_document' | 'comment' | 'item'
  ref_id        uuid
  action        varchar     -- 'clocked_in' | 'inspection_submitted' | 'document_signed' | ...
  summary       text        -- human-readable line for the timeline
  occurred_at   timestamptz NOT NULL
  INDEX (workspace_id, item_id, occurred_at DESC)
  INDEX (workspace_id, board_id, occurred_at DESC)
```
Now the task timeline, board feed, and workspace feed are all **one indexed read** from a single table — and it's eventually-consistent off the event bus, so writes stay fast. This is what makes "tracked at each level" both real and scalable.

---

# PART C — Target Architecture

## C.1 Architectural principles

1. **Modular monolith first, services-ready later.** Keep one deployable Next.js app, but enforce **internal module boundaries** (a `domain/` layer per module with explicit public interfaces). Do not prematurely split into microservices — the team and traffic don't warrant it yet, and the data is highly relational.
2. **Tenant isolation is non-negotiable.** Every operational row carries a non-null `workspaceId`. Every query is workspace-scoped by default.
3. **Events over direct calls for cross-module effects.** A central, durable **event bus** decouples producers (modules) from consumers (automations, notifications, integrations).
4. **One identity, layered authorization.** Resolve user/employee duality; centralize authZ in middleware + a single `can()` policy function.
5. **Snapshots for anything that must be auditable.** Already done for inspections; extend the principle to signed-doc field state.

## C.2 Layered architecture

```
┌───────────────────────────────────────────────────────────────────┐
│ CLIENT (browser)                                                    │
│  Next.js App Router pages · React 19 · server components            │
│  Public surfaces: /forms/[slug], /sign/[token], /time-clock         │
└───────────────────────────────┬───────────────────────────────────┘
                                 │  HTTPS
┌───────────────────────────────▼───────────────────────────────────┐
│ EDGE / MIDDLEWARE                                                   │
│  middleware.ts → authN check, tenant resolution, rate-limit gate    │
└───────────────────────────────┬───────────────────────────────────┘
┌───────────────────────────────▼───────────────────────────────────┐
│ APPLICATION (Next.js Route Handlers = API layer)                    │
│  Thin controllers → validate (Zod) → call domain services           │
│  /api/v1/{workspaces,boards,items,inspections,sign,time,users,...}  │
└───────────────────────────────┬───────────────────────────────────┘
┌───────────────────────────────▼───────────────────────────────────┐
│ DOMAIN / SERVICE LAYER  (new — the key refactor)                    │
│  modules/boards      modules/inspections   modules/timeclock        │
│  modules/sign        modules/people        modules/notifications    │
│  Each exposes a typed service API; no module imports another's DB    │
│  tables directly — they call services or react to events.           │
└───────────────┬───────────────────────────────┬───────────────────┘
                │                                │ publish/subscribe
┌───────────────▼──────────────┐   ┌─────────────▼───────────────────┐
│ DATA LAYER                    │   │ EVENT BUS + JOB QUEUE            │
│  Drizzle ORM → PostgreSQL     │   │  outbox table → worker          │
│  Read replicas (later)        │   │  (BullMQ/Redis or pg-boss)      │
└───────────────────────────────┘   └─────────────┬───────────────────┘
                                                   │
┌──────────────────────────────────────────────────▼──────────────────┐
│ BACKGROUND WORKERS                                                    │
│  · event consumers (automations, notifications, roll-ups)            │
│  · scheduled jobs (date_reached automations, due-date reminders)     │
│  · PDF generation, email send, file post-processing                 │
└──────────────────────────────────────────────────┬──────────────────┘
┌──────────────────────────────────────────────────▼──────────────────┐
│ EXTERNAL INTEGRATIONS                                                 │
│  Resend (email) · Supabase/S3 (object storage) · (future) SSO/OIDC,  │
│  webhooks, analytics sink                                             │
└──────────────────────────────────────────────────────────────────────┘
```

## C.3 Service boundaries (the internal modules)

Each becomes a folder with a **public service interface** and **private internals**. Cross-module needs go through the interface or the event bus — never by reaching into another module's tables.

| Service | Public responsibilities | Emits events | Listens for |
|---|---|---|---|
| **People** | users, employees (unified identity), invitations, membership | `member.added`, `employee.created` | — |
| **Workspace** | workspaces, members, labels, permission grants | `workspace.created` | — |
| **Boards** | boards, groups, columns, items, cells, comments | `item.created`, `item.updated`, `item.status_changed`, `item.moved` | `inspection.action_created`, `form.submitted`, `timelog.linked` |
| **Forms** | public forms, fields, submissions | `form.submitted` | — |
| **Inspections** | templates, inspections, responses, scoring, signatures, NCR | `inspection.submitted`, `inspection.flagged`, `inspection.signed`, `ncr.raised` | `signdoc.completed` (to close NCR) |
| **TimeClock** | time logs, roll-ups | `timelog.checked_in`, `timelog.checked_out` | — |
| **Sign** | documents, recipients, fields, events | `signdoc.sent`, `signdoc.completed`, `signdoc.declined` | `inspection.flagged` (auto-prepare disposition doc) |
| **Notifications** | in-app + email fan-out (unify the two systems) | — | **all** `*` events (it is the universal consumer) |
| **Automations** | rules engine, now workspace-wide (not board-only) | `automation.executed` | `item.*`, `inspection.*`, `form.*`, `timelog.*` |

---

# PART D — Redesigned Data Model

The existing schema is well-built at the table level. The redesign is **mostly additive and corrective**, not a rewrite. Below: the ERD, then the specific schema changes grouped by priority.

## D.1 Entity-Relationship overview

```
users ─1:1─ employees                 workspaces ─1:N─ workspace_members ─N:1─ users
   │                                       │
   │ (actor on everything)                 ├─1:N─ boards ─1:N─ groups ─1:N─ items ─1:N─ cell_values
   │                                       │                              │
   │                                       │                              ├─1:N─ comments
   │                                       │                              ├─N:N─ inspections (link)
   │                                       │                              ├─N:N─ time_logs   (link)
   │                                       │                              └─N:N─ sign_documents (link)
   │                                       │
   │                                       ├─1:N─ inspection_templates ─1:N─ template_sections ─1:N─ template_questions
   │                                       │            │
   │                                       │            └─1:N─ inspections ─1:N─ inspection_responses
   │                                       │                        ├─1:N─ inspection_actions ──(NEW FK)──► items
   │                                       │                        ├─1:N─ inspection_signatures ─N:1─ employees
   │                                       │                        └─1:N─ inspection_audit_log
   │                                       │
   │                                       ├─1:N─ sign_documents ─1:N─ sign_recipients ─1:N─ sign_fields
   │                                       │
   │                                       ├─1:N─ workshops ─1:N─ emp_projects ─1:N─ emp_tasks
   │                                       └─1:N─ time_logs ─N:1─ employees

events (outbox) ── consumed by ──► automations, notifications, roll-ups
```

## D.2 Schema changes — Priority 1 (correctness & tenancy)

These are blocking for "production-grade multi-tenant."

**1. Add `workspaceId` (NOT NULL) to the entire Employee/Time-Clock module.**

| Table | Change |
|---|---|
| `employees` | `+ workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE` |
| `workshops` | `+ workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE` |
| `emp_projects` | `+ workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE` |
| `emp_tasks` | inherits via `emp_projects` (keep its FK), add index on `project_id` |
| `time_logs` | `+ workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE` |

> Migration note: backfill requires a "default workspace" assignment for existing rows, then a `SET NOT NULL` in a second migration. Never add `NOT NULL` + FK in one step on a populated table.

**2. Make tenancy consistent where it's nullable.** Decide per table whether `workspaceId` should be required. Recommendation: `inspections`, `inspection_templates`, `sign_documents`, `sops`, `pdf_templates` → **NOT NULL** (everything belongs to a workspace). `pdf_templates` may allow a global/system default → keep nullable only for system templates flagged `isSystem = true`.

**3. Composite tenant indexes.** Every high-traffic table gets an index leading with `workspace_id`:
```
CREATE INDEX idx_items_ws_board     ON items(workspace_id, board_id);
CREATE INDEX idx_inspections_ws     ON inspections(workspace_id, status, created_at DESC);
CREATE INDEX idx_timelogs_ws_emp    ON time_logs(workspace_id, employee_id, check_in_at DESC);
CREATE INDEX idx_signdocs_ws_status ON sign_documents(workspace_id, status);
```
(`items` needs `workspace_id` denormalized from its board for these — add it.)

## D.3 Schema changes — Priority 1 (resolve the identity duality)

**Decision: one human = one `users` row; `employees` becomes a 1:1 *profile extension*, not a separate identity.**

- Keep `employees` table for HR/operational attributes (badge ID, department, PIN, avatar) but make it a **profile that always hangs off a user**:
  - `employees.user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE` (replaces the current direction `users.employeeId`).
  - Drop `users.employeeId` after migration (or keep as a generated/denormalized convenience read).
- For people who clock in but never log in (shop-floor workers): still create a `users` row with `status='active'`, `password=NULL`, and a role like `worker`. They authenticate to the time clock via **badge ID + PIN** (already modeled by `employees.pin`), not via the web login. This keeps **one identity** while supporting passwordless floor access.
- Net effect: "show me everything Person X did" = one join from `users`. Signatures, board assignments, conducted inspections, and time logs all resolve to a single identity.

> If full 1:1 unification is too disruptive short-term, the **interim** is: enforce that every `employees` row references a `users` row (add the FK, keep both), and treat `users` as canonical for identity in all reporting.

## D.4 Schema changes — Priority 2 (close the cross-module loops)

**1. Corrective actions become real tasks (the quality loop).**
```
inspection_actions
  + workspace_id  uuid NOT NULL REFERENCES workspaces(id)
  + item_id       uuid REFERENCES items(id) ON DELETE SET NULL   -- the board task it spawned
  + board_id      uuid REFERENCES boards(id) ON DELETE SET NULL   -- target board for auto-creation
```
On `inspection.flagged`/`inspection.submitted`, a consumer creates a board `item` (a task) and writes its id back to `inspection_actions.item_id`. The action and the task stay in sync via events.

**2. Polymorphic "attachment" for signed docs and evidence.** Rather than many link tables, introduce **one generic link table** for loose associations that don't need strong FKs in both directions:
```
entity_links
  id            uuid PK
  workspace_id  uuid NOT NULL
  source_type   varchar   -- 'inspection' | 'sign_document' | 'time_log' | 'item' | ...
  source_id     uuid
  target_type   varchar
  target_id     uuid
  relation      varchar   -- 'evidence_for' | 'remediates' | 'belongs_to' ...
  created_by    uuid REFERENCES users(id)
  created_at    timestamptz
  UNIQUE(source_type, source_id, target_type, target_id, relation)
```
> Keep the existing **strong** link tables (`inspection_item_links`, `time_log_item_links`) where the relationship is first-class and queried hot. Use `entity_links` for the long tail (sign-doc ↔ inspection, sign-doc ↔ item, etc.) so you don't spawn a new table per pair. This is the pragmatic middle path between rigid FKs and a tangle of join tables.

**3. Add `workspace_id` denormalization to `items`** (referenced in D.2) so cross-module queries and tenant filters don't always need a board join.

## D.5 Schema changes — Priority 2 (events & unified notifications)

**1. Transactional outbox table** (the backbone of event-driven processing):
```
event_outbox
  id            bigserial PK
  workspace_id  uuid NOT NULL
  event_type    varchar NOT NULL     -- 'item.status_changed', 'inspection.submitted', ...
  aggregate_type varchar             -- 'item' | 'inspection' | ...
  aggregate_id  uuid
  payload       jsonb NOT NULL
  occurred_at   timestamptz NOT NULL DEFAULT now()
  processed_at  timestamptz          -- NULL = pending
  attempts      int DEFAULT 0
  status        varchar DEFAULT 'pending'   -- pending | processing | done | dead
  INDEX (status, occurred_at)
```
Producers write domain rows **and** an outbox row in the **same transaction**. A worker polls/streams outbox → dispatches to consumers (automations, notifications). This guarantees no lost events and no dual-write inconsistency.

**2. Unify the two notification systems.** Today `statusNotifications` (email rules) and `notifications` (in-app) + automation `notify_user`/`send_email` overlap. Consolidate:
- Keep `notifications` (in-app feed) as the **delivery record**.
- Replace `statusNotifications` rules with **automations** (`trigger=column_changed, action=notify`) so there is *one* rules engine.
- Add a `notification_preferences` table (per user: in-app/email/none per event type) so fan-out respects user choice.

## D.5b Schema for Configurable Linking & Scope Governance (implements B.4)

Two pieces: a **policy** table (admin rules) and **ancestry columns** on every artifact (the resolved link). Additional/secondary associations still use `entity_links`.

**1. The governance policy** — what's allowed, per workspace × module:
```
link_policies
  id            uuid PK
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
  module        varchar NOT NULL          -- 'inspection' | 'time_clock' | 'sign' | 'form'
  mode          varchar NOT NULL DEFAULT 'optional'   -- disabled | optional | required
  allow_general boolean NOT NULL DEFAULT true          -- may the user link to nothing?
  min_level     varchar NOT NULL DEFAULT 'none'         -- none|workspace|board|group|item
  max_level     varchar NOT NULL DEFAULT 'item'
  -- per-rung selection rules (dial #3), e.g.:
  -- [{ "level":"board","selection":"free" },
  --  { "level":"group","selection":"predefined","options":["grp_a","grp_b"] },
  --  { "level":"item", "selection":"free" }]
  rung_rules    jsonb NOT NULL DEFAULT '[]'
  default_target jsonb                                  -- pre-selected/locked value
  is_active     boolean NOT NULL DEFAULT true
  updated_by    uuid REFERENCES users(id)
  updated_at    timestamptz NOT NULL DEFAULT now()
  UNIQUE(workspace_id, module)
```

**2. Resolved ancestry on each artifact** — add the same nullable ladder columns to `inspections`, `time_logs`, `sign_documents` (and any future artifact). `workspace_id` is always set; the deepest non-null column = the chosen `link_level`:
```
  + workspace_id  uuid NOT NULL REFERENCES workspaces(id)     -- tenant, always
  + board_id      uuid REFERENCES boards(id) ON DELETE SET NULL
  + group_id      uuid REFERENCES groups(id) ON DELETE SET NULL
  + item_id       uuid REFERENCES items(id)  ON DELETE SET NULL
  + link_level    varchar NOT NULL DEFAULT 'none'   -- denormalized: none|workspace|board|group|item
```
> Why denormalize ancestry onto the artifact instead of only using link tables: it makes the **primary placement** a single-row, index-friendly fact ("where does this inspection belong?"), powering tenant filters, the 360° item view, and roll-ups with no joins. The existing strong link tables (`inspection_item_links`, `time_log_item_links`) and the generic `entity_links` remain for **secondary** associations (e.g. one inspection that is *evidence_for* a different item).

**3. Enforcement (server-side, in the service layer):**
- On create, load `link_policies(workspace, module)`; reject if chosen level `< min_level` or `> max_level`, or `general` when `allow_general=false`, or `mode=required` with no link.
- For each rung, if `selection='predefined'`, the chosen id must be in `options`; if `locked`, force `default_target`.
- Validate ancestry integrity: a chosen `item_id` must actually belong to the chosen `board_id`/`group_id` (prevents tampering).
- Indexes: `CREATE INDEX idx_<artifact>_scope ON <t>(workspace_id, board_id, item_id);`

## D.6 Constraints, keys, and integrity rules to add

| Concern | Rule |
|---|---|
| **Enums as Postgres enums** | Status fields currently stored as `varchar` with comments (`inspections.status`, `items` archive-by-name hack, automation statuses). Convert hot ones to `pgEnum` or add `CHECK` constraints. |
| **Soft delete / archive** | Replace the `"[Archived] "` name-prefix hack with `items.archived_at timestamptz` + partial index `WHERE archived_at IS NULL`. |
| **NCR numbering race** | `ncrSequences.lastNumber` increment must be done with `UPDATE ... RETURNING` inside a transaction (or a Postgres sequence per scope) to avoid duplicate NCR numbers under concurrency. |
| **Signature immutability** | Add a DB trigger or app-layer guard: `inspection_signatures` rows are insert-only; only `is_voided`/`voided_*` may update. |
| **Foreign-key on-delete review** | Audit every FK: audit logs and signatures should `RESTRICT` or `SET NULL` (never cascade away compliance evidence); structural children (`cells`, `responses`) `CASCADE`. |
| **Uniqueness** | `forms.slug`, `users.email`, `employees.employee_id` already unique — keep. Add `UNIQUE(workspace_id, employee_id)` if badge IDs are per-tenant. |

---

# PART E — APIs, Data Flow & End-to-End Workflows

## E.1 API structure

Adopt a **versioned, resource-oriented** layout. Keep Next.js route handlers as thin controllers; push logic into the domain services (Part C.3).

```
/api/v1
  /auth/*                         (login, logout, register, invite-accept)
  /workspaces                     GET, POST
  /workspaces/:id                 GET, PATCH, DELETE
  /workspaces/:id/members         GET, POST, PATCH, DELETE
  /workspaces/:id/boards          GET, POST
  /boards/:id  /groups /columns /items /automations /forms /export
  /items/:id   /cells /comments /inspections /timelogs /links
  /inspection-templates  /:id/sections/:sid/questions/:qid
  /inspections /:id/responses /submit /actions /signatures /pdf
  /sign/documents /:id/recipients /fields /send /void
  /sign/token/:token              (public signing surface)
  /employees /workshops /emp-projects /emp-tasks
  /time-logs /active
  /forms/slug/:slug  /:id/submit  (public intake)
  /notifications
  /admin/*                        (system-level, super-admin only)
```

**Standards to enforce platform-wide:**
- Every handler: `authN (middleware) → resolve workspace → authZ policy check → Zod validate → service call → typed response`.
- Consistent envelope: `{ data, error, meta }`; consistent pagination (`?cursor=&limit=`); consistent error codes.
- **Remove/secure the MVP liabilities**: delete `/api/auth/seed` (hardcoded admin) and `/api/auth/debug` (env + JWT disclosure) before any production deploy, or gate them behind a build-time flag + super-admin auth.

## E.2 End-to-end workflow examples (the platform working as one system)

**Workflow 1 — Inspection finds a defect → task created → remediated (Quality Loop)**
```
1. Inspector submits inspection  → POST /inspections/:id/submit
2. Service computes score, marks flagged responses, writes inspection row
   + writes event_outbox('inspection.submitted', {flaggedCount, itemLink})  [same txn]
3. Worker consumes event:
     → if flagged: Inspections service creates a corrective action
       → Boards service creates an item (task) on the target board, group "Corrective Actions"
       → inspection_actions.item_id = newItem.id ; entity_links(inspection→item, 'remediates')
     → Notifications: assignee + QC manager (in-app + email per prefs)
4. Assignee works the task on the board; status → "Done"
5. item.status_changed event → consumer flips inspection_action.status='resolved'
6. When all actions resolved → inspection.remediated event → dashboards/report update
```

**Workflow 2 — NCR → signed disposition → compliance closed (Compliance Loop)**
```
1. Inspection raises NCR (ncr_sequences increments atomically) → ncr.raised event
2. Sign service auto-prepares a disposition document from a template,
   recipients = [QC lead, Manager], entity_links(signdoc→inspection,'evidence_for')
3. Recipients sign via /sign/token/:token  → signdoc.completed event
4. Inspection consumer advances NCR status to 'dispositioned'
5. inspection_audit_log + sign_events together form the cross-module audit trail
```

**Workflow 3 — Public intake → triage → assignment (Intake Loop, partly exists)**
```
1. Customer submits public form → POST /forms/:id/submit (no auth)
2. Board item created + cells filled → form.submitted event
3. Automation routes item to a group + sets owner + notifies
4. (optional) automation spawns an inspection from a linked template
```

**Workflow 4 — Labor tracking rolls up (Labor Loop)**
```
1. Worker clocks in via badge+PIN against emp_task linked to a board item
2. timelog.checked_out event with durationMinutes
3. Roll-up consumer aggregates minutes onto the board item (a 'time spent' column)
   and onto any inspection linked to that item → effort/cost reporting
```

**Workflow 5 — One clocked-in shift, end to end (the connected-employee journey)**
This is the target experience: one employee, one identity, everything he does linked to the work and tracked at every level.
```
1. CLOCK IN (scope ladder, B.4)
   Employee opens kiosk → picks Workspace=Plant-A → Board=Welding QC → Task=Job#4471 → Clock In + photo
   → +INSERT time_logs { employee_id, workspace_id, board_id, item_id=Job#4471, status='active', check_in_photo }
   → ⊕ event_outbox('timelog.checked_in') → activity_feed row (item_id=Job#4471, 'clocked_in')

2. WORK THE BOARD
   Updates Job#4471 status / cells on the board
   → cell_values ~UPDATE + activity_log + event_outbox('item.status_changed') → automations + activity_feed

3. DO AN INSPECTION (two equally-valid paths, both land on the task)
   Path A (from the task):   open Job#4471 → "New Inspection" → template pre-linked to this task
   Path B (from inspections): start an inspection → manually pick Workspace→Board→Task=Job#4471 (B.4 picker)
   → +INSERT inspections { workspace_id, board_id, item_id=Job#4471, template_snapshot, status='in_progress' }
   ... answer questions → inspection_responses ... sign section → inspection_signatures (same employee identity)
   → SUBMIT → ~UPDATE inspections(status='completed', score) → generate PDF → store report path
   → ⊕ event_outbox('inspection.submitted') → activity_feed('inspection_submitted', item_id=Job#4471)
   ► RESULT: the inspection + its 📄 PDF report now appear under Job#4471 ▸ Inspections tab (B.5.2)
   ► If flagged → auto-creates a corrective-action item + notifies (Quality Loop)

4. CREATE A PROCESS DOCUMENT (creator's choice, B.4 mode=optional)
   Option A: link to Job#4471  → sign_documents { workspace_id, board_id, item_id=Job#4471 }
                                   + entity_links(signdoc→inspection,'evidence_for') if attached to the report
   Option B: leave GENERAL     → sign_documents { workspace_id only, link_level='none' }
   → on completion: ⊕ event_outbox('signdoc.completed') → activity_feed
   ► If linked: the document shows under Job#4471 ▸ Documents tab; if general, it lives at workspace level only

5. CLOCK OUT
   → ~UPDATE time_logs(check_out_at, duration_minutes, status='completed')
   → ⊕ event_outbox('timelog.checked_out') → roll-up consumer adds minutes to Job#4471 'time spent'

► TRACKED AT EVERY LEVEL (B.5):
   • Task Job#4471 detail = his time + the inspection report PDF + the linked document + comments + timeline
   • Welding QC board    = total labor hrs, avg inspection score, open actions, docs pending
   • Plant-A workspace   = portfolio roll-up across all boards
   • "Everything this employee did this shift" = activity_feed WHERE actor_user_id = him (one identity)
```

## E.3 Event-driven & background processing

| Job class | Mechanism | Examples |
|---|---|---|
| **Reactive (event-driven)** | outbox → worker → consumers | automations, notifications, corrective-action creation, roll-ups |
| **Scheduled (cron)** | Vercel Cron / external scheduler hitting a secured route, or a standalone worker | `date_reached` automations, due-date reminders, NCR aging, daily digest emails, session cleanup |
| **Heavy / async** | queue (BullMQ on Redis, or `pg-boss` if staying Postgres-only) | PDF generation & merge, bulk export, email batches, image processing for clock-in photos |

> **Recommendation:** On Vercel, the in-memory rate limiter and any in-process worker won't survive serverless scaling. Run the worker as a **dedicated long-running service** (Render/Fly/Railway/a small container) consuming the outbox + queue, with Redis for queue/rate-limit/cache. This is the resurrection of the (now-deleted) `worker.py` concept — but in TypeScript, sharing the Drizzle schema.

---

# PART F — Non-Functional Architecture

## F.1 Authentication, authorization & RBAC

- **AuthN:** Keep NextAuth v5 + JWT. Add **`middleware.ts`** as the single gate: reject unauthenticated requests to `/dashboard/*` and `/api/v1/*` (allowlist public surfaces: `/forms/[slug]`, `/sign/[token]`, `/time-clock`, auth routes). This replaces today's per-route `auth()` repetition and closes the "forgot to check auth on a new route" risk.
- **Tenant resolution:** middleware resolves the active workspace (from path/header/session) and attaches it to the request context; services *always* filter by it.
- **AuthZ — one policy function.** Replace ad-hoc checks with a central `can(actor, action, resource)`:
  - Layer 1: global role (`admin/manager/user/worker`).
  - Layer 2: workspace membership role + `canAccess*` module flags.
  - Layer 3: resource ACLs (`board_column_permissions`, `board_item_permissions`).
  - Evaluated in order; deny-by-default. Every service entry point calls it.
- **Roadmap:** add **OIDC/SSO** (the original `README_NEXT_STEPS` intent) for enterprise customers; map IdP groups → workspace roles.

## F.2 Scalability & performance

- **DB:** connection pooling (PgBouncer / Neon pooler); read replicas for reporting/dashboards once read load grows; partition high-volume append tables (`*_audit_log`, `time_logs`, `event_outbox`) by month when needed.
- **Caching:** Redis for sessions hot-path, rate-limiting (replace the in-memory limiter — it's a no-op across serverless instances), and computed dashboard aggregates.
- **Query hygiene:** the `cellValues` EAV model is flexible but join-heavy — add the composite indexes in D.2, and consider a materialized "board view" per board for fast grid reads at scale.
- **Files:** keep object storage (Supabase/S3) but **make buckets private** + serve via signed URLs (today the bucket is public — inspection photos and signed PDFs are world-readable by URL). This is both a perf and security fix.

## F.3 Security (priority fixes flagged from the scan)

1. **Delete or gate `/api/auth/seed`** — unauthenticated hardcoded-admin creation.
2. **Delete or gate `/api/auth/debug`** — leaks env config, table list, cookie names, decoded JWT.
3. **Private storage buckets + signed URLs.**
4. **Real distributed rate limiting** (Redis) on auth + public endpoints (forms/sign are unauthenticated and abuse-prone).
5. **Centralized authZ + middleware** (F.1) to eliminate inconsistent per-route enforcement.
6. **Input validation everywhere** via Zod at the controller boundary (already partially present in `lib/validations`).
7. **Audit immutability** (D.6) for signatures and audit logs.
8. **Secrets**: ensure `.env*` stays gitignored (it is) and add `.env.example` for onboarding without real values.

## F.4 Maintainability

- **Module boundaries** (Part C.3) enforced via lint rules (e.g., `eslint-plugin-boundaries`) so module A can't import module B's tables.
- **Shared schema, single source of truth** in `lib/db/schema.ts` consumed by app + worker.
- **Testing:** today only 3 Jest files exist for ~28k LOC. Target: unit tests for every domain service (scoring already has one — extend the pattern), integration tests against a Testcontainers Postgres, and contract tests for public endpoints.
- **Delete the dead Python/Vite stack** (`app/`, `worker.py`, `webui/`, `alembic/`, `helm/`) to remove confusion — it's vestigial from the pre-rewrite era.
- **Observability:** structured logging (the `logger` exists), request tracing, and metrics (the original plan named Prometheus/OpenTelemetry — keep that goal); a dead-letter view for failed outbox events.

## F.5 Clean separation of concerns (the deployment topology)

```
Frontend (Next.js pages/components)          ── Vercel
Backend API (Next.js route handlers)         ── Vercel (serverless)
Domain services (TS modules)                 ── shared library, runs in API + worker
Database (PostgreSQL)                         ── Neon / managed Postgres (+ replicas)
Queue + cache (Redis)                         ── Upstash / managed Redis
Worker jobs (event consumers + cron + heavy)  ── dedicated container (Render/Fly/Railway)
Object storage (private buckets)              ── Supabase Storage / S3 + signed URLs
External: email (Resend), future SSO (OIDC), webhooks
```

---

# PART G — Implementation Roadmap (MVP → Production)

Phased so each phase ships value and de-risks the next. Exit criteria are concrete and testable.

### Phase 0 — Stabilize & secure (1–2 weeks)
- Delete/gate `seed` + `debug` endpoints; private storage buckets + signed URLs; Redis-backed rate limit.
- Add `middleware.ts` (single authN gate) without changing route logic yet.
- Remove dead Python/Vite directories. Add `.env.example`.
- **Exit:** no unauthenticated admin path; no public file URLs; all `/dashboard` + `/api/v1` gated.

### Phase 1 — Tenancy correctness (2–3 weeks)
- Add `workspace_id` to Employee/Time-Clock tables (backfill → NOT NULL, two-step migration).
- Denormalize `workspace_id` onto `items`; add composite tenant indexes.
- Make nullable tenancy NOT NULL where decided (D.2).
- **Exit:** every operational row is workspace-scoped; tenant-isolation test suite passes (workspace A cannot read workspace B's data via any endpoint).

### Phase 2 — Identity unification (2 weeks)
- Introduce `employees.user_id` FK; backfill; migrate reporting to use `users` as canonical.
- Add `worker` role + badge/PIN time-clock auth path.
- **Exit:** "everything Person X did" resolvable in one join; no orphan employee identities.

### Phase 3 — Event backbone (3 weeks)
- Add `event_outbox`; producers write events in-transaction for `item.*`, `inspection.*`, `form.*`, `timelog.*`, `signdoc.*`.
- Stand up the dedicated **worker service**; move automations + notifications to consume the outbox.
- Unify notifications (retire `statusNotifications` into the automation engine; add `notification_preferences`).
- **Exit:** every cross-module side effect flows through the bus; no lost events under failure injection; one rules engine.

### Phase 4 — Close the business loops (3–4 weeks)
- Corrective actions → board items (Quality Loop), with `inspection_actions.item_id` + bi-directional status sync.
- `entity_links` table for sign-doc ↔ inspection/item; NCR → signed disposition (Compliance Loop).
- Time-log roll-up onto items/inspections (Labor Loop).
- **Configurable Linking & Scope Governance (B.4 / D.5b):** add `link_policies` + ancestry columns on `inspections`/`time_logs`/`sign_documents`; build the shared progressive-disclosure linker component + server-side policy enforcement; admin UI to set the 3 dials per module.
- **Exit:** Workflows 1–4 (E.2) demonstrable end-to-end with audit trail; a single artifact can be created `general` or linked at any allowed rung, and admin policy is enforced on both client and server.

### Phase 5 — Service boundaries & scale (3–4 weeks)
- Refactor into `modules/*` domain services with enforced import boundaries.
- Read replica for dashboards; materialized board views; partition audit/outbox tables.
- Heavy jobs (PDF, export) moved to the queue.
- **Exit:** module-boundary lint passes; p95 board-load and dashboard queries within target under load test.

### Phase 6 — Enterprise hardening (ongoing)
- OIDC/SSO; observability (tracing + metrics + dead-letter dashboard); comprehensive test coverage; soft-delete/archive everywhere; data-retention & audit-export tooling.
- **Exit:** SOC-style audit trail complete; SSO live; test coverage targets met.

---

## Summary of the redesign in one paragraph

Make the **board item the connective spine**, enforce the **workspace as a hard tenant boundary on every table**, collapse **users/employees into one identity**, route **all cross-module effects through a transactional-outbox event bus consumed by a dedicated worker**, and close the **quality/compliance/labor/intake loops** so an inspection failure becomes a tracked task, an NCR becomes a signed disposition, and labor/evidence roll up to the work they belong to. The existing schema is a strong foundation — the work is largely additive (tenancy columns, identity FK, action→item link, outbox, generic entity-links) plus operational hardening (middleware authZ, private storage, Redis rate-limit/queue, killing the seed/debug endpoints). Delivered in phases, each shipping value, the MVP becomes a coherent, scalable, interconnected product platform.

---

*Prepared from a full read of the active Next.js codebase (`src/`, schema, services, and representative API routes). No source files were modified.*
