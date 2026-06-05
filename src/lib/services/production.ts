/**
 * Production / Manufacturing service (BRD 11).
 *
 * Work orders consume BOM components from inventory and receive finished goods
 * back in. Stock changes go through the shared `applyStockMovement` ledger (so
 * stock.* events + invariants are reused), and lifecycle events flow through
 * the transactional outbox. See docs/brd/00-platform-interoperability.md.
 */

import { db } from "@/lib/db";
import {
  workOrders,
  workOrderMaterials,
  bomLines,
  warehouses,
  products,
} from "@/lib/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { emitEvent } from "@/lib/events/outbox";
import { nextDocNumber } from "@/lib/services/document-sequence";
import { applyStockMovement, type Tx } from "@/lib/services/inventory";

export interface WorkOrderInput {
  productId: string;
  bomId?: string;
  warehouseId?: string;
  qtyPlanned?: number;
  dueDate?: string;
  boardId?: string;
  notes?: string;
}

export function listWorkOrders(workspaceId: string) {
  return db
    .select()
    .from(workOrders)
    .where(eq(workOrders.workspaceId, workspaceId))
    .orderBy(desc(workOrders.createdAt));
}

export async function getWorkOrder(workspaceId: string, id: string) {
  const [wo] = await db
    .select()
    .from(workOrders)
    .where(and(eq(workOrders.id, id), eq(workOrders.workspaceId, workspaceId)))
    .limit(1);
  if (!wo) return null;
  const materials = await db
    .select()
    .from(workOrderMaterials)
    .where(eq(workOrderMaterials.workOrderId, id))
    .orderBy(asc(workOrderMaterials.position));
  return { workOrder: wo, materials };
}

export async function createWorkOrder(workspaceId: string, input: WorkOrderInput, userId: string) {
  return db.transaction(async (tx) => {
    const number = await nextDocNumber(tx, { workspaceId, docType: "work_order" });
    const qtyPlanned = input.qtyPlanned ?? 1;
    const [wo] = await tx
      .insert(workOrders)
      .values({
        workspaceId,
        number,
        productId: input.productId,
        bomId: input.bomId || null,
        warehouseId: input.warehouseId || null,
        qtyPlanned,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        boardId: input.boardId || null,
        notes: input.notes || null,
        createdBy: userId,
      })
      .returning();

    // Explode the chosen BOM into work-order materials, scaled by planned qty.
    if (input.bomId) {
      const lines = await tx.select().from(bomLines).where(eq(bomLines.bomId, input.bomId)).orderBy(asc(bomLines.position));
      if (lines.length > 0) {
        await tx.insert(workOrderMaterials).values(
          lines.map((l, i) => ({
            workOrderId: wo.id,
            componentProductId: l.componentProductId,
            description: l.description,
            // scrapPct inflates the required quantity.
            qtyRequired: l.quantity * qtyPlanned * (1 + (l.scrapPct ?? 0) / 100),
            unit: l.unit,
            position: i,
          }))
        );
      }
    }
    return wo;
  });
}

export async function releaseWorkOrder(workspaceId: string, id: string, userId: string) {
  return db.transaction(async (tx) => {
    const [wo] = await tx
      .update(workOrders)
      .set({ status: "released", releasedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(workOrders.id, id), eq(workOrders.workspaceId, workspaceId)))
      .returning();
    if (!wo) return null;
    await emitEvent(tx, {
      workspaceId,
      eventType: "workorder.released",
      aggregateType: "work_order",
      aggregateId: id,
      actorUserId: userId,
      payload: { number: wo.number, productId: wo.productId, qtyPlanned: wo.qtyPlanned },
    });
    return wo;
  });
}

export interface CompleteInput {
  qtyProduced?: number;
  qtyScrapped?: number;
  warehouseId?: string;
}

/** Resolve the warehouse to use: explicit → work order → workspace default → first. */
async function resolveWarehouse(tx: Tx, workspaceId: string, explicit?: string | null, woWarehouse?: string | null) {
  if (explicit) return explicit;
  if (woWarehouse) return woWarehouse;
  const rows = await tx.select().from(warehouses).where(eq(warehouses.workspaceId, workspaceId));
  const def = rows.find((w) => w.isDefault) ?? rows[0];
  return def?.id ?? null;
}

export async function completeWorkOrder(workspaceId: string, id: string, input: CompleteInput, userId: string) {
  return db.transaction(async (tx) => {
    const [wo] = await tx
      .select()
      .from(workOrders)
      .where(and(eq(workOrders.id, id), eq(workOrders.workspaceId, workspaceId)))
      .limit(1);
    if (!wo) return { error: "not_found" as const };
    if (wo.status === "completed" || wo.status === "cancelled")
      return { error: "conflict" as const };

    const warehouseId = await resolveWarehouse(tx, workspaceId, input.warehouseId, wo.warehouseId);
    if (!warehouseId) return { error: "no_warehouse" as const };

    const qtyProduced = input.qtyProduced ?? wo.qtyPlanned;

    // Consume each tracked component from stock (negative adjustment).
    const materials = await tx.select().from(workOrderMaterials).where(eq(workOrderMaterials.workOrderId, id));
    for (const m of materials) {
      if (!m.componentProductId || m.qtyRequired <= 0) continue;
      const [comp] = await tx.select({ track: products.trackInventory }).from(products).where(eq(products.id, m.componentProductId)).limit(1);
      if (!comp?.track) continue;
      await applyStockMovement(tx, {
        workspaceId,
        productId: m.componentProductId,
        warehouseId,
        type: "adjustment",
        quantity: -m.qtyRequired,
        refType: "work_order",
        refId: id,
        note: `WO ${wo.number} component consumption`,
        actorUserId: userId,
      });
      await tx.update(workOrderMaterials).set({ qtyIssued: m.qtyRequired }).where(eq(workOrderMaterials.id, m.id));
    }

    // Receive finished goods into stock.
    const [fg] = await tx.select({ track: products.trackInventory }).from(products).where(eq(products.id, wo.productId)).limit(1);
    if (fg?.track && qtyProduced > 0) {
      await applyStockMovement(tx, {
        workspaceId,
        productId: wo.productId,
        warehouseId,
        type: "receipt",
        quantity: qtyProduced,
        refType: "work_order",
        refId: id,
        note: `WO ${wo.number} finished goods`,
        actorUserId: userId,
      });
    }

    const [updated] = await tx
      .update(workOrders)
      .set({
        status: "completed",
        qtyProduced,
        qtyScrapped: input.qtyScrapped ?? 0,
        warehouseId,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workOrders.id, id))
      .returning();

    await emitEvent(tx, {
      workspaceId,
      eventType: "workorder.completed",
      aggregateType: "work_order",
      aggregateId: id,
      actorUserId: userId,
      payload: { number: wo.number, productId: wo.productId, qtyProduced, qtyScrapped: input.qtyScrapped ?? 0 },
    });
    return { workOrder: updated };
  });
}
