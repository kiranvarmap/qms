/**
 * Stock ledger (Plan §4 / §6.3).
 *
 * The ONE path through which stock ever changes. Every mutation writes an
 * immutable `stock_movements` row with explicit on-hand / committed deltas and
 * increments the `stock_levels` read model — never a bare counter update
 * (Plan §13 stock integrity). The §6.3 lifecycle maps movement types to deltas:
 *
 *   receipt              onHand +qty
 *   reservation          committed +qty           (Phase 5)
 *   reservation_release  committed −qty           (Phase 5)
 *   shipment             onHand −qty, committed −qty (Phase 5 — single deduction)
 *   adjustment           onHand ±qty (signed)
 *   transfer             onHand −qty @src, +qty @dst (two movements)
 *
 * Each movement emits the matching `stock.*` event and, when available drops
 * below the product's reorder level, `stock.low`.
 */

import { db } from "@/lib/db";
import { products, stockLevels, stockMovements } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { emitEvent } from "@/lib/events/outbox";
import type { EventType } from "@/lib/events/types";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = Tx | typeof db;

export type StockMovementType =
  | "receipt"
  | "reservation"
  | "reservation_release"
  | "shipment"
  | "adjustment"
  | "transfer";

const EVENT_FOR: Partial<Record<StockMovementType, EventType>> = {
  receipt: "stock.received",
  reservation: "stock.reserved",
  reservation_release: "stock.reservation_released",
  shipment: "stock.shipped",
  adjustment: "stock.adjusted",
};

/** Map a movement type + magnitude to (onHandDelta, committedDelta). */
function deltasFor(type: StockMovementType, quantity: number): { onHand: number; committed: number } {
  switch (type) {
    case "receipt":
      return { onHand: Math.abs(quantity), committed: 0 };
    case "reservation":
      return { onHand: 0, committed: Math.abs(quantity) };
    case "reservation_release":
      return { onHand: 0, committed: -Math.abs(quantity) };
    case "shipment":
      return { onHand: -Math.abs(quantity), committed: -Math.abs(quantity) };
    case "adjustment":
      return { onHand: quantity, committed: 0 }; // signed
    case "transfer":
      return { onHand: quantity, committed: 0 }; // caller passes signed per leg
  }
}

export interface MovementInput {
  workspaceId: string;
  productId: string;
  warehouseId: string;
  type: StockMovementType;
  /** Magnitude (adjustment/transfer may be signed). */
  quantity: number;
  refType?: string | null;
  refId?: string | null;
  note?: string | null;
  actorUserId?: string | null;
  /** Override computed deltas (used by transfer legs). */
  deltaOverride?: { onHand: number; committed: number };
}

/**
 * Record one stock movement and roll it into the level, inside `tx`. Returns
 * the new on-hand / committed for the product × warehouse.
 */
export async function applyStockMovement(
  tx: Tx,
  input: MovementInput
): Promise<{ onHand: number; committed: number }> {
  const d = input.deltaOverride ?? deltasFor(input.type, input.quantity);

  await tx.insert(stockMovements).values({
    workspaceId: input.workspaceId,
    productId: input.productId,
    warehouseId: input.warehouseId,
    type: input.type,
    quantity: input.quantity,
    onHandDelta: d.onHand,
    committedDelta: d.committed,
    refType: input.refType ?? null,
    refId: input.refId ?? null,
    note: input.note ?? null,
    actorUserId: input.actorUserId ?? null,
  });

  const [level] = await tx
    .insert(stockLevels)
    .values({
      workspaceId: input.workspaceId,
      productId: input.productId,
      warehouseId: input.warehouseId,
      onHand: d.onHand,
      committed: d.committed,
    })
    .onConflictDoUpdate({
      target: [stockLevels.productId, stockLevels.warehouseId],
      set: {
        onHand: sql`${stockLevels.onHand} + ${d.onHand}`,
        committed: sql`${stockLevels.committed} + ${d.committed}`,
        updatedAt: new Date(),
      },
    })
    .returning();

  // Emit the domain event for this movement.
  const evt = EVENT_FOR[input.type];
  if (evt) {
    await emitEvent(tx, {
      workspaceId: input.workspaceId,
      eventType: evt,
      aggregateType: "product",
      aggregateId: input.productId,
      actorUserId: input.actorUserId ?? null,
      payload: {
        warehouseId: input.warehouseId,
        quantity: input.quantity,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
      },
    });
  }

  // Low-stock check against the product's reorder level (workspace-wide on-hand
  // could differ per warehouse; we check this warehouse's available).
  const available = level.onHand - level.committed;
  const [product] = await tx
    .select({ reorderLevel: products.reorderLevel, name: products.name, track: products.trackInventory })
    .from(products)
    .where(eq(products.id, input.productId))
    .limit(1);
  if (product?.track && product.reorderLevel > 0 && available < product.reorderLevel) {
    await emitEvent(tx, {
      workspaceId: input.workspaceId,
      eventType: "stock.low",
      aggregateType: "product",
      aggregateId: input.productId,
      actorUserId: input.actorUserId ?? null,
      payload: { warehouseId: input.warehouseId, available, reorderLevel: product.reorderLevel, name: product.name },
    });
  }

  return { onHand: level.onHand, committed: level.committed };
}

/** Move stock between two warehouses as two ledger legs (out then in). */
export async function transferStock(
  tx: Tx,
  input: {
    workspaceId: string;
    productId: string;
    fromWarehouseId: string;
    toWarehouseId: string;
    quantity: number;
    note?: string | null;
    actorUserId?: string | null;
  }
): Promise<void> {
  const qty = Math.abs(input.quantity);
  const common = {
    workspaceId: input.workspaceId,
    productId: input.productId,
    type: "transfer" as const,
    refType: "transfer",
    note: input.note ?? null,
    actorUserId: input.actorUserId ?? null,
  };
  await applyStockMovement(tx, {
    ...common,
    warehouseId: input.fromWarehouseId,
    quantity: -qty,
    deltaOverride: { onHand: -qty, committed: 0 },
  });
  await applyStockMovement(tx, {
    ...common,
    warehouseId: input.toWarehouseId,
    quantity: qty,
    deltaOverride: { onHand: qty, committed: 0 },
  });
}

/** Current available (onHand − committed) for a product across all warehouses. */
export async function productAvailability(
  executor: Executor,
  productId: string
): Promise<{ onHand: number; committed: number; available: number }> {
  const [row] = await executor
    .select({
      onHand: sql<number>`coalesce(sum(${stockLevels.onHand}), 0)`,
      committed: sql<number>`coalesce(sum(${stockLevels.committed}), 0)`,
    })
    .from(stockLevels)
    .where(eq(stockLevels.productId, productId));
  const onHand = Number(row?.onHand ?? 0);
  const committed = Number(row?.committed ?? 0);
  return { onHand, committed, available: onHand - committed };
}
