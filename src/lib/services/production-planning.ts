/**
 * Production Planning support services (BRD 13).
 *
 * CRUD + read models for the planning module's setup data (work centers,
 * skills, process templates/stages) and dashboard queries (conflicts,
 * capacity, timeline). The scheduling math lives in `planning-engine.ts`;
 * this file is the data layer the API routes call.
 */

import { db } from "@/lib/db";
import {
  workCenters,
  workCenterMachines,
  workCenterShifts,
  productionSkills,
  employeeSkills,
  employeeShifts,
  processTemplates,
  processStages,
  stageMaterials,
  jobStageSchedules,
  planningConflicts,
  materialReservations,
  workOrders,
  workOrderMaterials,
  products,
  stockLevels,
  employees,
} from "@/lib/db/schema";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

// ── Work centers ────────────────────────────────────────────────────────

export function listWorkCenters(workspaceId: string) {
  return db.select().from(workCenters).where(eq(workCenters.workspaceId, workspaceId)).orderBy(asc(workCenters.name));
}

export async function getWorkCenter(workspaceId: string, id: string) {
  const [wc] = await db.select().from(workCenters).where(and(eq(workCenters.id, id), eq(workCenters.workspaceId, workspaceId))).limit(1);
  if (!wc) return null;
  const machines = await db.select().from(workCenterMachines).where(eq(workCenterMachines.workCenterId, id));
  const shifts = await db.select().from(workCenterShifts).where(eq(workCenterShifts.workCenterId, id)).orderBy(asc(workCenterShifts.dayOfWeek));
  return { workCenter: wc, machines, shifts };
}

export async function createWorkCenter(workspaceId: string, input: Omit<typeof workCenters.$inferInsert, "workspaceId">) {
  const [row] = await db.insert(workCenters).values({ ...input, workspaceId }).returning();
  return row;
}

export async function updateWorkCenter(workspaceId: string, id: string, patch: Partial<typeof workCenters.$inferInsert>) {
  const [row] = await db
    .update(workCenters)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(workCenters.id, id), eq(workCenters.workspaceId, workspaceId)))
    .returning();
  return row ?? null;
}

export async function deleteWorkCenter(workspaceId: string, id: string) {
  const [row] = await db.delete(workCenters).where(and(eq(workCenters.id, id), eq(workCenters.workspaceId, workspaceId))).returning();
  return row ?? null;
}

/** Replace the machine list for a work center. */
export async function setWorkCenterMachines(workspaceId: string, workCenterId: string, machines: Array<Omit<typeof workCenterMachines.$inferInsert, "workspaceId" | "workCenterId">>) {
  return db.transaction(async (tx) => {
    await tx.delete(workCenterMachines).where(eq(workCenterMachines.workCenterId, workCenterId));
    if (machines.length > 0) {
      await tx.insert(workCenterMachines).values(machines.map((m) => ({ ...m, workspaceId, workCenterId })));
    }
    return tx.select().from(workCenterMachines).where(eq(workCenterMachines.workCenterId, workCenterId));
  });
}

/** Replace the shift calendar for a work center. */
export async function setWorkCenterShifts(workCenterId: string, shifts: Array<Omit<typeof workCenterShifts.$inferInsert, "workCenterId">>) {
  return db.transaction(async (tx) => {
    await tx.delete(workCenterShifts).where(eq(workCenterShifts.workCenterId, workCenterId));
    if (shifts.length > 0) {
      await tx.insert(workCenterShifts).values(shifts.map((s) => ({ ...s, workCenterId })));
    }
    return tx.select().from(workCenterShifts).where(eq(workCenterShifts.workCenterId, workCenterId)).orderBy(asc(workCenterShifts.dayOfWeek));
  });
}

// ── Skills ──────────────────────────────────────────────────────────────

export function listSkills(workspaceId: string) {
  return db.select().from(productionSkills).where(eq(productionSkills.workspaceId, workspaceId)).orderBy(asc(productionSkills.name));
}

export async function createSkill(workspaceId: string, input: { name: string; description?: string }) {
  const [row] = await db.insert(productionSkills).values({ workspaceId, name: input.name, description: input.description ?? null }).returning();
  return row;
}

export async function listEmployeeSkills(workspaceId: string, employeeId: string) {
  return db
    .select({
      id: employeeSkills.id,
      skillId: employeeSkills.skillId,
      level: employeeSkills.level,
      certifiedUntil: employeeSkills.certifiedUntil,
      skillName: productionSkills.name,
    })
    .from(employeeSkills)
    .innerJoin(productionSkills, eq(employeeSkills.skillId, productionSkills.id))
    .where(and(eq(employeeSkills.workspaceId, workspaceId), eq(employeeSkills.employeeId, employeeId)));
}

