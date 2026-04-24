import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { invitations, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { Resend } from "resend";

const resend = process.env.AUTH_RESEND_KEY
  ? new Resend(process.env.AUTH_RESEND_KEY)
  : null;

// POST /api/users/invite — invite a new user (admin only)
export async function POST(request: Request) {
  const session = await auth();

  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { email, role } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Check if user already exists
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (existingUser.length > 0) {
    return NextResponse.json(
      { error: "A user with this email already exists" },
      { status: 409 }
    );
  }

  // Create invitation
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(invitations).values({
    email: email.toLowerCase(),
    role: role || "user",
    token,
    invitedBy: session.user.id,
    expiresAt,
  });

  // Send invitation email
  const inviteUrl = `${process.env.NEXTAUTH_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/auth/signup?invitation=${token}&email=${encodeURIComponent(email)}`;

  try {
    if (resend) {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "QMS <noreply@yourdomain.com>",
        to: email,
        subject: "You've been invited to QMS",
        html: `
          <h2>You've been invited to QMS</h2>
          <p>${session.user.name || session.user.email} has invited you to join the Quality Management System as a <strong>${role || "user"}</strong>.</p>
          <p><a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Accept Invitation</a></p>
          <p>This invitation expires in 7 days.</p>
        `,
      });
    } else {
      console.log("Resend not configured — invitation email skipped. URL:", inviteUrl);
    }
  } catch (error) {
    console.error("Failed to send invitation email:", error);
    // Continue — invitation is still in DB
  }

  return NextResponse.json(
    { message: "Invitation sent successfully" },
    { status: 201 }
  );
}
