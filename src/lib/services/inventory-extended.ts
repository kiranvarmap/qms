/**
 * Inventory — full BRD extensions.
 *
 * Locations/bins, lot & serial tracking (FEFO), damaged/quarantine/scrap
 * buckets, cycle counting, and FIFO valuation layers. Built additively on the
 * core stock ledger (src/lib/services/inventory.ts): on-hand changes still flow
 * through applyStockMovement; the "unavailable" buckets live on stock_levels.
 */

import { db } from "@/lib/db";
import {
  locations, lots, serials, valuationLayers, cycleCounts, cycleCountLines,
  stockLevels, stockMovements, products,
} from "@/lib/db/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { emitEvent } from "@/lib/events/outbox";
import { applyStockMovement, type Tx } from "@/lib/services/inventory";

// ── Locations ─────────────────────────────────────────────────────────
export interface LocationInput { warehouseId: string; code: string; name?: string; kind?: "zone" | "aisle" | "rack" | "shelf" | "bin"; parentLocationId?: string; }

export function listLocations(workspaceId: string, warehouseId?: string) {
  const where = warehouseId
    ? and(eq(locations.workspaceId, workspaceId), eq(locations.warehouseId, warehouseId))
    : eq(locations.workspaceId, workspaceId);
  return db.select().from(locations).where(where).orderBy(asc(locations.code));
}

export async function createLocation(workspaceId: string, input: LocationInput) {
  const [loc] = await db.insert(locations).values({
    workspaceId, warehouseId: input.warehouseId, code: input.code, name: input.name || null,
    kind: input.kind ?? "bin", parentLocationId: input.parentLocationId || null,
  }).returning();
  return loc;
}

// ── Lots / batches ────────────────────────────────────────────────────
export interface LotInput { productId: string; lotNumber: string; supplierLotNumber?: string; mfgDate?: string; expiryDate?: string; }

export function listLots(workspaceId: string, productId?: string) {
  const where = productId
    ? and(eq(lots.workspaceId, workspaceId), eq(lots.productId, productId))
    : eq(lots.workspaceId, workspaceId);
  // FEFO order: soonest expiry first (nulls last).
  return db.select().from(lots).where(where).orderBy(asc(lots.expiryDate));
}

export async function createLot(workspaceId: string, input: LotInput, userId: string) {
  return db.transaction(async (tx) => {
    const [lot] = await tx.insert(lots).values({
      workspaceId, productId: input.productId, lotNumber: input.lotNumber,
      supplierLotNumber: input.supplierLotNumber || null,
      mfgDate: input.mfgDate ? new Date(input.mfgDate) : null,
      expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
    }).returning();
    await emitEvent(tx, { workspaceId, eventType: "lot.created", aggregateType: "lot", aggregateId: lot.id, actorUserId: userId, payload: { productId: lot.productId, lotNumber: lot.lotNumber, expiryDate: lot.expiryDate } });
    return lot;
  });
}

// ── Serials ───────────────────────────────────────────────────────────
export interface SerialInput { productId: string; serialNumber: string; lotId?: string; warehouseId?: string; }

export function listSerials(workspaceId: string, productId?: string) {
  const where = productId
    ? and(eq(serials.workspaceId, workspaceId), eq(serials.productId, productId))
    : eq(serials.workspaceId, workspaceId);
  return db.select().from(serials).where(where).orderBy(desc(serials.createdAt));
}

export async function createSerial(workspaceId: string, input: SerialInput, userId: string) {
  return db.transaction(async (tx) => {
    const [serial] = await tx.insert(serials).values({
      workspaceId, productId: input.productId, serialNumber: input.serialNumber,
      lotId: input.lotId || null, warehouseId: input.warehouseId || null,
    }).returning();
    await emitEvent(tx, { workspaceId, eventType: "serial.created", aggregateType: "serial", aggregateId: serial.id, actorUserId: userId, payload: { productId: serial.productId, serialNumber: serial.serialNumber } });
    return serial;
  });
}

// ── Damaged / quarantine / scrap buckets ──────────────────────────────
type BucketDelta = { onHand?: number; damaged?: number; quarantine?: number };

