import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { courses } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createCourseSchema } from "@/lib/validations";

// GET /api/courses?workspaceId=...&published=true — list courses
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessTraining", session.user.role)))
      return forbidden();

    const conds = [eq(courses.workspaceId, workspaceId)];
    if (url.searchParams.get("published") === "true") conds.push(eq(courses.isPublished, true));

    const rows = await db.select().from(courses).where(and(...conds)).orderBy(desc(courses.createdAt));
    return ok({ data: rows });
  }, { route: "GET /api/courses" });
}

// POST /api/courses — create a course (draft / unpublished)
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const input = createCourseSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessTraining", session.user.role)))
      return forbidden();

    const [row] = await db
      .insert(courses)
      .values({
        workspaceId: input.workspaceId,
        title: input.title,
        description: input.description || null,
        category: input.category || null,
        createdBy: session.user.id,
      })
      .returning();
    return created(row);
  }, { route: "POST /api/courses" });
}
