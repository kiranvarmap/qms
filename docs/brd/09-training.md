# BRD: Training & Certifications Module

> See [00 — Platform Interoperability Foundation](00-platform-interoperability.md).

## 1. Module Overview

Training & Certifications manages courses/workshops, enrollments, completion, and
the certifications they confer — including expiry tracking and re-training
triggers. It links to People (who is trained), Quality (competency for
inspections), and shop-floor work (who is qualified to do what).

## 2. Business Objectives

- Define and assign required training to roles/employees
- Track enrollment, completion, and scores
- Issue and track certifications with validity/expiry
- Trigger re-training before certifications lapse
- Prove competency for compliance/audits
- Gate work on required qualifications (advanced)

## 3. Target Users

HR/L&D · trainers · managers · employees/workers · quality/compliance · auditors.

## 4. User Roles

Training Admin · Trainer/Instructor · Manager · Employee (learner) · Compliance ·
Auditor · Viewer.

## 5. Feature Scope

Course/workshop catalog · sessions/schedules · enrollment · completion & scoring ·
certifications · expiry & renewal · required-training matrix (advanced) · content/
materials · assessments (advanced) · competency-gated work (advanced) · reports ·
audit.

## 6. Default Features

- **Course/workshop catalog** — title, description, category, duration, trainer,
  materials, certification conferred (optional).
- **Sessions** — schedule a session/workshop; capacity; date/location.
- **Enrollment** — assign/enroll employees; self-enroll (config).
- **Completion** — mark complete; record score/result; attach evidence.
- **Certification** — issue on completion; validity period; expiry date.
- **Records** — per-employee training & certification history.
- **Lists & search** — courses, enrollments, certifications; export.

## 7. Advanced Features

- **Required-training matrix** by role/department/work type.
- **Assessments/quizzes** with pass thresholds.
- **Renewal workflows** & recurring re-certification.
- **Competency-gated work** — block assignment to tasks needing a cert the
  worker lacks/expired.
- **External/online content (SCORM)** & certificates upload.
- **Trainer evaluation & feedback**.
- **Skills/competency framework** & gap analysis.

## 8. Key Workflows

**Assign → complete → certify** → assign course (`course.assigned`) → employee
attends → mark complete (`course.completed`) → certification issued
(`certification.issued`) with expiry → record updated.

**Expiry → re-train** → scheduled job (`cert-expiry.ts`) detects approaching
expiry → `certification.expiring` → notify employee+manager → enroll renewal.

**Competency gate (advanced)** → task requires cert → system checks employee
certifications → block/allow assignment.

## 9. Screens / Pages Required

Course Catalog · Create/Edit Course · Session Scheduling · Enrollment List ·
Enroll/Assign · Completion entry · Certification Register · Expiry Dashboard ·
Employee Training Record · **Workshops** · Training Reports · Training Settings.

## 10. Key Data Fields

**Course** — id, title, category, description, duration, trainerId, certification
conferred, validity period, `workspaceId`.

**Session/workshop** — id, courseId, date, location, capacity, trainer, status.

**Enrollment** — id, courseId/sessionId, employeeId, status (assigned/in-progress/
completed/failed), score, completed date.

**Certification record** — id, employeeId, courseId, issue date, expiry date,
status (valid/expiring/expired), certificate file.

## 11. Business Rules

- Certification issued only on `completed` (passing) enrollment.
- Certification has issue + expiry; status auto-updates to expiring/expired.
- Expiring soon = within configurable window before expiry.
- Competency-gated tasks require a valid (non-expired) cert (advanced).
- Re-training creates a new enrollment; history retained.
- Enrollment scoped to the employee's workspace.

## 12. Permissions

view training · manage courses/sessions · enroll/assign · record completion ·
issue/revoke certification · view records · manage required-training matrix ·
export · manage settings.

## 13. Notifications & Alerts

Course assigned · session reminder · completion recorded · certification issued ·
certification expiring · certification expired · required training overdue ·
renewal due.

## 14. Reports & Dashboards

**Widgets:** trainings due · certifications expiring · completion rate ·
non-compliant employees · upcoming sessions.

**Reports:** training matrix/compliance · enrollment & completion · certification
register & expiry · skills-gap (advanced) · trainer/session summary.

## 15. Configuration Settings

Course categories · certification types & validity · expiry-warning window ·
required-training matrix · assessment thresholds · self-enroll rules ·
notifications · `link_policies`.

## 16. Audit Trail Requirements

Course/enrollment changes; completion & scores (who/when); certification issue/
revoke/expiry; renewal history; competency-gate decisions; activity-feed entry
per event.

## 17. MVP Scope

Course/workshop catalog · sessions · enroll/assign · completion & score ·
certification issue + expiry · per-employee records · expiry detection · reports ·
permissions · audit. *(Live: `src/lib/services/cert-expiry.ts`,
`/dashboard/{training,emp-workshops}`.)*

## 18. Future / Advanced Scope

Required-training matrix · assessments · renewal workflows · competency-gated work
· SCORM/online content · trainer evaluation · skills framework & gap analysis.

## 19. Interoperability & Integration

Training certifies **People** and supplies the competency signal to Quality and
shop-floor work assignment.

**Aggregate types:** `course`, `enrollment`, `certification_record`.

**Events emitted**

| Event | When | Payload |
|-------|------|---------|
| `course.assigned` | enrollment created | enrollmentId, employeeId, courseId |
| `course.completed` | completion recorded | enrollmentId, employeeId, score |
| `certification.issued` | cert granted | certId, employeeId, courseId, expiry |
| `certification.expiring` | nearing expiry (sweep) | certId, employeeId, expiry |

**Events consumed**

| From | Event | Reaction |
|------|-------|----------|
| HR | employee onboarding / role change | auto-assign required courses |
| Quality | inspection competency need | verify inspector certification |
| Production *(planned)* | `workorder.assigned` | check operator qualification (gate) |

**Shared entities & links** — enrollments/certifications reference `employee`
(FK). Certifications link to required-competency definitions and (advanced) to
tasks/work types via `entity_links` (`certification qualifies employee for …`),
enabling competency-gated assignment in HR/Production/Quality.

**Scope ladder** — training records are workspace-scoped (people-level); cert
checks surface at the item/task rung when gating work.

**Idempotency** — `certification.issued` keyed on (enrollmentId); the expiry
sweep emits `certification.expiring` edge-triggered once per crossing of the
warning window.

**Downstream** — HR consumes `certification.expiring` to flag re-training;
Notifications fan expiry alerts; the activity feed timelines training history per
employee.