export async function setEmployeeSkills(workspaceId: string, employeeId: string, skills: Array<{ skillId: string; level: "trainee" | "qualified" | "expert"; certifiedUntil?: string }>) {
  return db.transaction(async (tx) => {
    await tx.delete(employeeSkills).where(and(eq(employeeSkills.workspaceId, workspaceId), eq(employeeSkills.employeeId, employeeId)));
    if (skills.length > 0) {
      await tx.insert(employeeSkills).values(
        skills.map((s) => ({
          workspaceId,
          employeeId,
          skillId: s.skillId,
          level: s.level,
          certifiedUntil: s.certifiedUntil ? new Date(s.certifiedUntil) : null,
        }))
      );
    }
    return tx.select().from(employeeSkills).where(and(eq(employeeSkills.workspaceId, workspaceId), eq(employeeSkills.employeeId, employeeId)));
  });
}

export async function setEmployeeShifts(employeeId: string, shifts: Array<{ dayOfWeek: number; startTime: string; endTime: string }>) {
  return db.transaction(async (tx) => {
    await tx.delete(employeeShifts).where(eq(employeeShifts.employeeId, employeeId));
    if (shifts.length > 0) {
      await tx.insert(employeeShifts).values(shifts.map((s) => ({ ...s, employeeId })));
    }
    return tx.select().from(employeeShifts).where(eq(employeeShifts.employeeId, employeeId)).orderBy(asc(employeeShifts.dayOfWeek));
  });
}

// ── Process templates + stages ────────────────────────────────────────────

export function listTemplates(workspaceId: string) {
  return db
    .select({
      id: processTemplates.id,
      productId: processTemplates.productId,
      version: processTemplates.version,
      name: processTemplates.name,
      status: processTemplates.status,
      productName: products.name,
      updatedAt: processTemplates.updatedAt,
    })
    .from(processTemplates)
    .innerJoin(products, eq(processTemplates.productId, products.id))
    .where(eq(processTemplates.workspaceId, workspaceId))
    .orderBy(desc(processTemplates.updatedAt));
}

export async function getTemplate(workspaceId: string, id: string) {
  const [tpl] = await db.select().from(processTemplates).where(and(eq(processTemplates.id, id), eq(processTemplates.workspaceId, workspaceId))).limit(1);
  if (!tpl) return null;
  const stages = await db.select().from(processStages).where(eq(processStages.templateId, id)).orderBy(asc(processStages.sequence));
  const stageIds = stages.map((s) => s.id);
  const mats = stageIds.length ? await db.select().from(stageMaterials).where(inArray(stageMaterials.stageId, stageIds)) : [];
  return {
    template: tpl,
    stages: stages.map((s) => ({ ...s, materials: mats.filter((m) => m.stageId === s.id) })),
  };
}

export async function createTemplate(workspaceId: string, input: { productId: string; version?: string; name?: string; notes?: string }, userId: string) {
  const [row] = await db
    .insert(processTemplates)
    .values({ workspaceId, productId: input.productId, version: input.version ?? "v1", name: input.name ?? null, notes: input.notes ?? null, createdBy: userId })
    .returning();
  return row;
}

export async function updateTemplate(workspaceId: string, id: string, patch: Partial<typeof processTemplates.$inferInsert>) {
  // Activating a template archives any other active version of the same product.
  return db.transaction(async (tx) => {
    const [tpl] = await tx.select().from(processTemplates).where(and(eq(processTemplates.id, id), eq(processTemplates.workspaceId, workspaceId))).limit(1);
    if (!tpl) return null;
    if (patch.status === "active") {
      await tx
        .update(processTemplates)
        .set({ status: "archived", updatedAt: new Date() })
        .where(and(eq(processTemplates.workspaceId, workspaceId), eq(processTemplates.productId, tpl.productId), eq(processTemplates.status, "active")));
    }
    const [row] = await tx.update(processTemplates).set({ ...patch, updatedAt: new Date() }).where(eq(processTemplates.id, id)).returning();
    return row;
  });
}

export async function deleteTemplate(workspaceId: string, id: string) {
  const [row] = await db.delete(processTemplates).where(and(eq(processTemplates.id, id), eq(processTemplates.workspaceId, workspaceId))).returning();
  return row ?? null;
}

