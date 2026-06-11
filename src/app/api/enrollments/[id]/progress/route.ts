import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { enrollments, lessons, lessonProgress } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, badRequest } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { lessonProgressSchema } from "@/lib/validations";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/enrollments/[id]/progress { lessonId } — mark a lesson complete,
// recompute progress, and complete the course at 100% (→ course.completed,
// which the certification consumer turns into a certification_record).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [enr] = await db.select().from(enrollments).where(eq(enrollments.id, id)).limit(1);
    if (!enr) return notFound();
    if (!(await hasModuleAccess(enr.workspaceId, session.user.id, "canAccessTraining", session.user.role)))
      return forbidden();
    if (enr.status === "completed") return ok({ id, status: "completed", progressPct: 100 });

    const { lessonId } = lessonProgressSchema.parse(await req.json());
    const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
    if (!lesson || lesson.courseId !== enr.courseId) return badRequest("Lesson is not part of this course");

    const result = await db.transaction(async (tx) => {
      await tx.insert(lessonProgress).values({ enrollmentId: id, lessonId }).onConflictDoNothing();

      const courseLessons = await tx.select({ id: lessons.id }).from(lessons).where(eq(lessons.courseId, enr.courseId));
      const done = await tx.select({ id: lessonProgress.id }).from(lessonProgress).where(eq(lessonProgress.enrollmentId, id));
      const total = courseLessons.length || 1;
      const pct = Math.min(100, Math.round((done.length / total) * 100));
      const completed = pct >= 100;

      await tx
        .update(enrollments)
        .set({
          progressPct: pct,
          status: completed ? "completed" : "in_progress",
          completedAt: completed ? new Date() : null,
        })
        .where(eq(enrollments.id, id));

      if (completed) {
        await emitEvent(tx, {
          workspaceId: enr.workspaceId,
          eventType: "course.completed",
          aggregateType: "course",
          aggregateId: enr.courseId,
          actorUserId: session.user.id,
          payload: { employeeId: enr.employeeId, enrollmentId: id },
        });
      }
      return { pct, completed };
    });

    dispatchInline();
    return ok({ id, status: result.completed ? "completed" : "in_progress", progressPct: result.pct });
  }, { route: "POST /api/enrollments/[id]/progress" });
}
