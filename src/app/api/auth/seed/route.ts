import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  // Dev-only bootstrap: creates a known admin account. Never allowed where
  // real data lives — requires non-production AND an explicit opt-in flag.
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEV_SEED !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const email = "hello@test.com";
  const password = "Test@1234";
  const name = "Admin";

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    // Update password in case it changed
    const hashed = await bcrypt.hash(password, 12);
    await db
      .update(users)
      .set({ password: hashed, status: "active", role: "admin" })
      .where(eq(users.id, existing.id));
    return NextResponse.json({ message: "User updated", email });
  }

  const hashed = await bcrypt.hash(password, 12);
  await db.insert(users).values({
    name,
    email,
    password: hashed,
    role: "admin",
    status: "active",
    emailVerified: new Date(),
  });

  return NextResponse.json({ message: "User created", email });
}