type StageInput = {
  name: string;
  sequence?: number;
  parentStageId?: string;
  dependsOnStageId?: string;
  durationMinutes?: number;
  setupMinutes?: number;
  bufferMinutes?: number;
  workCenterId?: string;
  requiredSkillId?: string;
  requiredHeadcount?: number;
  qaCheckpointRequired?: boolean;
  scrapPct?: number;
  outputQty?: number;
  instructions?: string;
  notes?: string;
  materials?: Array<Omit<typeof stageMaterials.$inferInsert, "stageId" | "workspaceId">>;
};

export async function addStage(workspaceId: string, templateId: string, input: StageInput) {
  return db.transaction(async (tx) => {
    const [stage] = await tx
      .insert(processStages)
      .values({
        templateId,
        name: input.name,
        sequence: input.sequence ?? 0,
        parentStageId: input.parentStageId ?? null,
        dependsOnStageId: input.dependsOnStageId ?? null,
        durationMinutes: input.durationMinutes ?? 60,
        setupMinutes: input.setupMinutes ?? 0,
        bufferMinutes: input.bufferMinutes ?? 0,
        workCenterId: input.workCenterId ?? null,
        requiredSkillId: input.requiredSkillId ?? null,
        requiredHeadcount: input.requiredHeadcount ?? 1,
        qaCheckpointRequired: input.qaCheckpointRequired ?? false,
        scrapPct: input.scrapPct ?? 0,
        outputQty: input.outputQty ?? 1,
        instructions: input.instructions ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    if (input.materials && input.materials.length > 0) {
      await tx.insert(stageMaterials).values(input.materials.map((m, i) => ({ ...m, workspaceId, stageId: stage.id, position: i })));
    }
    return stage;
  });
}

export async function updateStage(stageId: string, workspaceId: string, patch: Partial<StageInput>) {
  return db.transaction(async (tx) => {
    const { materials, ...stagePatch } = patch;
    const [stage] = await tx.update(processStages).set(stagePatch).where(eq(processStages.id, stageId)).returning();
    if (materials) {
      await tx.delete(stageMaterials).where(eq(stageMaterials.stageId, stageId));
      if (materials.length > 0) {
        await tx.insert(stageMaterials).values(materials.map((m, i) => ({ ...m, workspaceId, stageId, position: i })));
      }
    }
    return stage ?? null;
  });
}

export async function deleteStage(stageId: string) {
  const [row] = await db.delete(processStages).where(eq(processStages.id, stageId)).returning();
  return row ?? null;
}

// ── Dashboard read models ─────────────────────────────────────────────────

/** Open conflicts across the workspace, joined to the work-order number. */
export function listConflicts(workspaceId: string) {
  return db
    .select({
      id: planningConflicts.id,
      workOrderId: planningConflicts.workOrderId,
      number: workOrders.number,
      conflictType: planningConflicts.conflictType,
      severity: planningConflicts.severity,
      description: planningConflicts.description,
      suggestedAction: planningConflicts.suggestedAction,
      status: planningConflicts.status,
      createdAt: planningConflicts.createdAt,
    })
    .from(planningConflicts)
    .innerJoin(workOrders, eq(planningConflicts.workOrderId, workOrders.id))
    .where(and(eq(planningConflicts.workspaceId, workspaceId), eq(planningConflicts.status, "open")))
    .orderBy(desc(planningConflicts.severity), desc(planningConflicts.createdAt));
}

/** Scheduled stages within a date window — feeds the Gantt timeline. */
export function listTimeline(workspaceId: string) {
  return db
    .select({
      id: jobStageSchedules.id,
      workOrderId: jobStageSchedules.workOrderId,
      number: workOrders.number,
      stageName: jobStageSchedules.stageName,
      sequence: jobStageSchedules.sequence,
      plannedStart: jobStageSchedules.plannedStart,
      plannedEnd: jobStageSchedules.plannedEnd,
      status: jobStageSchedules.status,
      workCenterId: jobStageSchedules.assignedWorkCenterId,
      priority: workOrders.priority,
    })
    .from(jobStageSchedules)
    .innerJoin(workOrders, eq(jobStageSchedules.workOrderId, workOrders.id))
    .where(eq(jobStageSchedules.workspaceId, workspaceId))
    .orderBy(asc(jobStageSchedules.plannedStart));
}

/** Per-work-center scheduled load (hours) — feeds the capacity view. */
export async function capacityLoad(workspaceId: string) {
  const rows = await db
    .select({
      workCenterId: jobStageSchedules.assignedWorkCenterId,
      name: workCenters.name,
      capacityHoursPerDay: workCenters.capacityHoursPerDay,
      plannedStart: jobStageSchedules.plannedStart,
      plannedEnd: jobStageSchedules.plannedEnd,
    })
    .from(jobStageSchedules)
    .innerJoin(workCenters, eq(jobStageSchedules.assignedWorkCenterId, workCenters.id))
    .where(eq(jobStageSchedules.workspaceId, workspaceId));

  const byCenter = new Map<string, { name: string; capacityHoursPerDay: number; scheduledHours: number; jobs: number }>();
  for (const r of rows) {
    if (!r.workCenterId) continue;
    const hours = r.plannedStart && r.plannedEnd ? (new Date(r.plannedEnd).getTime() - new Date(r.plannedStart).getTime()) / 3600000 : 0;
    const cur = byCenter.get(r.workCenterId) ?? { name: r.name, capacityHoursPerDay: r.capacityHoursPerDay, scheduledHours: 0, jobs: 0 };
    cur.scheduledHours += hours;
    cur.jobs += 1;
    byCenter.set(r.workCenterId, cur);
  }
  return [...byCenter.entries()].map(([workCenterId, v]) => ({ workCenterId, ...v }));
}

/** Aggregate material requirement across all open work orders. */
export async function materialRequirements(workspaceId: string) {
  const rows = await db
    .select({
      componentProductId: workOrderMaterials.componentProductId,
      description: workOrderMaterials.description,
      unit: workOrderMaterials.unit,
      required: sql<number>`coalesce(sum(${workOrderMaterials.qtyRequired} - ${workOrderMaterials.qtyIssued}), 0)`,
    })
    .from(workOrderMaterials)
    .innerJoin(workOrders, eq(workOrderMaterials.workOrderId, workOrders.id))
    .where(and(eq(workOrders.workspaceId, workspaceId), inArray(workOrders.status, ["planned", "released", "in_progress"])))
    .groupBy(workOrderMaterials.componentProductId, workOrderMaterials.description, workOrderMaterials.unit);

  const out = [];
  for (const r of rows) {
    let available = 0;
    if (r.componentProductId) {
      const [lvl] = await db
        .select({ onHand: sql<number>`coalesce(sum(${stockLevels.onHand} - ${stockLevels.committed}), 0)` })
        .from(stockLevels)
        .where(and(eq(stockLevels.workspaceId, workspaceId), eq(stockLevels.productId, r.componentProductId)));
      available = Number(lvl?.onHand ?? 0);
    }
    const required = Number(r.required);
    out.push({
      componentProductId: r.componentProductId,
      description: r.description ?? "Component",
      unit: r.unit,
      required,
      available: Math.max(0, available),
      shortage: Math.max(0, required - Math.max(0, available)),
    });
  }
  return out.filter((m) => m.required > 0);
}

// ── Material reservations ──────────────────────────────────────────────────

/** Reserve every tracked component of a work order (does not move stock). */
export async function reserveMaterials(workspaceId: string, workOrderId: string, warehouseId?: string) {
  return db.transaction(async (tx) => {
    const [wo] = await tx.select().from(workOrders).where(and(eq(workOrders.id, workOrderId), eq(workOrders.workspaceId, workspaceId))).limit(1);
    if (!wo) return { error: "not_found" as const };
    const mats = await tx.select().from(workOrderMaterials).where(eq(workOrderMaterials.workOrderId, workOrderId));
    await tx.delete(materialReservations).where(and(eq(materialReservations.workOrderId, workOrderId), eq(materialReservations.status, "reserved")));
    const rows = mats.filter((m) => m.componentProductId && m.qtyRequired > 0);
    if (rows.length > 0) {
      await tx.insert(materialReservations).values(
        rows.map((m) => ({
          workspaceId,
          workOrderId,
          componentProductId: m.componentProductId!,
          warehouseId: warehouseId ?? wo.warehouseId ?? null,
          qtyReserved: m.qtyRequired - m.qtyIssued,
          status: "reserved" as const,
        }))
      );
    }
    return { reserved: rows.length };
  });
}

/** Distinct employees count (manpower pool size) for a workspace. */
export async function manpowerSummary(workspaceId: string) {
  const [row] = await db
    .select({ total: sql<number>`count(*)` })
    .from(employees)
    .where(eq(employees.workspaceId, workspaceId));
  return { totalEmployees: Number(row?.total ?? 0) };
}
