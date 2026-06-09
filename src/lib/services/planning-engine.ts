/**
 * Production Planning Engine (BRD 13).
 *
 * Pure-logic feasibility + finite-capacity scheduler. Given a work order it
 * answers: can we make this, when, what blocks it, and what decisions improve
 * the outcome. No side effects in `runPlanning` — it only reads. Persisting the
 * result (job stage schedules + conflicts + work-order dates) is a separate,
 * explicit step so the same engine powers what-if simulation safely.
 *
 * Resource model:
 *   • Materials  → stage materials override / supplement the global BOM;
 *                  availability = onHand − committed − other reservations,
 *                  plus incoming PO quantity with the earliest expected date.
 *   • Capacity   → each stage serializes onto its work center (finite capacity);
 *                  earliest start = max(predecessor end, work-center free time,
 *                  material-ready date). Working time spans an 8h/day calendar
 *                  (weekends skipped) unless overridden by overtime.
 *   • Manpower   → enough employees hold the required skill for the headcount.
 *   • Downtime   → a machine asset that is down/in-maintenance blocks its stage.
 *
 * See docs/brd/00-platform-interoperability.md — reuses stockLevels,
 * purchaseOrders, assets, employees, and the boms/bomLines material list.
 */

import { db } from "@/lib/db";
import {
  workOrders,
  processTemplates,
  processStages,
  stageMaterials,
  bomLines,
  boms,
  stockLevels,
  materialReservations,
  poLineItems,
  purchaseOrders,
  workCenters,
  workCenterMachines,
  assets,
  employeeSkills,
} from "@/lib/db/schema";
import { and, eq, inArray, ne, sql } from "drizzle-orm";

// ── Public types ──────────────────────────────────────────────────────

export interface PlanningOverrides {
  /** stageId → extra people added to that stage's pool (relieves manpower_short). */
  extraHeadcount?: Record<string, number>;
  /** poId → ISO date the PO is expedited to (relieves material/po_delay). */
  expeditePO?: Record<string, string>;
  /** Work-order IDs whose existing schedules are ignored (priority bumps them aside). */
  moveJobAside?: string[];
  /** Extend the working day (overtime) — productive hours per day. */
  hoursPerDay?: number;
  /** Earliest the job may start (ISO). Defaults to now. */
  requestedStartDate?: string;
}

export type DeliveryRisk = "low" | "medium" | "high" | "impossible";

export interface MaterialLine {
  componentProductId: string | null;
  description: string;
  required: number;
  available: number;       // onHand − committed − other reservations
  reserved: number;        // already reserved for OTHER work orders
  incoming: number;        // open PO quantity not yet received
  incomingDate: string | null;
  shortage: number;        // max(0, required − available)
  critical: boolean;
  unit: string;
  status: "available" | "incoming" | "short";
}

export interface StageSchedule {
  stageId: string;
  stageName: string;
  sequence: number;
  plannedStart: string;
  plannedEnd: string;
  workCenterId: string | null;
  workCenterName: string | null;
  requiredHeadcount: number;
  availableHeadcount: number;
}

export interface PlanningConflictResult {
  conflictType:
    | "material_shortage"
    | "machine_overload"
    | "manpower_short"
    | "skill_unavailable"
    | "maintenance_block"
    | "po_delay"
    | "delivery_impossible"
    | "no_template"
    | "no_work_center";
  severity: "warning" | "blocker";
  stageId: string | null;
  description: string;
  suggestedAction: string | null;
}

export interface PlanningResult {
  feasible: boolean;
  materialReadyDate: string;
  plannedStart: string;
  plannedEnd: string;
  deliveryRisk: DeliveryRisk;
  dueDate: string | null;
  materials: MaterialLine[];
  stages: StageSchedule[];
  conflicts: PlanningConflictResult[];
  capacityUtilization: Record<string, number>;
}

// ── Working-time helpers ────────────────────────────────────────────────
// A productive day runs `hoursPerDay` hours from 08:00; weekends are skipped.
// This keeps the scheduler deterministic without a full shift-calendar solver
// (that precision is a Phase-4 enhancement).

const DAY_START_HOUR = 8;

function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

/** Advance to the next working instant if `d` falls on a weekend / before shift. */
function normalizeToShift(d: Date): Date {
  const out = new Date(d);
  while (isWeekend(out)) {
    out.setUTCDate(out.getUTCDate() + 1);
    out.setUTCHours(DAY_START_HOUR, 0, 0, 0);
  }
  if (out.getUTCHours() < DAY_START_HOUR) out.setUTCHours(DAY_START_HOUR, 0, 0, 0);
  return out;
}

