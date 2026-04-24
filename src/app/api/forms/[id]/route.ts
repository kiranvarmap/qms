import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { forms, formFields, columns } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

// GET /api/forms/[id] — full form with fields (public can access if isPublic)
export async function GET(req: Request, { params }: Params) {
  const { id } = await params;

  const [form] = await db.select().from(forms).where(eq(forms.id, id)).limit(1);
  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Public access check — if not public, require auth
  const session = await auth();
  if (!form.isPublic && !session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fields = await db
    .select({
      id: formFields.id,
      formId: formFields.formId,
      columnId: formFields.columnId,
      label: formFields.label,
      helpText: formFields.helpText,
      isVisible: formFields.isVisible,
      isRequired: formFields.isRequired,
      prefillParam: formFields.prefillParam,
      position: formFields.position,
      columnType: columns.type,
      columnConfig: columns.config,
    })
    .from(formFields)
    .leftJoin(columns, eq(formFields.columnId, columns.id))
    .where(eq(formFields.formId, id))
    .orderBy(asc(formFields.position));

  return NextResponse.json({ ...form, fields });
}

// PATCH /api/forms/[id]
export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [existing] = await db.select().from(forms).where(eq(forms.id, id)).limit(1);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updates: Partial<typeof existing> = { updatedAt: new Date() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.isPublic !== undefined) updates.isPublic = body.isPublic;
  if (body.isActive !== undefined) updates.isActive = body.isActive;
  if (body.submitMessage !== undefined) updates.submitMessage = body.submitMessage;

  const [updated] = await db
    .update(forms)
    .set(updates)
    .where(eq(forms.id, id))
    .returning();

  return NextResponse.json(updated);
}

// DELETE /api/forms/[id]
export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await db.delete(forms).where(eq(forms.id, id));
  return NextResponse.json({ ok: true });
}
