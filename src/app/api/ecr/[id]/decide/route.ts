import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { engineeringChangeRequests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { ecrDecisionSchema } from "@/lib/validations";
import { decideEcr } from "@/lib/services/product";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/ecr/[id]/decide — approve / reject / implement an ECR
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [ecr] = await db.select().from(engineeringChangeRequests).where(eq(engineeringChangeRequests.id, id)).limit(1);
    if (!ecr) return notFound();
    if (!(await hasModuleAccess(ecr.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();
    if (ecr.status === "draft") return conflict("Submit the ECR before deciding");

    const { decision, notes } = ecrDecisionSchema.parse(await req.json());
    const updated = await decideEcr(ecr.workspaceId, id, decision, notes, session.user.id);
    dispatchInline();
    return ok(updated);
  }, { route: "POST /api/ecr/[id]/decide" });
}
