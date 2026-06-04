import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { courses, lessons } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { apiHandler, ok, noContent, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { updateCourseSchema } from "@/lib/validations";

async function load(id: string) {
  const [course] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
  return course ?? null;
}

// GET /api/courses/[id] — course with ordered lessons
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const course = await load(id);
    if (!course) return notFound();
    if (!(await hasModuleAccess(course.workspaceId, session.user.id, "canAccessTraining", session.user.role)))
      return forbidden();

    const lessonRows = await db.select().from(lessons).where(eq(lessons.courseId, id)).orderBy(asc(lessons.position));
    return ok({ ...course, lessons: lessonRows });
  }, { route: "GET /api/courses/[id]" });
}

// PATCH /api/courses/[id] — edit / publish
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const course = await load(id);
    if (!course) return notFound();
    if (!(await hasModuleAccess(course.workspaceId, session.user.id, "canAccessTraining", session.user.role)))
      return forbidden();

    const patch = updateCourseSchema.parse(await req.json());
    const [updated] = await db
      .update(courses)
      .set({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.isPublished !== undefined ? { isPublished: patch.isPublished } : {}),
        updatedAt: new Date(),
      })
      .where(eq(courses.id, id))
      .returning();
    return ok(updated);
  }, { route: "PATCH /api/courses/[id]" });
}

// DELETE /api/courses/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const course = await load(id);
    if (!course) return notFound();
    if (!(await hasModuleAccess(course.workspaceId, session.user.id, "canAccessTraining", session.user.role)))
      return forbidden();

    await db.delete(courses).where(eq(courses.id, id));
    return noContent();
  }, { route: "DELETE /api/courses/[id]" });
}
