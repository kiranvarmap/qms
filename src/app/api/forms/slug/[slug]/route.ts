import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { forms, formFields, columns } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

type Params = { params: Promise<{ slug: string }> };

// GET /api/forms/slug/[slug] — public lookup by slug (no auth required for public forms)
export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;

  const [form] = await db.select().from(forms).where(eq(forms.slug, slug)).limit(1);
  if (!form || !form.isActive) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
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
    .where(eq(formFields.formId, form.id))
    .orderBy(asc(formFields.position));

  // Only return visible fields for public display
  const visibleFields = fields.filter((f) => f.isVisible);

  return NextResponse.json({ ...form, fields: visibleFields });
}
