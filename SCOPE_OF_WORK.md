# Scope of Work
## Enterprise Quality Management System (QMS) Platform

**Document Version:** 1.0  
**Prepared For:** [Client Name]  
**Prepared By:** [Your Company / Developer Name]  
**Date:** March 2026  
**Confidentiality:** This document is confidential and intended solely for the named recipient.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Overview](#2-project-overview)
3. [Full Technology Stack](#3-full-technology-stack)
4. [Feature Scope](#4-feature-scope)
5. [Architecture Overview](#5-architecture-overview)
6. [Deliverables](#6-deliverables)
7. [Out of Scope](#7-out-of-scope)
8. [Assumptions & Dependencies](#8-assumptions--dependencies)
9. [Timeline Estimate](#9-timeline-estimate)
10. [Effort & Pricing Estimate](#10-effort--pricing-estimate)

---

## 1. Executive Summary

This document defines the full Scope of Work for designing, developing, and deploying an **Enterprise Quality Management System (QMS)** — a unified, web-based platform that consolidates six core operational modules into a single interconnected system. The platform is purpose-built for organizations that require structured processes around workforce management, quality inspections, project tracking, document compliance, and time tracking — all governed by a centralized, role-based access model.

A functional MVP has been built and validated. This SOW covers the productionization of that MVP into a hardened, scalable, multi-tenant enterprise product fit for client deployment.

---

## 2. Project Overview

### 2.1 What the Platform Does

The QMS Platform replaces fragmented spreadsheets, standalone apps, and manual processes with a single operational hub organized around **Workspaces**. A workspace represents a business unit, department, or project environment — and every module in the system operates within that workspace context.

The six core modules are:

| Module | Purpose |
|---|---|
| **Project & Task Boards** | Monday.com-style Kanban board for managing projects (groups) and tasks (items) with fully customizable column types |
| **Inspections** | Template-driven inspection and audit system linked directly to board tasks, with scoring, corrective actions, and completion reports |
| **Employee Management** | Employee records, department and workshop assignment, project/task allocation, and attendance tracking |
| **Time Clock** | Public-facing employee clock-in/out system with workspace-linked time tracking surfaced inside task boards |
| **Document Signing** | Multi-recipient e-signature workflow for compliance documents, linked to workspaces and tasks |
| **User Management** | Invitation-based user registry with role enforcement, employee linking, and per-workspace permission management |

### 2.2 Business Value

- **Eliminates silos** — inspection results, clock-in data, and document sign-offs are directly associated with the tasks they belong to
- **Configurable by workspace** — labels, terminology, views, and permissions are fully customizable per workspace, allowing a single system to serve multiple departments or clients
- **Compliance-ready** — full audit trail, signed documents, inspection reports, and role-separated access controls
- **Reduces administration overhead** — automated email alerts on status changes, centralized user and permission management

---

## 3. Full Technology Stack

### 3.1 Frontend

| Technology | Purpose | Production Version |
|---|---|---|
| **Next.js** | Full-stack React framework (App Router, SSR, API Routes) | 15.x LTS |
| **React** | UI component library | 19.x |
| **TypeScript** | Static typing across frontend and backend | 5.x |
| **Tailwind CSS** | Utility-first CSS framework | 4.x |
| **Radix UI / shadcn/ui** | Accessible headless component primitives | Latest stable |
| **Lucide React** | Icon library | Latest stable |
| **React Hook Form + Zod** | Client-side form handling and schema validation | Latest stable |

### 3.2 Backend & API

| Technology | Purpose | Production Version |
|---|---|---|
| **Next.js API Routes** | RESTful API layer (server-side, co-located) | 15.x LTS |
| **Drizzle ORM** | Type-safe SQL query builder and schema manager | 0.40.x |
| **PostgreSQL** | Primary relational database | 16.x |
| **Redis** | Session caching, rate-limiting, real-time pub/sub | 7.x |
| **NextAuth v5 (Auth.js)** | Authentication framework (JWT + database sessions) | 5.x stable |

### 3.3 Communication & Notifications

| Technology | Purpose | Production Version |
|---|---|---|
| **Resend** | Transactional email delivery (status alerts, invitations, signed docs) | API v1 |
| **React Email** | HTML email templates | Latest stable |
| **WebSockets / Pusher** | Real-time board updates (optional enterprise tier) | Pusher Channels |

### 3.4 File Storage & Media

| Technology | Purpose | Production Version |
|---|---|---|
| **AWS S3 / Cloudflare R2** | Document storage, employee avatars, inspection attachments | Current |
| **UploadThing / Presigned URLs** | Secure client-side file upload pipeline | Latest stable |

### 3.5 Infrastructure & Hosting

| Technology | Purpose | Production Version |
|---|---|---|
| **Vercel** | Primary hosting (frontend + API routes, edge-optimized) | Enterprise plan |
| **Neon / Supabase / AWS RDS** | Managed PostgreSQL with connection pooling | PostgreSQL 16 |
| **Upstash Redis** | Serverless Redis for caching and rate limiting | Current |
| **Cloudflare** | CDN, DDoS protection, DNS management | Current |

### 3.6 DevOps & CI/CD

| Technology | Purpose |
|---|---|
| **GitHub Actions** | Automated CI pipeline (lint, typecheck, test, deploy) |
| **Docker** | Containerized local development environment |
| **Drizzle Kit** | Database schema migrations and versioning |
| **ESLint + Prettier** | Code quality and formatting enforcement |
| **Vitest / Playwright** | Unit tests and end-to-end browser tests |

### 3.7 Observability & Security

| Technology | Purpose |
|---|---|
| **Sentry** | Error tracking and performance monitoring |
| **Axiom / Datadog** | Structured application logging and dashboards |
| **Zod** | Runtime API request validation |
| **Helmet / Security Headers** | HTTP security hardening |
| **OWASP-aligned practices** | SQL injection prevention, XSS/CSRF protection, rate limiting |

---

## 4. Feature Scope

### 4.1 Authentication & User Management

**MVP (Built)**
- Email/password registration with invitation-only flow
- NextAuth JWT sessions with role-based guards (admin / manager / user)
- User approval workflow (pending → active)
- User-to-employee record linking
- Role management and user deactivation

**Enterprise Additions**
- SSO integration (Google Workspace, Microsoft Entra ID / Azure AD) via SAML 2.0 / OIDC
- Two-factor authentication (TOTP / SMS fallback)
- Session management dashboard (view and revoke active sessions)
- IP allowlisting and login audit log
- Configurable password policy (minimum strength, rotation, history)
- SCIM provisioning for automated user sync from HR systems
- Account lockout after failed attempts with admin unlock

---

### 4.2 Workspaces

**MVP (Built)**
- Create, edit, and delete workspaces with color coding
- Per-workspace member management with four access permission toggles (Boards, Inspections, Document Signing, Time Clock)
- Workspace member roles (owner, admin, member)
- Custom label configuration per workspace (rename Boards, Groups, Items, Projects, Tasks, Workshops)
- Labels propagated consistently across all sub-modules when displayed in context

**Enterprise Additions**
- Multi-tenant separation — organizations can have isolated data environments
- Workspace templates (clone a workspace structure including board layouts, inspection templates, and permission presets)
- Workspace-level audit log (who changed what, and when)
- Workspace archiving with data retention policies
- Sub-workspace hierarchy (e.g., Division → Department → Team)

---

### 4.3 Project & Task Boards (PM Boards)

**MVP (Built)**
- Monday.com-style board with Groups (projects) and Items (tasks)
- Fully configurable column types: text, number, status, dropdown, date, person, checkbox, URL, phone, email, rating, progress, tags, timeline
- Cell-level data entry with real-time save
- Drag-and-drop item reordering
- Activity log per item
- Board-level column permission controls (view/edit per user per column)
- Item-level row permissions (view/edit per user per item)
- Status change → email notification rules (configurable per column, per trigger value, per recipient list)
- Item Detail Panel: linked inspections and time logs visible from within the board task
- Board settings panel for managing permissions and notification rules

**Enterprise Additions**
- Real-time collaborative editing (WebSocket-based live board updates)
- Multiple board views: Table, Kanban, Calendar, Gantt/Timeline, Chart
- Board dashboard with aggregated widgets (count, sum, average per column)
- Cross-board item linking and dependencies
- Automations engine (if [column] changes to [value] → [action]) with no-code rule builder
- Item templates (create pre-populated items from saved templates)
- Bulk item operations (move, delete, reassign, change status)
- CSV / Excel import & export
- Public board shareable link (read-only external view)
- Board search and advanced filtering
- @mentions and comments on items with notification delivery

---

### 4.4 Inspections Module

**MVP (Built)**
- Inspection template builder (sections, questions, scoring, required flags)
- Launch inspections from templates
- Complete inspection forms with response capture
- Inspection scoring and status (draft, in-progress, completed, failed)
- Corrective actions per inspection
- Inspection-to-board-item linking (inspection results visible in task detail)
- Workspace-scoped inspection records

**Enterprise Additions**
- Conditional question logic (show/hide questions based on prior answers)
- Photo and file attachment capture per question (mobile-optimized)
- Inspection scheduling and recurring inspection calendar
- PDF report generation (branded, auto-generated on completion)
- QR code-based inspection initiation (scan to open a specific template for a location/asset)
- Inspection dashboard with pass/fail rates, trends over time, open corrective actions
- Multi-stage approval workflow (inspector → supervisor → QA sign-off)
- Historical comparison (current inspection score vs. previous three)
- Offline-capable mobile inspection form (PWA)

---

### 4.5 Employee Management

**MVP (Built)**
- Employee records (ID, name, email, phone, department, designation, joining date, avatar, status)
- Workshop management (physical locations or work cells employees belong to)
- Project and task allocation per employee
- Status lifecycle (active, inactive, on leave)
- Employee ID linked to system user account
- Admin/manager-only access enforcement

**Enterprise Additions**
- Org chart visualization
- Leave request and approval workflow
- Document repository per employee (contracts, certifications, ID proofs)
- Skill matrix and competency tracking
- Employee onboarding checklist (triggered on creation)
- Bulk import from CSV / HRMS integration
- Custom employee fields (configurable per organization)
- Department-level reporting with headcount, attendance, and task completion metrics

---

### 4.6 Time Clock

**MVP (Built)**
- Public-facing clock-in/out page (no authentication required)
- Employee lookup by name/ID before clocking
- Active session detection (prevents double clock-in)
- Time log records with employee, project, task, workshop context
- Admin time log management (correction, deletion)
- Time log-to-board-item linking (clock-in records visible in task detail)
- Workspace-scoped tracking

**Enterprise Additions**
- Biometric / PIN-based verification before clock-in (kiosk mode)
- Geofenced clock-in (GPS coordinates validated against site boundaries)
- Break tracking (start/end break within a shift)
- Overtime calculation and threshold alerts
- Shift scheduling and expected hours versus actual comparison
- Weekly/monthly payroll-ready timesheet export (CSV, PDF, integrated with payroll APIs)
- Manager approval workflow for timesheet submissions
- Mobile-responsive PWA for remote field workers
- Time clock analytics dashboard (attendance heatmap, late arrivals, absenteeism trends)

---

### 4.7 Document Signing

**MVP (Built)**
- Upload documents and define signature fields (drag-and-drop placement)
- Multi-recipient signing workflow with status tracking (pending, signed, declined)
- Signed document archive per workspace
- Event log (who signed, when, IP address)
- Document workspace association

**Enterprise Additions**
- Legally binding audit trail with certificate of completion (PDF)
- Email delivery of signing requests with branded templates and reminders
- Signing order enforcement (sequential vs. parallel recipient flows)
- Decline with reason and re-send capability
- Bulk send (one document to many recipients in a single operation)
- Document templates with pre-placed fields
- Signer identity verification (OTP to email/phone before signing)
- Document expiry and auto-void on deadline
- Integration-ready webhook on completion event
- Compliance mode: enforce qualified electronic signature standards (eIDAS)

---

### 4.8 Notifications & Alerts

**MVP (Built)**
- Configurable status-change email notifications per board column/value/recipient
- Transactional email via Resend (invitations, verifications)

**Enterprise Additions**
- In-app notification center (bell icon, unread badge, mark-all-read)
- Push notifications (browser native / mobile PWA)
- Notification digest (daily/weekly summary emails)
- Slack / Microsoft Teams webhook integration
- User-configurable notification preferences (opt-in/out per event type)

---

### 4.9 Reporting & Analytics

**MVP (Built)**
- Employee attendance and time log reports
- Inspection summary (score, status per record)

**Enterprise Additions**
- Central analytics dashboard with KPI tiles (configurable per workspace)
- Board reporting: task completion rates, time in status, overdue items
- Inspection analytics: trend charting, failure rate by template/section, top defect categories
- Time tracking analytics: total hours per employee/project/department, overtime alerts
- Document compliance report: pending signatures, expired documents
- Custom report builder (select data source, group by, filter, export)
- Scheduled report delivery (auto-email PDF reports on a defined cadence)

---

### 4.10 Platform Administration

**Enterprise Additions (Not in MVP)**
- Global admin console (organization settings, billing, plan limits)
- Audit log viewer (searchable, filterable, exportable log of all user actions platform-wide)
- Data retention and deletion policies (GDPR / CCPA tools)
- API key management (issue and revoke keys for external integrations)
- Webhook management (configure outbound webhooks for any platform event)
- White-label support (custom domain, logo, brand colors, email sender identity)
- Usage analytics (active users, API calls, storage consumption)

---

## 5. Architecture Overview

### 5.1 High-Level System Design

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Client Layer                                 │
│  Browser (Next.js SSR/CSR)  │  Mobile PWA  │  Time Clock Kiosk      │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │ HTTPS
┌────────────────────────────────▼─────────────────────────────────────┐
│                      Edge / CDN Layer                                │
│              Cloudflare (CDN, WAF, DDoS Protection)                  │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
┌────────────────────────────────▼─────────────────────────────────────┐
│                    Application Layer (Vercel)                        │
│                                                                      │
│  ┌─────────────────┐   ┌─────────────────┐   ┌──────────────────┐   │
│  │  Next.js Pages  │   │  API Routes     │   │  Auth.js (JWT)   │   │
│  │  (App Router)   │   │  /api/**        │   │  Session Mgmt    │   │
│  └─────────────────┘   └────────┬────────┘   └──────────────────┘   │
│                                 │                                    │
│  ┌──────────────────────────────▼───────────────────────────────┐   │
│  │                   Business Logic Layer                        │   │
│  │  Drizzle ORM  │  Zod Validators  │  Email (Resend)           │   │
│  │  Notifications Engine  │  File Upload (S3)                   │   │
│  └──────────────────────────────┬───────────────────────────────┘   │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
       ┌─────────────────────────┼────────────────────────┐
       │                         │                        │
┌──────▼──────┐         ┌────────▼──────┐       ┌────────▼──────┐
│  PostgreSQL  │         │    Redis      │       │   AWS S3 /    │
│  (Primary   │         │   (Cache,     │       │  Cloudflare   │
│   Database) │         │  Rate Limit)  │       │     R2        │
└─────────────┘         └───────────────┘       └───────────────┘
```

### 5.2 Frontend Architecture

- **App Router** with server components for initial data fetching (zero client-side waterfall for primary views)
- **Client components** scoped to interactive UI islands (boards, forms, panels)
- **Route-level code splitting** — each module loads independently
- **Middleware-enforced access control** — all routes validated before page render
- **Optimistic UI updates** for board cell edits to maintain perceived performance

### 5.3 Database Design

- **Schema-per-tenant** or **row-level tenant isolation** depending on chosen multi-tenancy model
- Workspaces as the organizational boundary for all business data
- Normalized relational schema with typed enums for all status fields
- JSON columns used only for flexible payloads (column config, notification recipient lists)
- All tables include `created_at` and `updated_at` for audit purposes
- Full-text search indexes on names and identifiers

### 5.4 API Design

- **REST API** following resource-oriented URL conventions
- Consistent response envelope: `{ data, error, meta }`
- All endpoints validate input via **Zod schemas** before touching the database
- **Role checks and workspace membership checks** on every route
- Pagination on all list endpoints
- Rate limiting per user per endpoint via Redis sliding window

### 5.5 Security Architecture

- All secrets in environment variables (never committed to source control)
- **Short-lived JWT tokens** with server-side session store for revocability
- HTTPS enforced at edge; all cookies `Secure`, `HttpOnly`, `SameSite=Strict`
- Input sanitization on all user-supplied content
- File uploads scanned and MIME-validated before storage
- Database credentials rotated via infrastructure secrets manager
- Regular **dependency vulnerability scanning** (Dependabot / Snyk)

---

## 6. Deliverables

The following are the concrete outputs the client will receive upon project completion:

### 6.1 Software Deliverables

| # | Deliverable | Description |
|---|---|---|
| 1 | **Source Code Repository** | Full codebase in a private GitHub repository with structured branching (main, staging, dev) |
| 2 | **Production Deployment** | Live application deployed on Vercel with custom domain, SSL, and CI/CD configured |
| 3 | **Database Schema** | Versioned PostgreSQL schema with all Drizzle migration files |
| 4 | **Environment Configuration Guide** | All required environment variables documented with setup instructions |
| 5 | **Admin Seed Script** | Script to create the first admin user and seed reference data |

### 6.2 Module Deliverables

| # | Module | Included |
|---|---|---|
| 6 | **Authentication** | Sign in, sign up, invitation, email verification, role management, SSO (enterprise) |
| 7 | **Workspace Management** | Create/manage workspaces, members, permissions, custom labels |
| 8 | **PM Boards** | Full board with all column types, views, permissions, notifications, automations |
| 9 | **Inspections** | Template builder, inspection runner, report generator, board linking |
| 10 | **Employee Management** | Employee records, workshops, projects/tasks, org chart, reporting |
| 11 | **Time Clock** | Public kiosk interface, shift tracking, timesheets, board integration |
| 12 | **Document Signing** | Upload, field placement, multi-recipient workflow, audit certificate |
| 13 | **Analytics Dashboard** | Workspace KPIs, inspection trends, time tracking, board reporting |
| 14 | **Admin Console** | Platform administration, audit log, user management, API keys |

### 6.3 Documentation Deliverables

| # | Deliverable | Description |
|---|---|---|
| 15 | **System Architecture Document** | Technical reference covering all layers of the architecture and data flows |
| 16 | **API Reference** | Complete API documentation (auto-generated via OpenAPI / Swagger) |
| 17 | **Admin User Guide** | Step-by-step guide for platform administrators |
| 18 | **End User Guide** | Guide covering Boards, Inspections, Signing, and Time Clock for standard users |
| 19 | **Deployment & Operations Guide** | Infrastructure setup, environment variables, scaling, backup, and monitoring runbook |

### 6.4 Quality Assurance

| # | Deliverable | Description |
|---|---|---|
| 20 | **Unit Test Suite** | Vitest tests covering API handlers, utility functions, and critical business logic |
| 21 | **End-to-End Test Suite** | Playwright tests covering all primary user flows |
| 22 | **Security Review Report** | Summary of OWASP checklist items addressed and any remaining risk notes |

---

## 7. Out of Scope

The following items are **explicitly excluded** from this engagement unless separately agreed in writing:

- **Native mobile applications** (iOS / Android) — the platform will be mobile-responsive and PWA-capable, but native app development is not included
- **Legacy system data migration** — importing existing data from spreadsheets, older systems, or third-party tools is not included; a data import template and tooling will be provided for the client to execute independently
- **Custom hardware integration** — biometric devices, physical RFID readers, or PLC/IoT machine connections are not included
- **Payroll engine** — while timesheet exports suitable for payroll input are included, an integrated payroll calculation engine is out of scope
- **ERP / SAP / Oracle integration** — API hooks will be provided, but building custom connectors to third-party ERP systems is not included
- **Multi-language / i18n** — the platform will be delivered in English only; localization framework can be added as a separate workstream
- **Offline-first thick-client** — except for the PWA time clock, the platform requires an active internet connection
- **Dedicated infrastructure management** — this engagement covers deployment setup; ongoing infrastructure management and SRE support are not included unless contracted separately
- **Legal compliance certification** — while the platform is designed with compliance in mind, formal certification (ISO 27001, SOC 2, HIPAA BAA) is not included in this scope

---

## 8. Assumptions & Dependencies

### 8.1 Client Responsibilities

- The client will provide a designated product owner / point of contact with decision-making authority available for weekly review calls
- The client will provide brand assets (logo, color palette) within the first week of the project
- The client will arrange procurement and billing for third-party services listed below
- The client will provide test data and at least two internal staff members for UAT (User Acceptance Testing)
- The client is responsible for final user training and internal change management

### 8.2 Third-Party Services (Client to Procure)

| Service | Purpose | Estimated Monthly Cost |
|---|---|---|
| **Vercel Pro / Enterprise** | Application hosting | $20–$400/mo |
| **Neon / AWS RDS PostgreSQL** | Managed database | $25–$200/mo |
| **Upstash Redis** | Caching and rate limiting | $10–$50/mo |
| **Resend** | Transactional email | $20–$90/mo |
| **AWS S3 or Cloudflare R2** | File and document storage | $5–$30/mo |
| **Sentry** | Error tracking | Free–$26/mo |
| **GitHub** | Source code repository | $0–$21/mo |
| **Cloudflare** | CDN and DNS | Free–$200/mo |

> All cost estimates are approximate and will vary with usage volume. Total infrastructure starting cost for a production deployment with up to 100 users is approximately **$100–$400/month**.

### 8.3 Technical Prerequisites

- A registered domain name pointing to the deployment environment
- Valid SSL certificate (auto-provisioned via Vercel / Cloudflare)
- SMTP / email domain verification for transactional email (Resend DNS records)
- If SSO is required: access to the client's identity provider (Google Workspace admin or Azure AD tenant) to configure the OAuth application

### 8.4 General Assumptions

- Requirements are substantially defined by the MVP; enterprise additions will be detailed in sprint planning at the start of each phase
- Any changes to scope that add more than two business days of effort will be treated as a change request and priced separately
- The client's users will access the system via modern browsers (Chrome 120+, Firefox 120+, Safari 17+, Edge 120+)
- The platform will initially be designed for up to 500 concurrent users; scaling beyond that is achievable through infrastructure adjustments without application changes

---

## 9. Timeline Estimate

The project is structured into five phases. Estimated durations assume full-time engagement by the development team.

### Phase 1 — Foundation & Infrastructure (Weeks 1–2)

- Production environment setup (Vercel, PostgreSQL, Redis, S3, CI/CD pipeline)
- Domain, SSL, email sending domain configuration
- Database migrations from MVP schema to production schema
- Security hardening (environment variables, headers, rate limiting)
- Staging environment setup
- **Milestone:** Platform accessible at staging URL, admin login functional

### Phase 2 — Core Module Production-Readiness (Weeks 3–7)

- PM Boards: real-time collaboration (WebSocket), additional views (Calendar, Kanban, Gantt), automations engine
- Inspections: conditional logic, file attachments, PDF report generation, scheduling
- Document Signing: email delivery, sequential signing, audit certificate
- Time Clock: geofencing, break tracking, timesheet approval workflow
- Employee Management: org chart, leave management, bulk import
- **Milestone:** All six modules feature-complete and passing QA

### Phase 3 — Enterprise Security & Administration (Weeks 8–10)

- SSO integration (Google, Microsoft)
- Two-factor authentication
- Global admin console
- Audit log implementation
- Data retention and GDPR tooling
- API key and webhook management
- **Milestone:** Security review completed, admin console deployed

### Phase 4 — Analytics, Reporting & White-Label (Weeks 11–13)

- Analytics dashboard (configurable KPI tiles)
- Custom report builder
- Email report scheduling
- White-label configuration (custom domain, logo, colors, email branding)
- Notification center (in-app + push)
- **Milestone:** Reporting module delivered, design review signed off by client

### Phase 5 — Testing, Training & Launch (Weeks 14–16)

- Full end-to-end test suite (Playwright)
- Performance testing and optimization (Lighthouse, load testing)
- UAT with client staff (bug-fix sprint included)
- Documentation finalization (Admin Guide, User Guide, API Reference)
- Production go-live (DNS cutover, smoke testing)
- Hypercare period (2 weeks post-launch support included)
- **Milestone:** Production launch ✓

**Total Estimated Duration: 16 weeks (4 months)**

> Timeline assumes timely feedback from the client at each milestone. Delays in feedback, scope additions, or late requirement changes will extend the timeline accordingly.

---

## 10. Effort & Pricing Estimate

### 10.1 Development Effort Breakdown

| Phase | Area | Estimated Hours |
|---|---|---|
| Phase 1 | Infrastructure & DevOps | 40 hrs |
| Phase 2 | Core Modules (all six) | 240 hrs |
| Phase 3 | Security & Admin Console | 80 hrs |
| Phase 4 | Analytics, Reporting, White-Label | 80 hrs |
| Phase 5 | Testing, Documentation, Launch | 80 hrs |
| **Total** | | **520 hrs** |

### 10.2 Pricing Options

| Model | Description | Indicative Price |
|---|---|---|
| **Fixed Price** | All deliverables at a fixed cost. Change requests billed separately. Best for well-defined scope. | **[Insert Rate]** |
| **Time & Materials** | Billed monthly at an agreed hourly or daily rate. Best for evolving requirements. | **[Insert Rate] / hr** |
| **Milestone-Based** | Fixed payments tied to the completion of each of the 5 phases. Balances predictability with flexibility. | **[Split across milestones]** |

### 10.3 Post-Launch Support Options

After the hypercare period, the following ongoing support tiers are available:

| Tier | Includes | Price |
|---|---|---|
| **Basic** | Bug fixes only, 5-day SLA, email support | [Rate] / month |
| **Standard** | Bug fixes + minor enhancements (up to 8 hrs/mo), 2-day SLA | [Rate] / month |
| **Premium** | Full feature development allocation (up to 20 hrs/mo), 4-hour SLA, dedicated Slack channel | [Rate] / month |

---

## Document Sign-Off

By signing below, both parties agree that this Scope of Work accurately represents the features, deliverables, and terms of the engagement.

| Party | Name | Signature | Date |
|---|---|---|---|
| Client | | | |
| Developer / Agency | | | |

---

*This document supersedes all prior verbal or written agreements regarding the scope of this project. Any modifications to this scope must be documented in a signed Change Request.*
