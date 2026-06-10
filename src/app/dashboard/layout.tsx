import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { CommandPalette } from "@/components/dashboard/command-palette";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/auth/signin");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar user={session.user} />
      <main className="flex-1 min-h-0 overflow-y-auto bg-[var(--allgrey-background-color)] text-[var(--primary-text-color)]">
        {children}
      </main>
      <CommandPalette />
    </div>
  );
}
