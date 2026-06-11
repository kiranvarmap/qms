import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { getEntity } from "@/lib/services/data-io/registry";
import { parseCell } from "@/lib/services/data-io/codec";
import { parseCsv } from "@/lib/services/data-io/csv";

// POST /api/data-io/import  { entity, workspaceId, csv }
// Upserts rows by the entity's key column. Returns a per-row summary.
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const body = await req.json().catch(() => ({}));
    const slug = String(body.entity ?? "");
    const workspaceId = String(body.workspaceId ?? "");
    const csv = String(body.csv ?? "");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!csv.trim()) return badRequest("Empty file");

    const entity = getEntity(slug);
    if (!entity) return badRequest(`Unknown entity "${slug}"`);
    if (!entity.importable) return badRequest(`"${entity.label}" does not support import`);
    if (!(await hasModuleAccess(workspaceId, session.user.id, entity.accessFlag, session.user.role)))
      return forbidden();

    const keyDef = entity.fields.find((f) => f.field === entity.keyField);
    const records = parseCsv(csv);
    if (records.length === 0) return badRequest("No data rows found");

    let created = 0, updated = 0;
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < records.length; i++) {
      const rowNo = i + 2; // +1 header, +1 to 1-based
      const rec = records[i];
      try {
        const vals: Record<string, unknown> = {};
        for (const f of entity.fields) {
          if (f.importable === false) continue;
          if (!(f.header in rec)) continue;
          const v = parseCell(f, rec[f.header]);
          if (f.required && (v === null || v === "")) throw new Error(`"${f.header}" is required`);
          vals[f.field] = v;
        }
        // Validate required fields that were absent from the header entirely.
        for (const f of entity.fields) {
          if (f.required && f.importable !== false && !(f.field in vals)) throw new Error(`Missing column "${f.header}"`);
        }

        const keyVal = keyDef ? vals[entity.keyField] : null;
        let existing: { id: string }[] = [];
        if (keyVal !== null && keyVal !== undefined && keyVal !== "") {
          existing = await db
            .select({ id: entity.table.id })
            .from(entity.table)
            .where(and(eq(entity.table.workspaceId, workspaceId), eq(entity.table[entity.keyField], keyVal)))
            .limit(1);
        }

        if (existing.length > 0) {
          await db.update(entity.table).set({ ...vals }).where(eq(entity.table.id, existing[0].id));
          updated++;
        } else {
          const insertVals = { ...(entity.insertDerive?.(vals) ?? {}), ...vals, workspaceId };
          await db.insert(entity.table).values(insertVals);
          created++;
        }
      } catch (err) {
        errors.push({ row: rowNo, message: err instanceof Error ? err.message : "Invalid row" });
      }
    }

    return ok({ entity: entity.slug, total: records.length, created, updated, failed: errors.length, errors: errors.slice(0, 50) });
  }, { route: "POST /api/data-io/import" });
}
