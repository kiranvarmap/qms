import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { courses, lessons } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { apiHandler, created, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createLessonSchema } from "@/lib/validations";

// POST /api/courses/[id]/lessons — append a lesson to a course
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [course] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
    if (!course) return notFound();
    if (!(await hasModuleAccess(course.workspaceId, session.user.id, "canAccessTraining", session.user.role)))
      return forbidden();

    const input = createLessonSchema.parse(await req.json());
    const [{ max }] = await db
      .select({ max: sql<number>`coalesce(max(${lessons.position}), -1)` })
      .from(lessons)
      .where(eq(lessons.courseId, id));

    const [row] = await db
      .insert(lessons)
      .values({
        courseId: id,
        title: input.title,
        contentType: input.contentType,
        contentText: input.contentText || null,
        contentUrl: input.contentUrl || null,
        sopId: input.sopId || null,
        position: Number(max) + 1,
      })
      .returning();
    return created(row);
  }, { route: "POST /api/courses/[id]/lessons" });
}
