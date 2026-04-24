import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { employees } from "@/lib/db/schema";
import { eq, ilike, or, desc } from "drizzle-orm";

// GET /api/employees — list all employees
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const status = searchParams.get("status");

  let query = db.select().from(employees);

  if (q) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (query as any) = (query as any).where(
      or(
        ilike(employees.name, `%${q}%`),
        ilike(employees.employeeId, `%${q}%`),
        ilike(employees.department, `%${q}%`)
      )
    );
  }

  if (status) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (query as any) = (query as any).where(eq(employees.status, status as "active" | "inactive" | "on_leave"));
  }

  const rows = await db
    .select()
    .from(employees)
    .orderBy(desc(employees.createdAt));

  return NextResponse.json(rows);
}

// POST /api/employees — create employee
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { employeeId, name, email, phone, department, designation, joiningDate, avatarUrl } = body;

  if (!employeeId || !name) {
    return NextResponse.json({ error: "employeeId and name are required" }, { status: 400 });
  }

  // Check duplicate employeeId
  const existing = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.employeeId, employeeId));

  if (existing.length > 0) {
    return NextResponse.json({ error: "Employee ID already exists" }, { status: 409 });
  }

  const [emp] = await db
    .insert(employees)
    .values({
      employeeId,
      name,
      email: email || null,
      phone: phone || null,
      department: department || null,
      designation: designation || null,
      joiningDate: joiningDate ? new Date(joiningDate) : null,
      avatarUrl: avatarUrl || null,
    })
    .returning();

  return NextResponse.json(emp, { status: 201 });
}
