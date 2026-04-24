import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UsersTable } from "@/components/dashboard/users-table";
import { InviteUserDialog } from "@/components/dashboard/invite-user-dialog";

export default async function UsersPage() {
  const session = await auth();

  if (session?.user.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="px-8 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage users, roles, and permissions
          </p>
        </div>
        <InviteUserDialog />
      </div>
      <UsersTable />
    </div>
  );
}
