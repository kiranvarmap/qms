import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { signDocuments, signRecipients, signEvents } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { uploadToS3 } from "@/lib/storage";
import { MAX_PDF_BYTES } from "@/lib/validations";
import { unauthorized, badRequest, serverError } from "@/lib/api";
import { logger } from "@/lib/logger";

// GET /api/sign/documents
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return unauthorized();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  try {
    const rows = await db
      .select({
        doc:            signDocuments,
        recipientCount: sql<number>`count(${signRecipients.id})`.mapWith(Number),
      })
      .from(signDocuments)
      .leftJoin(signRecipients, eq(signRecipients.documentId, signDocuments.id))
      .where(
        status && status !== "all"
          ? eq(signDocuments.status, status as "draft" | "pending" | "completed" | "voided" | "declined")
          : undefined
      )
      .groupBy(signDocuments.id)
      .orderBy(desc(signDocuments.createdAt));

    return NextResponse.json(rows.map((r) => ({ ...r.doc, recipientCount: r.recipientCount })));
  } catch (err) {
    logger.error("Failed to list sign documents", { error: String(err) });
    return serverError();
  }
}

// POST /api/sign/documents
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return unauthorized();

  try {
    const formData = await request.formData();
    const file    = formData.get("file")    as File   | null;
    const title   = (formData.get("title")   as string | null)?.trim();
    const message = (formData.get("message") as string | null)?.trim() || null;

    if (!file)  return badRequest("No file provided");
    if (!title) return badRequest("Title is required");

    if (!file.name.toLowerCase().endsWith(".pdf") || file.type !== "application/pdf") {
      return badRequest("Only PDF files are accepted");
    }
    if (file.size > MAX_PDF_BYTES) return badRequest("File too large. Max 20 MB");

    const buffer = Buffer.from(await file.arrayBuffer());
    const { key, url } = await uploadToS3(buffer, file.name, "application/pdf", "sign");

    const [doc] = await db
      .insert(signDocuments)
      .values({
        title,
        fileName: file.name,
        filePath: url,
        message,
        createdBy: session.user.id ?? null,
      })
      .returning();

    await db.insert(signEvents).values({
      documentId:  doc.id,
      eventType:   "document_created",
      description: `Document "${title}" uploaded by ${session.user.name || session.user.email}`,
    });

    logger.info("Sign document created", { userId: session.user.id, docId: doc.id, s3Key: key });

    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    logger.error("Failed to create sign document", { error: String(err) });
    return serverError();
  }
}
