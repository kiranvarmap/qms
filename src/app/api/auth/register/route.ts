import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { registerSchema } from "@/lib/validations";
import { created, conflict, serverError, validationError } from "@/lib/api";
import { logger } from "@/lib/logger";
import { ZodError } from "zod";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password } = registerSchema.parse(body);

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) return conflict("An account with this email already exists");

    const hashedPassword = await bcrypt.hash(password, 12);

    // First registered user becomes admin (auto-active); all others need approval
    const [firstUser] = await db.select({ id: users.id }).from(users).limit(1);
    const isFirst = !firstUser;

    const [newUser] = await db
      .insert(users)
      .values({
        name,
        email,
        password:      hashedPassword,
        role:          isFirst ? "admin" : "user",
        status:        isFirst ? "active" : "pending",
        emailVerified: isFirst ? new Date() : null,
      })
      .returning({ id: users.id, name: users.name, email: users.email, role: users.role, status: users.status });

    logger.info("User registered", { userId: newUser.id, isFirst });

    return created({
      message: isFirst
        ? "Admin account created. You can now sign in."
        : "Account created. Please wait for admin approval or use a magic link to verify your email.",
      user: newUser,
    });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    logger.error("Registration error", { error: String(err) });
    return serverError("Something went wrong. Please try again.");
  }
}