async function adjustBuckets(tx: Tx, workspaceId: string, productId: string, warehouseId: string, d: BucketDelta) {
  await tx.insert(stockLevels).values({
    workspaceId, productId, warehouseId,
    onHand: d.onHand ?? 0, committed: 0, damaged: d.damaged ?? 0, quarantine: d.quarantine ?? 0,
  }).onConflictDoUpdate({
    target: [stockLevels.productId, stockLevels.warehouseId],
    set: {
      onHand: sql`${stockLevels.onHand} + ${d.onHand ?? 0}`,
      damaged: sql`${stockLevels.damaged} + ${d.damaged ?? 0}`,
      quarantine: sql`${stockLevels.quarantine} + ${d.quarantine ?? 0}`,
      updatedAt: new Date(),
    },
  });
}

export type StatusMove = "damage" | "quarantine" | "quarantine_release" | "scrap";
export interface StatusMoveInput { productId: string; warehouseId: string; quantity: number; from?: "on_hand" | "quarantine" | "damaged"; note?: string; }

const STATUS_EVENT = {
  damage: "stock.damaged",
  quarantine: "stock.quarantined",
  quarantine_release: "stock.quarantine_released",
  scrap: "stock.scrapped",
} as const;

export async function moveStockStatus(workspaceId: string, move: StatusMove, input: StatusMoveInput, userId: string) {
  return db.transaction(async (tx) => {
    const q = Math.abs(input.quantity);
    // Compute bucket deltas for the move.
    let delta: BucketDelta;
    if (move === "damage") delta = { onHand: -q, damaged: q };
    else if (move === "quarantine") delta = { onHand: -q, quarantine: q };
    else if (move === "quarantine_release") delta = { onHand: q, quarantine: -q };
    else delta = input.from === "damaged" ? { damaged: -q } : input.from === "quarantine" ? { quarantine: -q } : { onHand: -q }; // scrap removes entirely

    await adjustBuckets(tx, workspaceId, input.productId, input.warehouseId, delta);

    await tx.insert(stockMovements).values({
      workspaceId, productId: input.productId, warehouseId: input.warehouseId,
      type: "adjustment",
      quantity: -q,
      onHandDelta: delta.onHand ?? 0,
      committedDelta: 0,
      refType: move, refId: null, note: input.note ?? null, actorUserId: userId,
    });

    await emitEvent(tx, { workspaceId, eventType: STATUS_EVENT[move], aggregateType: "product", aggregateId: input.productId, actorUserId: userId, payload: { warehouseId: input.warehouseId, quantity: q } });
    return { ok: true };
  });
}

// ── Cycle counts ──────────────────────────────────────────────────────
export function listCycleCounts(workspaceId: string) {
  return db.select().from(cycleCounts).where(eq(cycleCounts.workspaceId, workspaceId)).orderBy(desc(cycleCounts.createdAt));
}

export async function getCycleCount(workspaceId: string, id: string) {
  const [cc] = await db.select().from(cycleCounts).where(and(eq(cycleCounts.id, id), eq(cycleCounts.workspaceId, workspaceId))).limit(1);
  if (!cc) return null;
  const lines = await db.select().from(cycleCountLines).where(eq(cycleCountLines.cycleCountId, id)).orderBy(asc(cycleCountLines.position));
  return { count: cc, lines };
}

/** Create a count and snapshot current system on-hand for the warehouse's products. */
export async function createCycleCount(workspaceId: string, warehouseId: string | undefined, note: string | undefined, userId: string) {
  return db.transaction(async (tx) => {
    const [cc] = await tx.insert(cycleCounts).values({ workspaceId, warehouseId: warehouseId || null, note: note || null, createdBy: userId }).returning();
    const levels = await tx
      .select({ productId: stockLevels.productId, warehouseId: stockLevels.warehouseId, onHand: stockLevels.onHand })
      .from(stockLevels)
      .where(warehouseId ? and(eq(stockLevels.workspaceId, workspaceId), eq(stockLevels.warehouseId, warehouseId)) : eq(stockLevels.workspaceId, workspaceId));
    if (levels.length > 0) {
      await tx.insert(cycleCountLines).values(levels.map((l, i) => ({ cycleCountId: cc.id, productId: l.productId, systemQty: l.onHand, position: i })));
    }
    return cc;
  });
}

