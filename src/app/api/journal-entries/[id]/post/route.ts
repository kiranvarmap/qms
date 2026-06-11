import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { journalEntries, journalLines } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";

// POST /api/journal-entries/[id]/post — finalize a draft manual journal
// (audit 02 §5: `posted` was unreachable; drafts could be silently edited
// forever). Validates the lines still balance before sealing.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [je] = await db.select().from(journalEntries).where(eq(journalEntries.id, id)).limit(1);
    if (!je) return notFound();
    if (!(await hasModuleAccess(je.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();
    if (je.status === "posted") return ok({ id, status: "posted" }); // idempotent
    if (je.status !== "draft") return conflict(`Cannot post a journal entry in status "${je.status}"`);

    const [sums] = await db
      .select({
        debits: sql<number>`coalesce(sum(${journalLines.debitMinor}), 0)`,
        credits: sql<number>`coalesce(sum(${journalLines.creditMinor}), 0)`,
      })
      .from(journalLines)
      .where(eq(journalLines.journalEntryId, id));
    if (Number(sums.debits) === 0 || Number(sums.debits) !== Number(sums.credits))
      return conflict("Journal entry does not balance (debits must equal credits and be non-zero)");

    const [updated] = await db
      .update(journalEntries)
      .set({ status: "posted", postedAt: new Date() })
      .where(eq(journalEntries.id, id))
      .returning();

    return ok(updated);
  }, { route: "POST /api/journal-entries/[id]/post" });
}
