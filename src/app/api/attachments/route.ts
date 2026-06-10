import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { attachments } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { getMembership } from "@/lib/services/access";
import { createAttachmentSchema } from "@/lib/validations";

async function memberOrAdmin(workspaceId: string, userId: string, role: string) {
  if (role === "admin") return true;
  return Boolean(await getMembership(workspaceId, userId));
}

// GET /api/attachments?workspaceId=&refType=&refId= — files on a record
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    const refType = url.searchParams.get("refType");
    const refId = url.searchParams.get("refId");
    if (!workspaceId || !refType || !refId) return badRequest("workspaceId, refType and refId required");
    if (!(await memberOrAdmin(workspaceId, session.user.id, session.user.role))) return forbidden();

    const rows = await db
      .select()
      .from(attachments)
      .where(and(eq(attachments.workspaceId, workspaceId), eq(attachments.refType, refType), eq(attachments.refId, refId)))
      .orderBy(desc(attachments.createdAt));
    return ok({ data: rows });
  }, { route: "GET /api/attachments" });
}

// POST /api/attachments — register an uploaded file against a record
// (binary goes through /api/upload first; this stores the registry row).
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const input = createAttachmentSchema.parse(await req.json());
    if (!(await memberOrAdmin(input.workspaceId, session.user.id, session.user.role))) return forbidden();

    const [row] = await db
      .insert(attachments)
      .values({
        workspaceId: input.workspaceId,
        refType: input.refType,
        refId: input.refId,
        fileName: input.fileName,
        fileKey: input.fileKey,
        fileUrl: input.fileUrl ?? null,
        fileSize: input.fileSize ?? 0,
        contentType: input.contentType ?? null,
        uploadedBy: session.user.id,
      })
      .returning();
    return created(row);
  }, { route: "POST /api/attachments" });
}
