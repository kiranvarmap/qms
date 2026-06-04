import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { enrollments, courses, employees } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createEnrollmentSchema } from "@/lib/validations";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

// GET /api/enrollments?workspaceId=...&courseId=&employeeId= — list enrollments
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessTraining", session.user.role)))
      return forbidden();

    const conds = [eq(enrollments.workspaceId, workspaceId)];
    const courseId = url.searchParams.get("courseId");
    if (courseId) conds.push(eq(enrollments.courseId, courseId));
    const employeeId = url.searchParams.get("employeeId");
    if (employeeId) conds.push(eq(enrollments.employeeId, employeeId));

    const rows = await db
      .select({
        id: enrollments.id,
        courseId: enrollments.courseId,
        courseTitle: courses.title,
        employeeId: enrollments.employeeId,
        employeeName: employees.name,
        status: enrollments.status,
        progressPct: enrollments.progressPct,
        dueDate: enrollments.dueDate,
        completedAt: enrollments.completedAt,
      })
      .from(enrollments)
      .leftJoin(courses, eq(courses.id, enrollments.courseId))
      .leftJoin(employees, eq(employees.id, enrollments.employeeId))
      .where(and(...conds))
      .orderBy(desc(enrollments.assignedAt));
    return ok({ data: rows });
  }, { route: "GET /api/enrollments" });
}

// POST /api/enrollments — assign an employee to a course
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const input = createEnrollmentSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessTraining", session.user.role)))
      return forbidden();

    const [course] = await db.select().from(courses).where(eq(courses.id, input.courseId)).limit(1);
    if (!course || course.workspaceId !== input.workspaceId) return badRequest("Invalid course");
    const [emp] = await db.select().from(employees).where(eq(employees.id, input.employeeId)).limit(1);
    if (!emp || emp.workspaceId !== input.workspaceId) return badRequest("Invalid employee");

    const [existing] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(eq(enrollments.courseId, input.courseId), eq(enrollments.employeeId, input.employeeId)))
      .limit(1);
    if (existing) return conflict("Employee is already enrolled in this course");

    const enrollment = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(enrollments)
        .values({
          workspaceId: input.workspaceId,
          courseId: input.courseId,
          employeeId: input.employeeId,
          status: "enrolled",
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
        })
        .returning();
      await emitEvent(tx, {
        workspaceId: input.workspaceId,
        eventType: "course.assigned",
        aggregateType: "enrollment",
        aggregateId: row.id,
        actorUserId: session.user.id,
        payload: { courseId: input.courseId, employeeId: input.employeeId },
      });
      return row;
    });

    dispatchInline();
    return created(enrollment);
  }, { route: "POST /api/enrollments" });
}