/** Add `minutes` of productive working time to `from`, spreading across days. */
function addWorkingMinutes(from: Date, minutes: number, hoursPerDay: number): Date {
  const endHour = DAY_START_HOUR + hoursPerDay;
  let cursor = normalizeToShift(new Date(from));
  let remaining = minutes;
  while (remaining > 0) {
    const dayEnd = new Date(cursor);
    dayEnd.setUTCHours(endHour, 0, 0, 0);
    const minsLeftToday = (dayEnd.getTime() - cursor.getTime()) / 60000;
    if (minsLeftToday <= 0) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      cursor.setUTCHours(DAY_START_HOUR, 0, 0, 0);
      cursor = normalizeToShift(cursor);
      continue;
    }
    if (remaining <= minsLeftToday) {
      cursor = new Date(cursor.getTime() + remaining * 60000);
      remaining = 0;
    } else {
      remaining -= minsLeftToday;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      cursor.setUTCHours(DAY_START_HOUR, 0, 0, 0);
      cursor = normalizeToShift(cursor);
    }
  }
  return cursor;
}

const iso = (d: Date) => d.toISOString();

// ── Engine ──────────────────────────────────────────────────────────────

/**
 * Compute a feasibility + schedule for a work order. Read-only.
 * `overrides` drive what-if simulation; omit them for the baseline plan.
 */
