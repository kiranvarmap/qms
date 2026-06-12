"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

function handleSignOut() {
  signOut({ callbackUrl: "/auth/signin" });
}
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dashboard as LayoutDashboard, Group as Users, PersonRound as UserCircle, LogOut, Locked as Shield, Menu, CloseSmall as X, Folder as FolderKanban } from "@vibe/icons";
import { useState } from "react";

interface NavProps {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string;
  };
}

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Workspaces",
    href: "/dashboard/workspaces",
    icon: FolderKanban,
  },
  {
    name: "Users",
    href: "/dashboard/users",
    icon: Users,
    roles: ["admin"],
  },
  {
    name: "Profile",
    href: "/dashboard/profile",
    icon: UserCircle,
  },
];

export function DashboardNav({ user }: NavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const filteredNav = navigation.filter(
    (item) => !item.roles || item.roles.includes(user.role || "")
  );

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          {/* Logo + Nav */}
          <div className="flex">
            <div className="flex flex-shrink-0 items-center">
              <Link href="/dashboard" className="flex items-center gap-2">
                <Shield className="h-7 w-7 text-blue-600" />
                <span className="font-bold text-lg text-gray-900">QMS</span>
              </Link>
            </div>
            <div className="hidden sm:ml-8 sm:flex sm:space-x-1">
              {filteredNav.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* User Info + Sign Out */}
          <div className="hidden sm:flex sm:items-center sm:gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {user.name || user.email}
              </p>
              <p className="text-xs text-gray-500 capitalize">{user.role}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center sm:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-gray-200">
          <div className="space-y-1 px-4 py-3">
            {filteredNav.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" &&
                  pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md",
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>
          <div className="border-t border-gray-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {user.name || user.email}
                </p>
                <p className="text-xs text-gray-500 capitalize">{user.role}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4 mr-1" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
