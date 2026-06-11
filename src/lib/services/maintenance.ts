/**
 * Maintenance service (BRD 12).
 *
 * Asset register + preventive/corrective work orders. Spare-part consumption
 * goes through the shared `applyStockMovement` ledger; lifecycle events flow
 * through the transactional outbox. Asset "down" status is the interlock
 * Production consumes. See docs/brd/00-platform-interoperability.md.
 */

import { db } from "@/lib/db";
import { assets, maintenanceOrders, maintenanceParts, warehouses, products } from "@/lib/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { emitEvent } from "@/lib/events/outbox";
import { nextDocNumber } from "@/lib/services/document-sequence";
import { applyStockMovement, type Tx } from "@/lib/services/inventory";

// ── Assets ────────────────────────────────────────────────────────────

export interface AssetInput {
  name: string;
  code?: string;
  type?: string;
  parentAssetId?: string;
  location?: string;
  criticality?: "low" | "medium" | "high";
  notes?: string;
}

export function listAssets(workspaceId: string) {
  return db.select().from(assets).where(eq(assets.workspaceId, workspaceId)).orderBy(desc(assets.createdAt));
}

export async function createAsset(workspaceId: string, input: AssetInput, userId: string) {
  return db.transaction(async (tx) => {
    const [asset] = await tx
      .insert(assets)
      .values({
        workspaceId,
        name: input.name,
        code: input.code || null,
        type: input.type || null,
        parentAssetId: input.parentAssetId || null,
        location: input.location || null,
        criticality: input.criticality ?? "medium",
        notes: input.notes || null,
        createdBy: userId,
      })
      .returning();
    await emitEvent(tx, {
      workspaceId,
      eventType: "asset.created",
      aggregateType: "asset",
      aggregateId: asset.id,
      actorUserId: userId,
      payload: { code: asset.code, name: asset.name },
    });
    return asset;
  });
}

export async function setAssetStatus(workspaceId: string, assetId: string, status: "up" | "down" | "maintenance" | "retired", userId: string) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(assets).where(and(eq(assets.id, assetId), eq(assets.workspaceId, workspaceId))).limit(1);
    if (!existing) return null;
    const [asset] = await tx.update(assets).set({ status, updatedAt: new Date() }).where(eq(assets.id, assetId)).returning();
    await emitEvent(tx, {
      workspaceId,
      eventType: "asset.status_changed",
      aggregateType: "asset",
      aggregateId: assetId,
      actorUserId: userId,
      payload: { from: existing.status, to: status },
    });
    return asset;
  });
}

// ── Maintenance orders ────────────────────────────────────────────────

export interface MaintenanceOrderInput {
  assetId: string;
  type?: "corrective" | "preventive";
  priority?: "low" | "normal" | "high" | "urgent";
  fault?: string;
  scheduledDate?: string;
}

export function listMaintenanceOrders(workspaceId: string) {
  return db.select().from(maintenanceOrders).where(eq(maintenanceOrders.workspaceId, workspaceId)).orderBy(desc(maintenanceOrders.createdAt));
}

export async function getMaintenanceOrder(workspaceId: string, id: string) {
  const [mo] = await db.select().from(maintenanceOrders).where(and(eq(maintenanceOrders.id, id), eq(maintenanceOrders.workspaceId, workspaceId))).limit(1);
  if (!mo) return null;
  const parts = await db.select().from(maintenanceParts).where(eq(maintenanceParts.maintenanceOrderId, id)).orderBy(asc(maintenanceParts.position));
  return { order: mo, parts };
}

// `userId` is null for system-generated orders (PM sweep) — both createdBy and
// the event actor are nullable set-null FKs.
export async function createMaintenanceOrder(workspaceId: string, input: MaintenanceOrderInput, userId: string | null) {
  return db.transaction(async (tx) => {
    const number = await nextDocNumber(tx, { workspaceId, docType: "maintenance_order" });
    const [mo] = await tx
      .insert(maintenanceOrders)
      .values({
        workspaceId,
        number,
        assetId: input.assetId,
        type: input.type ?? "corrective",
        priority: input.priority ?? "normal",
        fault: input.fault || null,
        scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : null,
        createdBy: userId,
      })
      .returning();

    // Preventive (or scheduled) orders announce themselves; corrective ones are
    // breakdowns reported ad hoc.
    if (mo.type === "preventive" || mo.scheduledDate) {
      await emitEvent(tx, {
        workspaceId,
        eventType: "maintenance.scheduled",
        aggregateType: "maintenance_order",
        aggregateId: mo.id,
        actorUserId: userId,
        payload: { number: mo.number, assetId: mo.assetId, scheduledDate: mo.scheduledDate },
      });
    }
    return mo;
  });
}

