import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  inspections,
  inspectionResponses,
  inspectionActions,
  users,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function getFullInspection(id: string) {
  const rows = await db
    .select({
      inspection: inspections,
      userName: users.name,
      userEmail: users.email,
    })
    .from(inspections)
    .leftJoin(users, eq(inspections.conductedBy, users.id))
    .where(eq(inspections.id, id));

  if (!rows.length) return null;
  const { inspection, userName, userEmail } = rows[0];

  const responses = await db
    .select()
    .from(inspectionResponses)
    .where(eq(inspectionResponses.inspectionId, id));

  const actions = await db
    .select()
    .from(inspectionActions)
    .where(eq(inspectionActions.inspectionId, id));

  return {
    ...inspection,
    conductedByName: userName || userEmail,
    responses,
    actions,
  };
}

// GET /api/inspections/[id]
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const inspection = await getFullInspection(id);
  if (!inspection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(inspection);
}

// PATCH /api/inspections/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();

  const update: Record<string, unknown> = {};
  if (body.title !== undefined) update.title = body.title;
  if (body.site !== undefined) update.site = body.site;

  await db.update(inspections).set(update).where(eq(inspections.id, id));
  const inspection = await getFullInspection(id);
  return NextResponse.json(inspection);
}

// DELETE /api/inspections/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await db.delete(inspections).where(eq(inspections.id, id));
  return NextResponse.json({ message: "Deleted" });
}
