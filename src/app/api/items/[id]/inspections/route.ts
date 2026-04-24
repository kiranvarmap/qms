import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  inspectionItemLinks,
  inspections,
  inspectionTemplates,
  items,
} from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

// GET /api/items/[id]/inspections — list inspections linked to this board item
export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: itemId } = await params;

  const rows = await db
    .select({
      inspectionId: inspections.id,
      title: inspections.title,
      site: inspections.site,
      status: inspections.status,
      score: inspections.score,
      startedAt: inspections.startedAt,
      completedAt: inspections.completedAt,
      templateTitle: inspectionTemplates.title,
      linkedAt: inspectionItemLinks.linkedAt,
    })
    .from(inspectionItemLinks)
    .innerJoin(inspections, eq(inspections.id, inspectionItemLinks.inspectionId))
    .innerJoin(inspectionTemplates, eq(inspectionTemplates.id, inspections.templateId))
    .where(eq(inspectionItemLinks.itemId, itemId))
    .orderBy(desc(inspectionItemLinks.linkedAt));

  return NextResponse.json(rows);
}

// POST /api/items/[id]/inspections — link an inspection to this board item
export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: itemId } = await params;
  const { inspectionId } = await req.json();

  if (!inspectionId) {
    return NextResponse.json({ error: "inspectionId is required" }, { status: 400 });
  }

  // Verify item and inspection exist
  const [item] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const [inspection] = await db.select().from(inspections).where(eq(inspections.id, inspectionId)).limit(1);
  if (!inspection) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });

  // Upsert (ignore if already linked)
  const [existing] = await db
    .select()
    .from(inspectionItemLinks)
    .where(and(eq(inspectionItemLinks.itemId, itemId), eq(inspectionItemLinks.inspectionId, inspectionId)))
    .limit(1);

  if (existing) {
    return NextResponse.json(existing);
  }

  const [link] = await db
    .insert(inspectionItemLinks)
    .values({ itemId, inspectionId, linkedBy: session.user.id })
    .returning();

  return NextResponse.json(link, { status: 201 });
}

// DELETE /api/items/[id]/inspections?inspectionId=...
export async function DELETE(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: itemId } = await params;
  const { searchParams } = new URL(req.url);
  const inspectionId = searchParams.get("inspectionId");

  if (!inspectionId) return NextResponse.json({ error: "inspectionId query param required" }, { status: 400 });

  await db
    .delete(inspectionItemLinks)
    .where(and(eq(inspectionItemLinks.itemId, itemId), eq(inspectionItemLinks.inspectionId, inspectionId)));

  return NextResponse.json({ ok: true });
}
