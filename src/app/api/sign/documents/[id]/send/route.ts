import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { signDocuments, signRecipients, signEvents, signFields, users, notifications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Resend } from "resend";

const resend = process.env.AUTH_RESEND_KEY
  ? new Resend(process.env.AUTH_RESEND_KEY)
  : null;

// POST /api/sign/documents/[id]/send — send document for signatures
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [doc] = await db
    .select()
    .from(signDocuments)
    .where(eq(signDocuments.id, id))
    .limit(1);

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.status !== "draft") {
    return NextResponse.json({ error: "Document is not in draft status" }, { status: 400 });
  }

  const recipients = await db
    .select()
    .from(signRecipients)
    .where(eq(signRecipients.documentId, id));

  if (recipients.length === 0) {
    return NextResponse.json({ error: "Add at least one recipient before sending" }, { status: 400 });
  }

  // Check each signer has at least one field
  const signers = recipients.filter((r) => r.role === "signer");
  const fields = await db
    .select()
    .from(signFields)
    .where(eq(signFields.documentId, id));

  for (const signer of signers) {
    const hasField = fields.some((f) => f.recipientId === signer.id);
    if (!hasField) {
      return NextResponse.json(
        { error: `Signer "${signer.name}" has no fields assigned. Add at least one field per signer.` },
        { status: 400 }
      );
    }
  }

  // Update document status
  await db
    .update(signDocuments)
    .set({ status: "pending", updatedAt: new Date() })
    .where(eq(signDocuments.id, id));

  // Log event
  await db.insert(signEvents).values({
    documentId: id,
    eventType: "document_sent",
    description: `Document sent for signature by ${session.user.name || session.user.email} to ${recipients.length} recipient(s)`,
  });

  // Send emails
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  for (const recipient of signers) {
    const signingUrl = `${baseUrl}/sign/${recipient.token}`;

    // In-app notification if the recipient is also a platform user (match by email).
    try {
      const [u] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, recipient.email.toLowerCase().trim()))
        .limit(1);
      if (u) {
        await db.insert(notifications).values({
          userId: u.id,
          type: "signature_requested",
          title: "Signature requested",
          body: `You've been asked to sign "${doc.title}"`,
          meta: { signingUrl, documentId: id },
        });
      }
    } catch { /* ignore */ }

    if (resend) {
      try {
        await resend.emails.send({
          from: "DocSign <noreply@yourdomain.com>",
          to: recipient.email,
          subject: `Please sign: ${doc.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1d4ed8;">Document Signature Request</h2>
              <p>Hello <strong>${recipient.name}</strong>,</p>
              <p><strong>${session.user.name || session.user.email}</strong> has sent you a document to sign:</p>
              <p style="font-size: 18px; font-weight: bold; color: #111;">${doc.title}</p>
              ${doc.message ? `<p style="background: #f3f4f6; padding: 12px; border-radius: 6px;">${doc.message}</p>` : ""}
              <a href="${signingUrl}" style="
                display: inline-block;
                background: #2563eb;
                color: white;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: bold;
                margin: 16px 0;
              ">Review & Sign Document</a>
              <p style="color: #6b7280; font-size: 12px;">If the button doesn't work, copy this link: ${signingUrl}</p>
            </div>
          `,
        });
      } catch { /* email failure should not block the send */ }
    }
  }

  return NextResponse.json({ success: true, recipientCount: recipients.length });
}
