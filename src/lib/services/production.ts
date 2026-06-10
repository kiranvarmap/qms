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
  stockMovements,
} from "@/lib/db/schema";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
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
  // ── Production Planning (BRD 13) ──
  priority?: "low" | "normal" | "high" | "urgent";
  processTemplateId?: string;
  salesOrderId?: string;
  customerId?: string;
  specialInstructions?: string;
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
        priority: input.priority || "normal",
        processTemplateId: input.processTemplateId || null,
        salesOrderId: input.salesOrderId || null,
        customerId: input.customerId || null,
        specialInstructions: input.specialInstructions || null,
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
    // Claim: only a planned WO releases, so the reservation below is single-shot
    // even under concurrent calls.
    const [wo] = await tx
      .update(workOrders)
      .set({ status: "released", releasedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(workOrders.id, id), eq(workOrders.workspaceId, workspaceId), eq(workOrders.status, "planned")))
      .returning();
    if (!wo) return null;

    // Reserve tracked components (committed+) so available stock reflects this
    // job and sales orders can't ship the materials away (blueprint 04 §4).
    const warehouseId = await resolveWarehouse(tx, workspaceId, null, wo.warehouseId);
    if (warehouseId) {
      const materials = await tx.select().from(workOrderMaterials).where(eq(workOrderMaterials.workOrderId, id));
      for (const m of materials) {
        if (!m.componentProductId || m.qtyRequired <= 0) continue;
        const [comp] = await tx
          .select({ track: products.trackInventory })
          .from(products)
          .where(eq(products.id, m.componentProductId))
          .limit(1);
        if (!comp?.track) continue;
        await applyStockMovement(tx, {
          workspaceId,
          productId: m.componentProductId,
          warehouseId,
          type: "reservation",
          quantity: m.qtyRequired,
          refType: "work_order",
          refId: id,
          note: `WO ${wo.number} material reservation`,
          actorUserId: userId,
        });
      }
    }

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

/**
 * Release whatever this work order still holds reserved, computed from the
 * ledger itself (sum of committedDelta per product × warehouse) — robust
 * against warehouse overrides and material edits between release and now.
 */
async function releaseWoReservations(tx: Tx, workspaceId: string, woId: string, woNumber: string, userId: string | null) {
  const held = await tx
    .select({
      productId: stockMovements.productId,
      warehouseId: stockMovements.warehouseId,
      qty: sql<number>`sum(${stockMovements.committedDelta})`,
    })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.refType, "work_order"),
        eq(stockMovements.refId, woId),
        inArray(stockMovements.type, ["reservation", "reservation_release"])
      )
    )
    .groupBy(stockMovements.productId, stockMovements.warehouseId);

  for (const h of held) {
    const qty = Number(h.qty);
    if (qty <= 0) continue;
    await applyStockMovement(tx, {
      workspaceId,
      productId: h.productId,
      warehouseId: h.warehouseId,
      type: "reservation_release",
      quantity: qty,
      refType: "work_order",
      refId: woId,
      note: `WO ${woNumber} reservation release`,
      actorUserId: userId,
    });
  }
}

export async function cancelWorkOrder(workspaceId: string, id: string, userId: string) {
  return db.transaction(async (tx) => {
    const [wo] = await tx
      .update(workOrders)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(workOrders.id, id),
          eq(workOrders.workspaceId, workspaceId),
          inArray(workOrders.status, ["planned", "released"])
        )
      )
      .returning();
    if (!wo) return null;

    // A released WO holds material reservations — give them back.
    await releaseWoReservations(tx, workspaceId, id, wo.number, userId);

    await emitEvent(tx, {
      workspaceId,
      eventType: "workorder.cancelled",
      aggregateType: "work_order",
      aggregateId: id,
      actorUserId: userId,
      payload: { number: wo.number, productId: wo.productId },
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

    // Give back whatever release reserved before consuming — consumption
    // lowers onHand, the release lowers committed, so available stays honest.
    await releaseWoReservations(tx, workspaceId, id, wo.number, userId);

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
