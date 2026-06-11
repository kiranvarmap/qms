/**
 * Product Management — engineering layer (BRD 0X).
 *
 * Adds BOMs, revisions, specifications, and engineering change requests (ECR)
 * on top of the existing `products` master (product CRUD lives in
 * /api/products). Every cross-module side effect is emitted through the
 * transactional outbox (see docs/brd/00-platform-interoperability.md).
 */

import { db } from "@/lib/db";
import {
  products,
  boms,
  bomLines,
  productRevisions,
  productSpecifications,
  engineeringChangeRequests,
} from "@/lib/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { emitEvent } from "@/lib/events/outbox";
import { nextDocNumber } from "@/lib/services/document-sequence";

/** A Drizzle transaction handle (same surface as `db`). */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ── Read model: a product's engineering data ──────────────────────────

export async function getProductEngineering(workspaceId: string, productId: string) {
  const [bomRows, revisionRows, specRows] = await Promise.all([
    db.select().from(boms).where(and(eq(boms.productId, productId), eq(boms.workspaceId, workspaceId))).orderBy(desc(boms.createdAt)),
    db.select().from(productRevisions).where(and(eq(productRevisions.productId, productId), eq(productRevisions.workspaceId, workspaceId))).orderBy(desc(productRevisions.createdAt)),
    db.select().from(productSpecifications).where(and(eq(productSpecifications.productId, productId), eq(productSpecifications.workspaceId, workspaceId))).orderBy(asc(productSpecifications.position)),
  ]);

  const bomsWithLines = await Promise.all(
    bomRows.map(async (b) => ({
      ...b,
      lines: await db.select().from(bomLines).where(eq(bomLines.bomId, b.id)).orderBy(asc(bomLines.position)),
    }))
  );

  return { boms: bomsWithLines, revisions: revisionRows, specs: specRows };
}

// ── BOM ───────────────────────────────────────────────────────────────

export interface BomLineInput {
  componentProductId?: string;
  description?: string;
  quantity?: number;
  unit?: string;
  scrapPct?: number;
}
export interface BomInput {
  version?: string;
  name?: string;
  status?: "draft" | "active" | "archived";
  notes?: string;
  lines?: BomLineInput[];
}

export async function createBom(workspaceId: string, productId: string, input: BomInput, userId: string) {
  return db.transaction(async (tx) => {
    const [bom] = await tx
      .insert(boms)
      .values({
        workspaceId,
        productId,
        version: input.version || "v1",
        name: input.name || null,
        status: input.status ?? "draft",
        notes: input.notes || null,
        createdBy: userId,
      })
      .returning();

    const lines = input.lines ?? [];
    if (lines.length > 0) {
      await tx.insert(bomLines).values(
        lines.map((l, i) => ({
          bomId: bom.id,
          componentProductId: l.componentProductId || null,
          description: l.description || null,
          quantity: l.quantity ?? 1,
          unit: l.unit || "unit",
          scrapPct: l.scrapPct ?? 0,
          position: i,
        }))
      );
    }

    await emitEvent(tx, {
      workspaceId,
      eventType: "bom.created",
      aggregateType: "bom",
      aggregateId: bom.id,
      actorUserId: userId,
      payload: { productId, version: bom.version, lineCount: lines.length },
    });
    return bom;
  });
}

// ── Revisions ─────────────────────────────────────────────────────────

export interface RevisionInput {
  revision: string;
  changeSummary?: string;
  release?: boolean;
}