export async function runPlanning(
  workspaceId: string,
  workOrderId: string,
  overrides: PlanningOverrides = {}
): Promise<PlanningResult | null> {
  const [wo] = await db
    .select()
    .from(workOrders)
    .where(and(eq(workOrders.id, workOrderId), eq(workOrders.workspaceId, workspaceId)))
    .limit(1);
  if (!wo) return null;

  const hoursPerDay = overrides.hoursPerDay ?? 8;
  const jobQty = wo.qtyPlanned || 1;
  const conflicts: PlanningConflictResult[] = [];
  const now = overrides.requestedStartDate ? new Date(overrides.requestedStartDate) : new Date();

  // ── 1. Load the routing (active template preferred) ──────────────────
  const template = await resolveTemplate(workspaceId, wo.processTemplateId, wo.productId);
  const stages = template
    ? await db.select().from(processStages).where(eq(processStages.templateId, template.id)).orderBy(processStages.sequence)
    : [];
  if (!template) {
    conflicts.push({
      conflictType: "no_template",
      severity: "warning",
      stageId: null,
      description: "No active process template for this product — using a single default stage.",
      suggestedAction: "Build a process template so the engine can schedule real stages.",
    });
  }

  // ── 2. Material requirements (stage materials override the global BOM) ─
  const materials = await computeMaterials(workspaceId, wo.id, wo.productId, wo.bomId, stages, jobQty, overrides);
  const materialReady = materialReadyDate(materials, now);
  for (const m of materials) {
    if (m.shortage > 0) {
      if (m.incoming >= m.shortage && m.incomingDate) {
        conflicts.push({
          conflictType: "po_delay",
          severity: m.critical ? "blocker" : "warning",
          stageId: null,
          description: `${m.description}: short ${m.shortage.toFixed(2)} ${m.unit}, incoming ${m.incoming.toFixed(2)} by ${m.incomingDate.slice(0, 10)}.`,
          suggestedAction: "Expedite the purchase order to start earlier.",
        });
      } else {
        conflicts.push({
          conflictType: "material_shortage",
          severity: m.critical ? "blocker" : "warning",
          stageId: null,
          description: `${m.description}: short ${m.shortage.toFixed(2)} ${m.unit} with no incoming supply.`,
          suggestedAction: "Raise a purchase order or use a substitute material.",
        });
      }
    }
  }

  // ── 3. Manpower headcount per required skill (count-based) ────────────
  const skillCounts = await skillHeadcounts(workspaceId);

  // ── 4. Existing work-center load (finite capacity serialization) ──────
  const aside = new Set(overrides.moveJobAside ?? []);
  const wcFreeAt = await workCenterFreeAt(workspaceId, wo.id, aside);

  // ── 5. Walk stages in sequence, scheduling each onto its work center ──
  const scheduled: StageSchedule[] = [];
  const stageEnd: Record<string, Date> = {};
  const jobStart = normalizeToShift(new Date(Math.max(materialReady.getTime(), now.getTime())));
  let jobEnd = new Date(jobStart);

  const effectiveStages = stages.length > 0 ? stages : [defaultStage(wo.productId)];

  for (const st of effectiveStages) {
    // Earliest this stage can begin: after its dependency, after material ready.
    let earliest = new Date(jobStart);
    if (st.dependsOnStageId && stageEnd[st.dependsOnStageId]) {
      earliest = new Date(Math.max(earliest.getTime(), stageEnd[st.dependsOnStageId].getTime()));
    } else if (scheduled.length > 0) {
      // No explicit dependency → run after the previous sequential stage.
      earliest = new Date(Math.max(earliest.getTime(), jobEnd.getTime()));
    }

    // Work-center availability (finite capacity): can't start before it's free.
    let wcName: string | null = null;
    if (st.workCenterId) {
      const free = wcFreeAt.get(st.workCenterId);
      const wc = await db.select().from(workCenters).where(eq(workCenters.id, st.workCenterId)).limit(1);
      wcName = wc[0]?.name ?? null;
      if (free && free.getTime() > earliest.getTime()) {
        earliest = new Date(free);
        conflicts.push({
          conflictType: "machine_overload",
          severity: "warning",
          stageId: st.id,
          description: `${st.name}: work center "${wcName}" is busy until ${iso(free).slice(0, 16).replace("T", " ")}.`,
          suggestedAction: "Use an alternate work center or move a lower-priority job aside.",
        });
      }
      // Machine downtime interlock.
      await checkMaintenanceBlock(st.workCenterId, st.id, st.name, conflicts);
    } else if (template) {
      conflicts.push({
        conflictType: "no_work_center",
        severity: "warning",
        stageId: st.id,
        description: `${st.name}: no work center assigned — capacity not guaranteed.`,
        suggestedAction: "Assign a work center to this stage.",
      });
    }

    // Manpower check.
    const extra = overrides.extraHeadcount?.[st.id] ?? 0;
    const available = (st.requiredSkillId ? (skillCounts[st.requiredSkillId] ?? 0) : Infinity) + extra;
    const reqHc = st.requiredHeadcount ?? 1;
    if (st.requiredSkillId && available < reqHc) {
      conflicts.push({
        conflictType: available === 0 ? "skill_unavailable" : "manpower_short",
        severity: "blocker",
        stageId: st.id,
        description: `${st.name}: needs ${reqHc} with the required skill, ${available} available.`,
        suggestedAction: "Add or cross-train manpower, or schedule overtime.",
      });
    }

    const start = normalizeToShift(earliest);
    const totalMinutes = (st.setupMinutes ?? 0) + (st.durationMinutes ?? 60) + (st.bufferMinutes ?? 0);
    const end = addWorkingMinutes(start, totalMinutes, hoursPerDay);
    stageEnd[st.id] = end;
    if (st.workCenterId) wcFreeAt.set(st.workCenterId, end);
    jobEnd = new Date(Math.max(jobEnd.getTime(), end.getTime()));

    scheduled.push({
      stageId: st.id,
      stageName: st.name,
      sequence: st.sequence ?? 0,
      plannedStart: iso(start),
      plannedEnd: iso(end),
      workCenterId: st.workCenterId ?? null,
      workCenterName: wcName,
      requiredHeadcount: reqHc,
      availableHeadcount: available === Infinity ? reqHc : available,
    });
  }

  // ── 6. Delivery risk ─────────────────────────────────────────────────
  const dueDate = wo.dueDate ? new Date(wo.dueDate) : null;
  const risk = deliveryRisk(jobEnd, dueDate);
  if (risk === "impossible" && dueDate) {
    conflicts.push({
      conflictType: "delivery_impossible",
      severity: "blocker",
      stageId: null,
      description: `Earliest completion ${iso(jobEnd).slice(0, 10)} is after the due date ${iso(dueDate).slice(0, 10)}.`,
      suggestedAction: "Add overtime/manpower, expedite materials, or renegotiate the due date.",
    });
  }

  const hasBlocker = conflicts.some((c) => c.severity === "blocker");

  return {
    feasible: !hasBlocker,
    materialReadyDate: iso(materialReady),
    plannedStart: iso(jobStart),
    plannedEnd: iso(jobEnd),
    deliveryRisk: risk,
    dueDate: dueDate ? iso(dueDate) : null,
    materials,
    stages: scheduled,
    conflicts,
    capacityUtilization: {},
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

async function resolveTemplate(workspaceId: string, explicitId: string | null, productId: string) {
  if (explicitId) {
    const [t] = await db.select().from(processTemplates).where(eq(processTemplates.id, explicitId)).limit(1);
    if (t) return t;
  }
  const rows = await db
    .select()
    .from(processTemplates)
    .where(and(eq(processTemplates.workspaceId, workspaceId), eq(processTemplates.productId, productId), eq(processTemplates.status, "active")));
  return rows[0] ?? null;
}

function defaultStage(productId: string) {
  return {
    id: `default-${productId}`,
    templateId: "",
    name: "Production",
    sequence: 0,
    parentStageId: null,
    dependsOnStageId: null,
    durationMinutes: 480,
    setupMinutes: 0,
    bufferMinutes: 0,
    workCenterId: null as string | null,
    requiredSkillId: null as string | null,
    requiredHeadcount: 1,
    qaCheckpointRequired: false,
    scrapPct: 0,
    outputQty: 1,
    instructions: null,
    notes: null,
  };
}

type StageRow = typeof processStages.$inferSelect;

async function computeMaterials(
  workspaceId: string,
  workOrderId: string,
  productId: string,
  bomId: string | null,
  stages: StageRow[],
  jobQty: number,
  overrides: PlanningOverrides
): Promise<MaterialLine[]> {
  // Merge stage materials (precedence) with the global BOM lines (fallback).
  const merged = new Map<string, { description: string; qtyPer: number; unit: string; wastagePct: number; critical: boolean }>();

  if (stages.length > 0) {
    const stageIds = stages.map((s) => s.id);
    const sm = stageIds.length
      ? await db.select().from(stageMaterials).where(inArray(stageMaterials.stageId, stageIds))
      : [];
    for (const m of sm) {
      const key = m.componentProductId ?? `desc:${m.description}`;
      const prev = merged.get(key);
      const qty = m.qtyPer * (1 + (m.wastagePct ?? 0) / 100);
      merged.set(key, {
        description: m.description ?? "Component",
        qtyPer: (prev?.qtyPer ?? 0) + qty,
        unit: m.unit ?? "unit",
        wastagePct: m.wastagePct ?? 0,
        critical: prev?.critical || m.criticalItem,
      });
    }
  }

  // Fall back to the global BOM for components not covered by stage materials.
  const resolvedBomId = bomId ?? (await activeBomId(workspaceId, productId));
  if (resolvedBomId) {
    const lines = await db.select().from(bomLines).where(eq(bomLines.bomId, resolvedBomId));
    for (const l of lines) {
      const key = l.componentProductId ?? `desc:${l.description}`;
      if (merged.has(key)) continue;
      merged.set(key, {
        description: l.description ?? "Component",
        qtyPer: l.quantity * (1 + (l.scrapPct ?? 0) / 100),
        unit: l.unit ?? "unit",
        wastagePct: 0,
        critical: false,
      });
    }
  }

  const out: MaterialLine[] = [];
  for (const [key, v] of merged) {
    const componentProductId = key.startsWith("desc:") ? null : key;
    const required = v.qtyPer * jobQty;
    let available = 0;
    let reserved = 0;
    let incoming = 0;
    let incomingDate: string | null = null;

    if (componentProductId) {
      const [lvl] = await db
        .select({
          onHand: sql<number>`coalesce(sum(${stockLevels.onHand}), 0)`,
          committed: sql<number>`coalesce(sum(${stockLevels.committed}), 0)`,
        })
        .from(stockLevels)
        .where(and(eq(stockLevels.workspaceId, workspaceId), eq(stockLevels.productId, componentProductId)));
      const onHand = Number(lvl?.onHand ?? 0);
      const committed = Number(lvl?.committed ?? 0);

      const [res] = await db
        .select({ total: sql<number>`coalesce(sum(${materialReservations.qtyReserved}), 0)` })
        .from(materialReservations)
        .where(
          and(
            eq(materialReservations.workspaceId, workspaceId),
            eq(materialReservations.componentProductId, componentProductId),
            eq(materialReservations.status, "reserved"),
            ne(materialReservations.workOrderId, workOrderId)
          )
        );
      reserved = Number(res?.total ?? 0);
      available = onHand - committed - reserved;

      // Incoming = open PO lines not yet received, earliest expected date.
      const incomingRows = await db
        .select({
          qty: poLineItems.quantity,
          received: poLineItems.qtyReceived,
          poId: purchaseOrders.id,
          expected: purchaseOrders.expectedDate,
          status: purchaseOrders.status,
        })
        .from(poLineItems)
        .innerJoin(purchaseOrders, eq(poLineItems.purchaseOrderId, purchaseOrders.id))
        .where(
          and(
            eq(purchaseOrders.workspaceId, workspaceId),
            eq(poLineItems.productId, componentProductId),
            inArray(purchaseOrders.status, ["draft", "pending_approval", "approved", "sent", "partially_received"])
          )
        );
      for (const r of incomingRows) {
        const open = Math.max(0, (r.qty ?? 0) - (r.received ?? 0));
        if (open <= 0) continue;
        incoming += open;
        const exp = overrides.expeditePO?.[r.poId] ? new Date(overrides.expeditePO[r.poId]) : r.expected;
        if (exp && (!incomingDate || new Date(exp).getTime() < new Date(incomingDate).getTime())) {
          incomingDate = exp instanceof Date ? exp.toISOString() : new Date(exp).toISOString();
        }
      }
    }

    const shortage = Math.max(0, required - Math.max(0, available));
    const status: MaterialLine["status"] = shortage <= 0 ? "available" : incoming >= shortage ? "incoming" : "short";
    out.push({
      componentProductId,
      description: v.description,
      required,
      available: Math.max(0, available),
      reserved,
      incoming,
      incomingDate,
      shortage,
      critical: v.critical,
      unit: v.unit,
      status,
    });
  }
  return out;
}

async function activeBomId(workspaceId: string, productId: string): Promise<string | null> {
  const rows = await db
    .select({ id: boms.id })
    .from(boms)
    .where(and(eq(boms.workspaceId, workspaceId), eq(boms.productId, productId), eq(boms.status, "active")))
    .limit(1);
  return rows[0]?.id ?? null;
}

function materialReadyDate(materials: MaterialLine[], now: Date): Date {
  let ready = new Date(now);
  for (const m of materials) {
    if (m.shortage > 0 && m.status === "incoming" && m.incomingDate) {
      const d = new Date(m.incomingDate);
      if (d.getTime() > ready.getTime()) ready = d;
    }
  }
  return normalizeToShift(ready);
}

/** Count of employees holding each skill (unexpired certifications). */
async function skillHeadcounts(workspaceId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ skillId: employeeSkills.skillId, count: sql<number>`count(*)` })
    .from(employeeSkills)
    .where(
      and(
        eq(employeeSkills.workspaceId, workspaceId),
        sql`(${employeeSkills.certifiedUntil} is null or ${employeeSkills.certifiedUntil} > now())`
      )
    )
    .groupBy(employeeSkills.skillId);
  const out: Record<string, number> = {};
  for (const r of rows) out[r.skillId] = Number(r.count);
  return out;
}

