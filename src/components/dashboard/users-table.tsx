"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  MoreHorizontal,
  Shield,
  ShieldCheck,
  User,
  Loader2,
  Check,
  X,
  Trash2,
  Link,
  Unlink,
} from "lucide-react";

interface UserData {
  id: string;
  name: string | null;
  email: string;
  role: "admin" | "manager" | "user";
  status: "active" | "inactive" | "pending";
  emailVerified: string | null;
  createdAt: string;
  employeeId: string | null;
}

interface EmployeeData {
  id: string;
  employeeId: string;
  name: string;
  department: string | null;
}

const roleIcons = {
  admin: Shield,
  manager: ShieldCheck,
  user: User,
};

const statusVariant = {
  active: "success" as const,
  inactive: "destructive" as const,
  pending: "warning" as const,
};

export function UsersTable() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [linkingUserId, setLinkingUserId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/employees");
      const data = await res.json();
      setEmployees(data);
    } catch (error) {
      console.error("Failed to fetch employees:", error);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchEmployees();
  }, [fetchUsers, fetchEmployees]);

  const updateUser = async (
    id: string,
    update: { role?: string; status?: string; employeeId?: string | null }
  ) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      if (res.ok) {
        await fetchUsers();
      }
    } catch (error) {
      console.error("Failed to update user:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    setActionLoading(id);
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (res.ok) {
        setUsers(users.filter((u) => u.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete user:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const linkEmployee = async (userId: string, employeeId: string | null) => {
    setLinkingUserId(null);
    await updateUser(userId, { employeeId });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-500">
          No users found.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3 text-left font-medium text-gray-500">
                User
              </th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">
                Role
              </th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">
                Employee Link
              </th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">
                Joined
              </th>
              <th className="px-6 py-3 text-right font-medium text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => {
              const RoleIcon = roleIcons[user.role];
              const isLoading = actionLoading === user.id;
              const linkedEmployee = employees.find(
                (e) => e.id === user.employeeId
              );

              return (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">
                        {user.name || "—"}
                      </p>
                      <p className="text-gray-500 text-xs">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <RoleIcon className="h-3.5 w-3.5 text-gray-400" />
                      <span className="capitalize">{user.role}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={statusVariant[user.status]}>
                      {user.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <EmployeeLinker
                      linkedEmployee={linkedEmployee}
                      employees={employees}
                      isOpen={linkingUserId === user.id}
                      onOpen={() =>
                        setLinkingUserId(
                          linkingUserId === user.id ? null : user.id
                        )
                      }
                      onClose={() => setLinkingUserId(null)}
                      onLink={(empId) => linkEmployee(user.id, empId)}
                      onUnlink={() => linkEmployee(user.id, null)}
                    />
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      ) : (
                        <>
                          {/* Quick status toggles */}
                          {user.status === "pending" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Approve"
                                onClick={() =>
                                  updateUser(user.id, { status: "active" })
                                }
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Reject"
                                onClick={() =>
                                  updateUser(user.id, { status: "inactive" })
                                }
                              >
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            </>
                          )}

                          {user.status === "active" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Deactivate"
                              onClick={() =>
                                updateUser(user.id, { status: "inactive" })
                              }
                            >
                              <X className="h-4 w-4 text-red-500" />
                            </Button>
                          )}

                          {user.status === "inactive" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Activate"
                              onClick={() =>
                                updateUser(user.id, { status: "active" })
                              }
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                          )}

                          {/* Role dropdown */}
                          <RoleMenu
                            currentRole={user.role}
                            onSelect={(role) => updateUser(user.id, { role })}
                          />

                          {/* Delete */}
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete user"
                            onClick={() => deleteUser(user.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-400 hover:text-red-600" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// Employee linker cell component
function EmployeeLinker({
  linkedEmployee,
  employees,
  isOpen,
  onOpen,
  onClose,
  onLink,
  onUnlink,
}: {
  linkedEmployee: EmployeeData | undefined;
  employees: EmployeeData[];
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onLink: (empId: string) => void;
  onUnlink: () => void;
}) {
  return (
    <div className="relative">
      {linkedEmployee ? (
        <div className="flex items-center gap-1.5">
          <span className="text-gray-800 font-medium text-xs">
            {linkedEmployee.name}
          </span>
          <span className="text-gray-400 text-xs">
            ({linkedEmployee.employeeId})
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 ml-1"
            title="Change / Unlink"
            onClick={onOpen}
          >
            <Link className="h-3 w-3 text-blue-500" />
          </Button>
        </div>
      ) : (
        <button
          onClick={onOpen}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
        >
          <Link className="h-3 w-3" />
          Link employee
        </button>
      )}

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={onClose} />
          <div className="absolute left-0 z-20 mt-1 w-64 rounded-md bg-white shadow-lg ring-1 ring-gray-200 max-h-64 overflow-y-auto">
            <div className="py-1">
              <p className="px-3 py-1.5 text-xs font-medium text-gray-400 sticky top-0 bg-white border-b border-gray-100">
                Select employee
              </p>
              {linkedEmployee && (
                <button
                  className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-1.5"
                  onClick={() => {
                    onUnlink();
                    onClose();
                  }}
                >
                  <Unlink className="h-3 w-3" />
                  Remove link
                </button>
              )}
              {employees.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-400">
                  No employees found
                </p>
              ) : (
                employees.map((emp) => (
                  <button
                    key={emp.id}
                    className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 ${
                      emp.id === linkedEmployee?.id
                        ? "text-blue-600 font-medium"
                        : "text-gray-700"
                    }`}
                    onClick={() => {
                      onLink(emp.id);
                      onClose();
                    }}
                  >
                    <span className="font-medium">{emp.name}</span>
                    <span className="text-gray-400 ml-1">
                      #{emp.employeeId}
                    </span>
                    {emp.department && (
                      <span className="text-gray-400 ml-1">
                        · {emp.department}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Simple role selector menu
function RoleMenu({
  currentRole,
  onSelect,
}: {
  currentRole: string;
  onSelect: (role: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const roles = ["admin", "manager", "user"];

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        title="Change role"
        onClick={() => setOpen(!open)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1 w-36 rounded-md bg-white shadow-lg ring-1 ring-gray-200">
            <div className="py-1">
              <p className="px-3 py-1 text-xs font-medium text-gray-400">
                Set role
              </p>
              {roles.map((role) => (
                <button
                  key={role}
                  className={`w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 capitalize ${
                    role === currentRole
                      ? "text-blue-600 font-medium"
                      : "text-gray-700"
                  }`}
                  onClick={() => {
                    onSelect(role);
                    setOpen(false);
                  }}
                >
                  {role}
                  {role === currentRole && " ✓"}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}