export async function createRevision(workspaceId: string, productId: string, input: RevisionInput, userId: string) {
  return db.transaction(async (tx) => {
    const releasing = Boolean(input.release);
    const [rev] = await tx
      .insert(productRevisions)
      .values({
        workspaceId,
        productId,
        revision: input.revision,
        changeSummary: input.changeSummary || null,
        status: releasing ? "released" : "draft",
        releasedAt: releasing ? new Date() : null,
        createdBy: userId,
      })
      .returning();

    if (releasing) {
      await tx.update(products).set({ currentRevision: rev.revision, updatedAt: new Date() }).where(eq(products.id, productId));
    }

    await emitEvent(tx, {
      workspaceId,
      eventType: "product.revision_created",
      aggregateType: "product_revision",
      aggregateId: rev.id,
      actorUserId: userId,
      payload: { productId, revision: rev.revision },
    });
    if (releasing) {
      await emitEvent(tx, {
        workspaceId,
        eventType: "product.revision_released",
        aggregateType: "product_revision",
        aggregateId: rev.id,
        actorUserId: userId,
        payload: { productId, revision: rev.revision },
      });
    }
    return rev;
  });
}

// ── Specifications ────────────────────────────────────────────────────

export interface SpecInput {
  key: string;
  value?: string;
  unit?: string;
}

export async function addSpec(workspaceId: string, productId: string, input: SpecInput) {
  const existing = await db
    .select({ id: productSpecifications.id })
    .from(productSpecifications)
    .where(eq(productSpecifications.productId, productId));
  const [spec] = await db
    .insert(productSpecifications)
    .values({
      workspaceId,
      productId,
      key: input.key,
      value: input.value || null,
      unit: input.unit || null,
      position: existing.length,
    })
    .returning();
  return spec;
}

export async function deleteSpec(workspaceId: string, specId: string) {
  await db
    .delete(productSpecifications)
    .where(and(eq(productSpecifications.id, specId), eq(productSpecifications.workspaceId, workspaceId)));
}

// ── Engineering Change Requests ───────────────────────────────────────

export interface EcrInput {
  productId?: string;
  title: string;
  description?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  submit?: boolean;
}

export function listEcr(workspaceId: string) {
  return db
    .select()
    .from(engineeringChangeRequests)
    .where(eq(engineeringChangeRequests.workspaceId, workspaceId))
    .orderBy(desc(engineeringChangeRequests.createdAt));
}

export async function createEcr(workspaceId: string, input: EcrInput, userId: string) {
  return db.transaction(async (tx) => {
    const number = await nextDocNumber(tx, { workspaceId, docType: "engineering_change_request" });
    const submitting = Boolean(input.submit);
    const [ecr] = await tx
      .insert(engineeringChangeRequests)
      .values({
        workspaceId,
        productId: input.productId || null,
        number,
        title: input.title,
        description: input.description || null,
        priority: input.priority ?? "normal",
        status: submitting ? "submitted" : "draft",
        requestedBy: userId,
      })
      .returning();

    if (submitting) {
      await emitEvent(tx, {
        workspaceId,
        eventType: "ecr.submitted",
        aggregateType: "engineering_change_request",
        aggregateId: ecr.id,
        actorUserId: userId,
        payload: { number: ecr.number, productId: ecr.productId },
      });
    }
    return ecr;
  });
}

export async function decideEcr(
  workspaceId: string,
  ecrId: string,
  decision: "approved" | "rejected" | "implemented",
  notes: string | undefined,
  userId: string
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(engineeringChangeRequests)
      .where(and(eq(engineeringChangeRequests.id, ecrId), eq(engineeringChangeRequests.workspaceId, workspaceId)))
      .limit(1);
    if (!existing) return null;

    const [ecr] = await tx
      .update(engineeringChangeRequests)
      .set({
        status: decision,
        approverId: userId,
        decisionNotes: notes || null,
        decidedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(engineeringChangeRequests.id, ecrId))
      .returning();

    await emitEvent(tx, {
      workspaceId,
      eventType: decision === "approved" ? "ecr.approved" : decision === "rejected" ? "ecr.rejected" : "ecr.implemented",
      aggregateType: "engineering_change_request",
      aggregateId: ecrId,
      actorUserId: userId,
      payload: { number: ecr.number, decision },
    });
    return ecr;
  });
}