/** Latest planned-end per work center across other open jobs = earliest free. */
async function workCenterFreeAt(workspaceId: string, workOrderId: string, aside: Set<string>): Promise<Map<string, Date>> {
  const { jobStageSchedules } = await import("@/lib/db/schema");
  const rows = await db
    .select({
      wc: jobStageSchedules.assignedWorkCenterId,
      end: jobStageSchedules.plannedEnd,
      wo: jobStageSchedules.workOrderId,
    })
    .from(jobStageSchedules)
    .where(and(eq(jobStageSchedules.workspaceId, workspaceId), ne(jobStageSchedules.workOrderId, workOrderId)));
  const map = new Map<string, Date>();
  for (const r of rows) {
    if (!r.wc || !r.end || aside.has(r.wo)) continue;
    const end = new Date(r.end);
    const prev = map.get(r.wc);
    if (!prev || end.getTime() > prev.getTime()) map.set(r.wc, end);
  }
  return map;
}

async function checkMaintenanceBlock(workCenterId: string, stageId: string, stageName: string, conflicts: PlanningConflictResult[]) {
  const machines = await db
    .select({ assetId: workCenterMachines.assetId })
    .from(workCenterMachines)
    .where(and(eq(workCenterMachines.workCenterId, workCenterId), eq(workCenterMachines.isActive, true)));
  const assetIds = machines.map((m) => m.assetId).filter((x): x is string => !!x);
  if (assetIds.length === 0) return;
  const down = await db
    .select({ name: assets.name, status: assets.status })
    .from(assets)
    .where(and(inArray(assets.id, assetIds), inArray(assets.status, ["down", "maintenance"])));
  for (const a of down) {
    conflicts.push({
      conflictType: "maintenance_block",
      severity: "blocker",
      stageId,
      description: `${stageName}: machine "${a.name}" is ${a.status}.`,
      suggestedAction: "Complete maintenance or reassign the stage to another machine.",
    });
  }
}

