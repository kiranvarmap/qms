import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { count, eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, UserX, Clock } from "lucide-react";
import { BizOpsWidgets } from "@/components/dashboard/biz-ops-widgets";

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
        <h1 className="text-2xl font-bold text-gray-900">Home</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome back, {session?.user.name || session?.user.email}
        </p>
      </div>

      <BizOpsWidgets />

      {isAdmin && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Total Users
              </CardTitle>
              <Users className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Active
              </CardTitle>
              <UserCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {stats.active}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Pending
              </CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">
                {stats.pending}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Inactive
              </CardTitle>
              <UserX className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
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