export async function startMaintenance(workspaceId: string, id: string, userId: string) {
  return db.transaction(async (tx) => {
    const [mo] = await tx.select().from(maintenanceOrders).where(and(eq(maintenanceOrders.id, id), eq(maintenanceOrders.workspaceId, workspaceId))).limit(1);
    if (!mo) return null;
    const [updated] = await tx.update(maintenanceOrders).set({ status: "in_progress", updatedAt: new Date() }).where(eq(maintenanceOrders.id, id)).returning();
    // Take the asset down for the duration of the repair (Production interlock).
    await tx.update(assets).set({ status: "maintenance", updatedAt: new Date() }).where(eq(assets.id, mo.assetId));
    await emitEvent(tx, {
      workspaceId,
      eventType: "maintenance.started",
      aggregateType: "maintenance_order",
      aggregateId: id,
      actorUserId: userId,
      payload: { number: mo.number, assetId: mo.assetId },
    });
    return updated;
  });
}

export interface CompleteMaintenanceInput {
  downtimeHours?: number;
  parts?: { partProductId?: string; description?: string; qtyUsed?: number; warehouseId?: string }[];
}

async function defaultWarehouse(tx: Tx, workspaceId: string, explicit?: string | null) {
  if (explicit) return explicit;
  const rows = await tx.select().from(warehouses).where(eq(warehouses.workspaceId, workspaceId));
  return (rows.find((w) => w.isDefault) ?? rows[0])?.id ?? null;
}

export async function completeMaintenance(workspaceId: string, id: string, input: CompleteMaintenanceInput, userId: string) {
  return db.transaction(async (tx) => {
    const [mo] = await tx.select().from(maintenanceOrders).where(and(eq(maintenanceOrders.id, id), eq(maintenanceOrders.workspaceId, workspaceId))).limit(1);
    if (!mo) return { error: "not_found" as const };
    if (mo.status === "completed" || mo.status === "cancelled") return { error: "conflict" as const };

    // Record + consume spare parts.
    const parts = input.parts ?? [];
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const warehouseId = await defaultWarehouse(tx, workspaceId, p.warehouseId);
      await tx.insert(maintenanceParts).values({
        maintenanceOrderId: id,
        partProductId: p.partProductId || null,
        description: p.description || null,
        qtyUsed: p.qtyUsed ?? 1,
        warehouseId: warehouseId,
        position: i,
      });
      if (p.partProductId && warehouseId && (p.qtyUsed ?? 0) > 0) {
        const [prod] = await tx.select({ track: products.trackInventory }).from(products).where(eq(products.id, p.partProductId)).limit(1);
        if (prod?.track) {
          await applyStockMovement(tx, {
            workspaceId,
            productId: p.partProductId,
            warehouseId,
            type: "adjustment",
            quantity: -(p.qtyUsed ?? 1),
            refType: "maintenance_order",
            refId: id,
            note: `MO ${mo.number} spare consumption`,
            actorUserId: userId,
          });
        }
      }
    }

    const [updated] = await tx
      .update(maintenanceOrders)
      .set({ status: "completed", downtimeHours: input.downtimeHours ?? 0, completedAt: new Date(), updatedAt: new Date() })
      .where(eq(maintenanceOrders.id, id))
      .returning();
    // Asset back up.
    await tx.update(assets).set({ status: "up", updatedAt: new Date() }).where(eq(assets.id, mo.assetId));

    await emitEvent(tx, {
      workspaceId,
      eventType: "maintenance.completed",
      aggregateType: "maintenance_order",
      aggregateId: id,
      actorUserId: userId,
      payload: { number: mo.number, assetId: mo.assetId, downtimeHours: input.downtimeHours ?? 0 },
    });
    return { order: updated };
  });
}