function deliveryRisk(plannedEnd: Date, dueDate: Date | null): DeliveryRisk {
  if (!dueDate) return "low";
  const slackDays = (dueDate.getTime() - plannedEnd.getTime()) / 86400000;
  if (slackDays < 0) return "impossible";
  if (slackDays < 1) return "high";
  if (slackDays < 3) return "medium";
  return "low";
}

// ── Persistence ─────────────────────────────────────────────────────────

/**
 * Run planning and persist: replace the job's stage schedules + conflicts and
 * stamp the work order's planning fields. Returns the computed result.
 */
export async function planAndPersist(workspaceId: string, workOrderId: string, _userId: string): Promise<PlanningResult | null> {
  const result = await runPlanning(workspaceId, workOrderId);
  if (!result) return null;
  const { jobStageSchedules, planningConflicts } = await import("@/lib/db/schema");

  await db.transaction(async (tx) => {
    // Replace prior schedule + conflicts for this job (idempotent re-planning).
    await tx.delete(jobStageSchedules).where(eq(jobStageSchedules.workOrderId, workOrderId));
    await tx.delete(planningConflicts).where(eq(planningConflicts.workOrderId, workOrderId));

    if (result.stages.length > 0) {
      await tx.insert(jobStageSchedules).values(
        result.stages.map((s) => ({
          workspaceId,
          workOrderId,
          stageId: s.stageId.startsWith("default-") ? null : s.stageId,
          stageName: s.stageName,
          sequence: s.sequence,
          plannedStart: new Date(s.plannedStart),
          plannedEnd: new Date(s.plannedEnd),
          assignedWorkCenterId: s.workCenterId,
        }))
      );
    }
    if (result.conflicts.length > 0) {
      await tx.insert(planningConflicts).values(
        result.conflicts.map((c) => ({
          workspaceId,
          workOrderId,
          conflictType: c.conflictType,
          severity: c.severity,
          stageId: c.stageId && !c.stageId.startsWith("default-") ? c.stageId : null,
          description: c.description,
          suggestedAction: c.suggestedAction,
        }))
      );
    }

    const planningStatus = result.feasible
      ? result.conflicts.length > 0
        ? ("conflict" as const)
        : ("feasible" as const)
      : ("infeasible" as const);

    await tx
      .update(workOrders)
      .set({
        plannedStartDate: new Date(result.plannedStart),
        plannedEndDate: new Date(result.plannedEnd),
        materialReadyDate: new Date(result.materialReadyDate),
        planningStatus,
        deliveryRisk: result.deliveryRisk,
        planningCheckedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workOrders.id, workOrderId));
  });

  return result;
}

