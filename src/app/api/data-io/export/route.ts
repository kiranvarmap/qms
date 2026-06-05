import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { getEntity } from "@/lib/services/data-io/registry";
import { formatCell } from "@/lib/services/data-io/codec";
import { toCsv } from "@/lib/services/data-io/csv";

// GET /api/data-io/export?entity=<slug>&workspaceId=<id> → CSV download
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return unauthorized();

  const url = new URL(req.url);
  const slug = url.searchParams.get("entity") ?? "";
  const workspaceId = url.searchParams.get("workspaceId") ?? "";
  if (!workspaceId) return badRequest("workspaceId required");

  const entity = getEntity(slug);
  if (!entity) return badRequest(`Unknown entity "${slug}"`);
  if (!(await hasModuleAccess(workspaceId, session.user.id, entity.accessFlag, session.user.role)))
    return forbidden();

  const rows = await db.select().from(entity.table).where(eq(entity.table.workspaceId, workspaceId));

  const headers = entity.fields.map((f) => f.header);
  const data = (rows as Record<string, unknown>[]).map((row) =>
    entity.fields.map((f) => formatCell(f, row[f.field]))
  );

  const csv = "﻿" + toCsv(headers, data); // BOM for Excel
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${entity.slug}-${stamp}.csv"`,
    },
  });
}
