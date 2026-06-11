import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { certifications } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createCertificationSchema } from "@/lib/validations";

// GET /api/certifications?workspaceId=... — certification definitions
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessTraining", session.user.role)))
      return forbidden();

    const rows = await db.select().from(certifications).where(eq(certifications.workspaceId, workspaceId)).orderBy(asc(certifications.name));
    return ok({ data: rows });
  }, { route: "GET /api/certifications" });
}

// POST /api/certifications — create a certification definition
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const input = createCertificationSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessTraining", session.user.role)))
      return forbidden();

    try {
      const [row] = await db
        .insert(certifications)
        .values({
          workspaceId: input.workspaceId,
          name: input.name,
          description: input.description || null,
          validityMonths: input.validityMonths,
          requiresCourseId: input.requiresCourseId || null,
        })
        .returning();
      return created(row);
    } catch {
      return conflict("A certification with this name already exists");
    }
  }, { route: "POST /api/certifications" });
}
