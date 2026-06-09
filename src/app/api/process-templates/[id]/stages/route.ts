import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { processTemplates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, created, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { processStageSchema } from "@/lib/validations";
import { addStage } from "@/lib/services/production-planning";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [row] = await db.select().from(processTemplates).where(eq(processTemplates.id, id)).limit(1);
    if (!row) return notFound();
    if (!(await hasModuleAccess(row.workspaceId, session.user.id, "canAccessInventory", session.user.role))) return forbidden();
    const input = processStageSchema.parse(await req.json());
    return created(await addStage(row.workspaceId, id, input));
  }, { route: "POST /api/process-templates/[id]/stages" });
}
