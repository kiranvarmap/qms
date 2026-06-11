import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { certificationRecords, certifications, employees } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";

// GET /api/certification-records?workspaceId=...&employeeId=&status= — register
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessTraining", session.user.role)))
      return forbidden();

    const conds = [eq(certificationRecords.workspaceId, workspaceId)];
    const employeeId = url.searchParams.get("employeeId");
    if (employeeId) conds.push(eq(certificationRecords.employeeId, employeeId));
    const status = url.searchParams.get("status");
    if (status) conds.push(eq(certificationRecords.status, status as typeof certificationRecords.$inferSelect.status));

    const rows = await db
      .select({
        id: certificationRecords.id,
        employeeId: certificationRecords.employeeId,
        employeeName: employees.name,
        certificationId: certificationRecords.certificationId,
        certificationName: certifications.name,
        issuedAt: certificationRecords.issuedAt,
        expiresAt: certificationRecords.expiresAt,
        status: certificationRecords.status,
      })
      .from(certificationRecords)
      .leftJoin(certifications, eq(certifications.id, certificationRecords.certificationId))
      .leftJoin(employees, eq(employees.id, certificationRecords.employeeId))
      .where(and(...conds))
      .orderBy(desc(certificationRecords.issuedAt));
    return ok({ data: rows });
  }, { route: "GET /api/certification-records" });
}