export async function enterCounts(workspaceId: string, id: string, counts: { lineId: string; countedQty: number }[]) {
  const cc = await getCycleCount(workspaceId, id);
  if (!cc) return null;
  for (const c of counts) {
    await db.update(cycleCountLines).set({ countedQty: c.countedQty }).where(eq(cycleCountLines.id, c.lineId));
  }
  await db.update(cycleCounts).set({ status: "counted" }).where(eq(cycleCounts.id, id));
  return getCycleCount(workspaceId, id);
}

/** Post variances as stock adjustments and close the count. */
export async function postCycleCount(workspaceId: string, id: string, warehouseId: string | null, userId: string) {
  return db.transaction(async (tx) => {
    const [cc] = await tx.select().from(cycleCounts).where(and(eq(cycleCounts.id, id), eq(cycleCounts.workspaceId, workspaceId))).limit(1);
    if (!cc) return { error: "not_found" as const };
    if (cc.status === "posted") return { error: "conflict" as const };
    const wh = cc.warehouseId ?? warehouseId;
    const lines = await tx.select().from(cycleCountLines).where(eq(cycleCountLines.cycleCountId, id));
    for (const l of lines) {
      if (l.countedQty == null) continue;
      const variance = l.countedQty - l.systemQty;
      if (variance === 0) continue;
      const targetWh = wh;
      if (!targetWh) continue;
      await applyStockMovement(tx, {
        workspaceId, productId: l.productId, warehouseId: targetWh,
        type: "adjustment", quantity: variance,
        refType: "cycle_count", refId: id, note: "Cycle count variance", actorUserId: userId,
      });
    }
    const [updated] = await tx.update(cycleCounts).set({ status: "posted", postedAt: new Date() }).where(eq(cycleCounts.id, id)).returning();
    await emitEvent(tx, { workspaceId, eventType: "cyclecount.posted", aggregateType: "cycle_count", aggregateId: id, actorUserId: userId, payload: {} });
    return { count: updated };
  });
}

// ── Valuation ─────────────────────────────────────────────────────────
/** Record a FIFO layer at receipt (call alongside a receipt movement). */
export async function recordValuationLayer(tx: Tx, workspaceId: string, productId: string, warehouseId: string, qty: number, unitCostMinor: number, refType?: string, refId?: string) {
  await tx.insert(valuationLayers).values({ workspaceId, productId, warehouseId, qtyRemaining: qty, unitCostMinor, refType: refType ?? null, refId: refId ?? null });
}

/** Inventory value per product (sum of remaining FIFO layers; falls back to average cost × on-hand). */
export async function valuationReport(workspaceId: string) {
  const rows = await db
    .select({
      productId: products.id,
      name: products.name,
      sku: products.sku,
      method: products.valuationMethod,
      avgCostMinor: products.costMinor,
      onHand: sql<number>`coalesce(sum(${stockLevels.onHand}), 0)`,
    })
    .from(products)
    .leftJoin(stockLevels, eq(stockLevels.productId, products.id))
    .where(eq(products.workspaceId, workspaceId))
    .groupBy(products.id);

  const layerVal = await db
    .select({ productId: valuationLayers.productId, value: sql<number>`coalesce(sum(${valuationLayers.qtyRemaining} * ${valuationLayers.unitCostMinor}), 0)` })
    .from(valuationLayers)
    .where(eq(valuationLayers.workspaceId, workspaceId))
    .groupBy(valuationLayers.productId);
  const layerMap = new Map(layerVal.map((r) => [r.productId, Number(r.value)]));

  return rows.map((r) => {
    const onHand = Number(r.onHand);
    const fifoMinor = layerMap.get(r.productId) ?? 0;
    const valueMinor = r.method === "fifo" && fifoMinor > 0 ? fifoMinor : Math.round(onHand * r.avgCostMinor);
    return { productId: r.productId, name: r.name, sku: r.sku, method: r.method, onHand, valueMinor };
  });
}
