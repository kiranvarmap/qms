import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { count, eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Group as Users, PersonRound as UserCheck, Remove as UserX, Time as Clock } from "@vibe/icons";
import { BizOpsWidgets } from "@/components/dashboard/biz-ops-widgets";
import { ModuleLauncher } from "@/components/dashboard/module-launcher";

export default async function DashboardPage() {
  const session = await auth();
  const isAdmin = session?.user.role === "admin";

  // Get user counts (admin only)
  let stats = { total: 0, active: 0, inactive: 0, pending: 0 };
  if (isAdmin) {
    const [total] = await db.select({ count: count() }).from(users);
    const [active] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.status, "active"));
    const [inactive] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.status, "inactive"));
    const [pending] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.status, "pending"));

    stats = {
      total: total.count,
      active: active.count,
      inactive: inactive.count,
      pending: pending.count,
    };
  }

  return (
    <div className="px-8 py-6 space-y-8">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-gray-900 [font-family:var(--font-display)]">
          Home
        </h1>
        <p className="mt-1 text-[15px] text-gray-500">
          Welcome back, {session?.user.name || session?.user.email}
        </p>
      </div>

      <BizOpsWidgets />

      <div>
        <h2 className="text-[15px] font-semibold text-gray-800 mb-3">Quick access</h2>
        <ModuleLauncher role={session?.user.role} />
      </div>

      {isAdmin && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="hover:shadow-[var(--box-shadow-small)] hover:-translate-y-0.5 transition-all duration-150">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Total Users
              </CardTitle>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-primary">
                <Users className="h-4 w-4" />
              </span>
            </CardHeader>
            <CardContent>
              <div className="text-[30px] font-bold tracking-tight">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-[var(--box-shadow-small)] hover:-translate-y-0.5 transition-all duration-150">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Active
              </CardTitle>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-positive">
                <UserCheck className="h-4 w-4" />
              </span>
            </CardHeader>
            <CardContent>
              <div className="text-[30px] font-bold tracking-tight text-positive">
                {stats.active}
              </div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-[var(--box-shadow-small)] hover:-translate-y-0.5 transition-all duration-150">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Pending
              </CardTitle>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                <Clock className="h-4 w-4" />
              </span>
            </CardHeader>
            <CardContent>
              <div className="text-[30px] font-bold tracking-tight text-orange-600">
                {stats.pending}
              </div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-[var(--box-shadow-small)] hover:-translate-y-0.5 transition-all duration-150">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Inactive
              </CardTitle>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-negative">
                <UserX className="h-4 w-4" />
              </span>
            </CardHeader>
            <CardContent>
              <div className="text-[30px] font-bold tracking-tight text-negative">
                {stats.inactive}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!isAdmin && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-gray-600">
              Your QMS dashboard will show quality management and product
              management modules here. Stay tuned for upcoming features!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
