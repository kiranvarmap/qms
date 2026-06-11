import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  signDocuments,
  signRecipients,
  signFields,
  signEvents,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { uploadToS3 } from "@/lib/storage";

// GET /api/sign/token/[token] — public: get document info + recipient's fields
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const [recipient] = await db
    .select()
    .from(signRecipients)
    .where(eq(signRecipients.token, token))
    .limit(1);

  if (!recipient) {
    return NextResponse.json({ error: "Invalid signing link" }, { status: 404 });
  }

  const [doc] = await db
    .select()
    .from(signDocuments)
    .where(eq(signDocuments.id, recipient.documentId))
    .limit(1);

  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  if (doc.status === "voided") {
    return NextResponse.json({ error: "This document has been voided" }, { status: 410 });
  }
  if (doc.status === "completed") {
    return NextResponse.json({ error: "This document has already been completed" }, { status: 410 });
  }

  // Mark as viewed if first time
  if (recipient.status === "pending") {
    await db
      .update(signRecipients)
      .set({ status: "viewed" })
      .where(eq(signRecipients.id, recipient.id));

    await db.insert(signEvents).values({
      documentId: doc.id,
      recipientId: recipient.id,
      eventType: "document_viewed",
      description: `${recipient.name} viewed the document`,
      ipAddress: request.headers.get("x-forwarded-for") || null,
    });
  }

  // Get only this recipient's fields
  const fields = await db
    .select()
    .from(signFields)
    .where(
      and(
        eq(signFields.documentId, doc.id),
        eq(signFields.recipientId, recipient.id)
      )
    );

  return NextResponse.json({ document: doc, recipient, fields });
}

// POST /api/sign/token/[token] — public: submit signed fields
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json();
  const { fieldValues, action = "sign" } = body as {
    fieldValues?: Record<string, string>;
    action?: "sign" | "decline";
    declineReason?: string;
  };

  const [recipient] = await db
    .select()
    .from(signRecipients)
    .where(eq(signRecipients.token, token))
    .limit(1);

  if (!recipient) return NextResponse.json({ error: "Invalid signing link" }, { status: 404 });
  if (recipient.status === "signed") {
    return NextResponse.json({ error: "Already signed" }, { status: 400 });
  }

  const [doc] = await db
    .select()
    .from(signDocuments)
    .where(eq(signDocuments.id, recipient.documentId))
    .limit(1);

  if (!doc || doc.status !== "pending") {
    return NextResponse.json({ error: "Document is not available for signing" }, { status: 400 });
  }

  if (action === "decline") {
    const declineReason = body.declineReason || "No reason provided";
    await db
      .update(signRecipients)
      .set({ status: "declined", declineReason, signedAt: new Date() })
      .where(eq(signRecipients.id, recipient.id));

    await db
      .update(signDocuments)
      .set({ status: "declined", updatedAt: new Date() })
      .where(eq(signDocuments.id, doc.id));

    await db.insert(signEvents).values({
      documentId: doc.id,
      recipientId: recipient.id,
      eventType: "document_declined",
      description: `${recipient.name} declined to sign. Reason: ${declineReason}`,
    });

    return NextResponse.json({ success: true, action: "declined" });
  }

  // Save field values
  if (fieldValues) {
    for (const [fieldId, value] of Object.entries(fieldValues)) {
      await db
        .update(signFields)
        .set({ value, completedAt: new Date() })
        .where(
          and(
            eq(signFields.id, fieldId),
            eq(signFields.recipientId, recipient.id)
          )
        );
    }
  }

  // Mark recipient as signed
  await db
    .update(signRecipients)
    .set({ status: "signed", signedAt: new Date() })
    .where(eq(signRecipients.id, recipient.id));

  await db.insert(signEvents).values({
    documentId: doc.id,
    recipientId: recipient.id,
    eventType: "recipient_signed",
    description: `${recipient.name} (${recipient.email}) signed the document`,
    ipAddress: request.headers.get("x-forwarded-for") || null,
  });

  // Check if all signers have signed
  const allRecipients = await db
    .select()
    .from(signRecipients)
    .where(eq(signRecipients.documentId, doc.id));

  const signers = allRecipients.filter((r) => r.role === "signer");
  const allSigned = signers.every((r) => r.status === "signed" || r.id === recipient.id);

  if (allSigned) {
    // Generate final signed PDF
    try {
      const completedPath = await generateSignedPdf(doc.id, doc.filePath);

      await db
        .update(signDocuments)
        .set({
          status: "completed",
          completedAt: new Date(),
          completedFilePath: completedPath,
          updatedAt: new Date(),
        })
        .where(eq(signDocuments.id, doc.id));

      await db.insert(signEvents).values({
        documentId: doc.id,
        eventType: "document_completed",
        description: "All signers have signed. Document completed.",
      });
    } catch (err) {
      console.error("Failed to generate signed PDF:", err);
      // Still mark completed even if PDF generation fails
      await db
        .update(signDocuments)
        .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
        .where(eq(signDocuments.id, doc.id));
    }
  }

  return NextResponse.json({ success: true, allSigned });
}

async function generateSignedPdf(documentId: string, originalFilePath: string): Promise<string> {
  const fields = await db
    .select()
    .from(signFields)
    .where(eq(signFields.documentId, documentId));

  const signedFields = fields.filter((f) => f.value && f.completedAt);

  // Fetch the original PDF from object storage (Azure Blob URL), not local disk.
  const srcRes = await fetch(originalFilePath);
  if (!srcRes.ok) throw new Error(`Could not fetch original PDF (${srcRes.status})`);
  const pdfBytes = new Uint8Array(await srcRes.arrayBuffer());
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const field of signedFields) {
    const page = pages[field.page - 1];
    if (!page) continue;

    const { width: pW, height: pH } = page.getSize();
    const fieldX = (field.x / 100) * pW;
    const fieldY = pH - (field.y / 100) * pH - (field.height / 100) * pH;
    const fieldW = (field.width / 100) * pW;
    const fieldH = (field.height / 100) * pH;

    if (
      (field.type === "signature" || field.type === "initials") &&
      field.value?.startsWith("data:image/png;base64,")
    ) {
      const base64 = field.value.split(",")[1];
      const pngBytes = Buffer.from(base64, "base64");
      const img = await pdfDoc.embedPng(pngBytes);
      page.drawImage(img, { x: fieldX, y: fieldY, width: fieldW, height: fieldH });
    } else if (field.type === "text" || field.type === "date") {
      page.drawText(field.value || "", {
        x: fieldX + 2,
        y: fieldY + fieldH / 2 - 5,
        size: Math.min(Math.max(fieldH * 0.5, 8), 14),
        font: helvetica,
        color: rgb(0, 0, 0),
      });
    } else if (field.type === "checkbox" && field.value === "true") {
      // Draw a checkmark box
      page.drawRectangle({
        x: fieldX,
        y: fieldY,
        width: fieldW,
        height: fieldH,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });
      page.drawText("✓", {
        x: fieldX + 2,
        y: fieldY + fieldH / 2 - 5,
        size: Math.min(fieldH * 0.7, 14),
        font: helvetica,
        color: rgb(0.1, 0.5, 0.1),
      });
    }
  }

  const signedPdfBytes = await pdfDoc.save();
  // Upload the completed PDF to object storage and return its URL (the container
  // filesystem is ephemeral and not web-served, so local writes would be lost).
  const { url } = await uploadToS3(
    Buffer.from(signedPdfBytes),
    "signed.pdf",
    "application/pdf",
    "sign/completed"
  );
  return url;
}
