import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// PATCH /api/users/[id] — update a user's role or status (admin only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Prevent self-demotion
  if (id === session.user.id) {
    return NextResponse.json(
      { error: "You cannot modify your own account from here" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { role, status, employeeId } = body;

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (role && ["admin", "manager", "user"].includes(role)) {
    updateData.role = role;
  }
  if (status && ["active", "inactive", "pending"].includes(status)) {
    updateData.status = status;
  }
  // employeeId can be a UUID string to link, or null to unlink
  if (employeeId !== undefined) {
    updateData.employeeId = employeeId ?? null;
  }

  const [updated] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      status: users.status,
      employeeId: users.employeeId,
    });

  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/users/[id] — delete a user (admin only)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account" },
      { status: 400 }
    );
  }

  await db.delete(users).where(eq(users.id, id));

  return NextResponse.json({ message: "User deleted" });
}
