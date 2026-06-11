import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  products,
  customers,
  vendors,
  assets,
  boards,
  employees,
  invoices,
  estimates,
  salesOrders,
  purchaseOrders,
  workOrders,
  maintenanceOrders,
  inspections,
} from "@/lib/db/schema";
import { and, eq, ilike, or } from "drizzle-orm";
import { apiHandler, ok, unauthorized, badRequest, forbidden } from "@/lib/api";
import { getMembership } from "@/lib/services/access";
import { likePattern } from "@/lib/services/list-query";

export interface SearchHit {
  type: string;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}

// GET /api/search?workspaceId=&q= — global ⌘K search across masters and
// documents (audit P12: search did not exist in any form). Categories are
// gated by the caller's module flags so results never leak modules the user
// can't open.
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    const q = url.searchParams.get("q")?.trim();
    if (!workspaceId) return badRequest("workspaceId required");
    if (!q || q.length < 2) return ok({ hits: [] });

    const m = await getMembership(workspaceId, session.user.id);
    const globalAdmin = session.user.role === "admin";
    if (!m && !globalAdmin) return forbidden();
    const wsAdmin = globalAdmin || m?.role === "owner" || m?.role === "admin";
    const can = (flag: keyof NonNullable<typeof m>) => wsAdmin || Boolean(m?.[flag]);

    const pat = likePattern(q);
    const hits: SearchHit[] = [];
    const LIMIT = 5;

    // Work OS — boards are visible to every member.
    const boardRows = await db
      .select({ id: boards.id, name: boards.name })
      .from(boards)
      .where(and(eq(boards.workspaceId, workspaceId), ilike(boards.name, pat)))
      .limit(LIMIT);
    hits.push(...boardRows.map((b) => ({ type: "Board", id: b.id, title: b.name, subtitle: null, href: `/dashboard/boards/${b.id}` })));

    if (can("canAccessInventory")) {
      const rows = await db
        .select({ id: products.id, name: products.name, sku: products.sku })
        .from(products)
        .where(and(eq(products.workspaceId, workspaceId), or(ilike(products.name, pat), ilike(products.sku, pat))!))
        .limit(LIMIT);
      hits.push(...rows.map((r) => ({ type: "Product", id: r.id, title: r.name, subtitle: r.sku, href: `/dashboard/products/${r.id}` })));

      const assetRows = await db
        .select({ id: assets.id, name: assets.name, code: assets.code })
        .from(assets)
        .where(and(eq(assets.workspaceId, workspaceId), or(ilike(assets.name, pat), ilike(assets.code, pat))!))
        .limit(LIMIT);
      hits.push(...assetRows.map((r) => ({ type: "Asset", id: r.id, title: r.name, subtitle: r.code, href: `/dashboard/maintenance/assets/${r.id}` })));

      const woRows = await db
        .select({ id: workOrders.id, number: workOrders.number })
        .from(workOrders)
        .where(and(eq(workOrders.workspaceId, workspaceId), ilike(workOrders.number, pat)))
        .limit(LIMIT);
      hits.push(...woRows.map((r) => ({ type: "Work order", id: r.id, title: r.number, subtitle: null, href: `/dashboard/production/${r.id}` })));

      const moRows = await db
        .select({ id: maintenanceOrders.id, number: maintenanceOrders.number })
        .from(maintenanceOrders)
        .where(and(eq(maintenanceOrders.workspaceId, workspaceId), ilike(maintenanceOrders.number, pat)))
        .limit(LIMIT);
      hits.push(...moRows.map((r) => ({ type: "Maintenance", id: r.id, title: r.number, subtitle: null, href: `/dashboard/maintenance` })));
    }

    if (can("canAccessInvoicing")) {
      const custRows = await db
        .select({ id: customers.id, name: customers.name })
        .from(customers)
        .where(and(eq(customers.workspaceId, workspaceId), ilike(customers.name, pat)))
        .limit(LIMIT);
      hits.push(...custRows.map((r) => ({ type: "Customer", id: r.id, title: r.name, subtitle: null, href: `/dashboard/customers/${r.id}` })));

      const invRows = await db
        .select({ id: invoices.id, docNumber: invoices.docNumber, status: invoices.status })
        .from(invoices)
        .where(and(eq(invoices.workspaceId, workspaceId), ilike(invoices.docNumber, pat)))
        .limit(LIMIT);
      hits.push(...invRows.map((r) => ({ type: "Invoice", id: r.id, title: r.docNumber, subtitle: r.status, href: `/dashboard/invoices/${r.id}` })));

      const estRows = await db
        .select({ id: estimates.id, docNumber: estimates.docNumber, status: estimates.status })
        .from(estimates)
        .where(and(eq(estimates.workspaceId, workspaceId), ilike(estimates.docNumber, pat)))
        .limit(LIMIT);
      hits.push(...estRows.map((r) => ({ type: "Estimate", id: r.id, title: r.docNumber, subtitle: r.status, href: `/dashboard/estimates/${r.id}` })));

      const soRows = await db
        .select({ id: salesOrders.id, docNumber: salesOrders.docNumber, status: salesOrders.status })
        .from(salesOrders)
        .where(and(eq(salesOrders.workspaceId, workspaceId), ilike(salesOrders.docNumber, pat)))
        .limit(LIMIT);
      hits.push(...soRows.map((r) => ({ type: "Sales order", id: r.id, title: r.docNumber, subtitle: r.status, href: `/dashboard/sales-orders/${r.id}` })));
    }

    if (can("canAccessVendors")) {
      const rows = await db
        .select({ id: vendors.id, name: vendors.name, code: vendors.code })
        .from(vendors)
        .where(and(eq(vendors.workspaceId, workspaceId), or(ilike(vendors.name, pat), ilike(vendors.code, pat))!))
        .limit(LIMIT);
      hits.push(...rows.map((r) => ({ type: "Vendor", id: r.id, title: r.name, subtitle: r.code, href: `/dashboard/vendors/${r.id}` })));
    }

    if (can("canAccessPurchasing")) {
      const rows = await db
        .select({ id: purchaseOrders.id, docNumber: purchaseOrders.docNumber, status: purchaseOrders.status })
        .from(purchaseOrders)
        .where(and(eq(purchaseOrders.workspaceId, workspaceId), ilike(purchaseOrders.docNumber, pat)))
        .limit(LIMIT);
      hits.push(...rows.map((r) => ({ type: "Purchase order", id: r.id, title: r.docNumber, subtitle: r.status, href: `/dashboard/purchase-orders/${r.id}` })));
    }

    if (can("canAccessHR")) {
      const rows = await db
        .select({ id: employees.id, name: employees.name, badge: employees.employeeId })
        .from(employees)
        .where(and(eq(employees.workspaceId, workspaceId), ilike(employees.name, pat)))
        .limit(LIMIT);
      hits.push(...rows.map((r) => ({ type: "Employee", id: r.id, title: r.name, subtitle: r.badge, href: `/dashboard/employees/${r.id}` })));
    }

    if (can("canAccessInspections")) {
      const rows = await db
        .select({ id: inspections.id, title: inspections.title, status: inspections.status })
        .from(inspections)
        .where(and(eq(inspections.workspaceId, workspaceId), ilike(inspections.title, pat)))
        .limit(LIMIT);
      hits.push(...rows.map((r) => ({ type: "Inspection", id: r.id, title: r.title, subtitle: r.status, href: `/dashboard/inspections/${r.id}` })));
    }

    return ok({ hits: hits.slice(0, 40) });
  }, { route: "GET /api/search" });
}
