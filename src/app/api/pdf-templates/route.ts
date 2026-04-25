import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pdfTemplates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_PDF_CONFIG } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/pdf-templates — list all PDF templates
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(pdfTemplates)
    .orderBy(pdfTemplates.createdAt);

  return NextResponse.json(rows);
}

// POST /api/pdf-templates — create new PDF template
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const name = (body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const config = body.config ?? DEFAULT_PDF_CONFIG;

  const [row] = await db
    .insert(pdfTemplates)
    .values({
      name,
      description: body.description || null,
      config,
      workspaceId: body.workspaceId || null,
      createdBy: session.user.id,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