/**
 * Priority impact: which other open jobs sharing this job's work centers would
 * be pushed later if this job is prioritized ahead of them. Read-only.
 */
export async function priorityImpact(workspaceId: string, workOrderId: string) {
  const { jobStageSchedules } = await import("@/lib/db/schema");
  // Work centers this job touches.
  const mine = await db
    .select({ wc: jobStageSchedules.assignedWorkCenterId, end: jobStageSchedules.plannedEnd })
    .from(jobStageSchedules)
    .where(and(eq(jobStageSchedules.workspaceId, workspaceId), eq(jobStageSchedules.workOrderId, workOrderId)));
  const myCenters = new Set(mine.map((m) => m.wc).filter((x): x is string => !!x));
  if (myCenters.size === 0) return { impacted: [] as { workOrderId: string; number: string; workCenterId: string }[] };

  const others = await db
    .select({
      wo: jobStageSchedules.workOrderId,
      wc: jobStageSchedules.assignedWorkCenterId,
      number: workOrders.number,
      priority: workOrders.priority,
    })
    .from(jobStageSchedules)
    .innerJoin(workOrders, eq(jobStageSchedules.workOrderId, workOrders.id))
    .where(and(eq(jobStageSchedules.workspaceId, workspaceId), ne(jobStageSchedules.workOrderId, workOrderId)));

  const impacted = new Map<string, { workOrderId: string; number: string; workCenterId: string }>();
  for (const o of others) {
    if (o.wc && myCenters.has(o.wc) && o.priority !== "urgent" && o.priority !== "high") {
      impacted.set(o.wo, { workOrderId: o.wo, number: o.number, workCenterId: o.wc });
    }
  }
  return { impacted: [...impacted.values()] };
}
