import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { forms, formFields } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

// GET /api/forms/[id]/fields
export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: formId } = await params;

  const fields = await db
    .select()
    .from(formFields)
    .where(eq(formFields.formId, formId))
    .orderBy(asc(formFields.position));

  return NextResponse.json(fields);
}

// POST /api/forms/[id]/fields
export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: formId } = await params;

  const [form] = await db.select().from(forms).where(eq(forms.id, formId)).limit(1);
  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });

  const { columnId, label, helpText, isVisible, isRequired, prefillParam, position } =
    await req.json();

  if (!label?.trim()) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  // Calculate max position
  const existing = await db
    .select({ position: formFields.position })
    .from(formFields)
    .where(eq(formFields.formId, formId))
    .orderBy(formFields.position);

  const maxPos = existing.length > 0 ? existing[existing.length - 1].position : 0;

  const [field] = await db
    .insert(formFields)
    .values({
      formId,
      columnId: columnId ?? null,
      label: label.trim(),
      helpText: helpText ?? null,
      isVisible: isVisible ?? true,
      isRequired: isRequired ?? false,
      prefillParam: prefillParam ?? null,
      position: position ?? maxPos + 1,
    })
    .returning();

  return NextResponse.json(field, { status: 201 });
}

// PUT /api/forms/[id]/fields — bulk update all fields (reorder + settings)
export async function PUT(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: formId } = await params;

  const { fields } = await req.json() as { fields: Array<{
    id: string;
    label?: string;
    helpText?: string;
    isVisible?: boolean;
    isRequired?: boolean;
    prefillParam?: string;
    position?: number;
  }> };

  if (!Array.isArray(fields)) {
    return NextResponse.json({ error: "fields array is required" }, { status: 400 });
  }

  for (const field of fields) {
    const updates: Record<string, unknown> = {};
    if (field.label !== undefined) updates.label = field.label;
    if (field.helpText !== undefined) updates.helpText = field.helpText;
    if (field.isVisible !== undefined) updates.isVisible = field.isVisible;
    if (field.isRequired !== undefined) updates.isRequired = field.isRequired;
    if (field.prefillParam !== undefined) updates.prefillParam = field.prefillParam;
    if (field.position !== undefined) updates.position = field.position;

    if (Object.keys(updates).length > 0) {
      await db.update(formFields).set(updates).where(eq(formFields.id, field.id));
    }
  }

  const updated = await db
    .select()
    .from(formFields)
    .where(eq(formFields.formId, formId))
    .orderBy(asc(formFields.position));

  return NextResponse.json(updated);
}
