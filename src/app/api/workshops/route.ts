import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workshops } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// GET /api/workshops
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.select().from(workshops).orderBy(desc(workshops.createdAt));
  return NextResponse.json(rows);
}

// POST /api/workshops
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, location, description } = body;
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const [row] = await db
    .insert(workshops)
    .values({ name, location: location || null, description: description || null })
    .returning();

  return NextResponse.json(row, { status: 201 });
}

// PUT /api/workshops — update or deactivate (pass id + fields in body)
export async function PUT(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, name, location, description, isActive } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const [updated] = await db
    .update(workshops)
    .set({
      name: name ?? undefined,
      location: location ?? null,
      description: description ?? null,
      isActive: isActive ?? undefined,
    })
    .where(eq(workshops.id, id))
    .returning();

  return NextResponse.json(updated);
}

// DELETE /api/workshops — pass id in body
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  await db.delete(workshops).where(eq(workshops.id, id));
  return NextResponse.json({ success: true });
}
