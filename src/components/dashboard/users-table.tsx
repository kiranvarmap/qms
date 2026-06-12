"use client";
import { useConfirm } from "@/components/ui";

import { useEffect, useState, useCallback } from "react";
import {
  IconButton,
  Label as VibeLabel,
  Loader,
  Menu,
  MenuButton,
  MenuItem,
  MenuTitle,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@vibe/core";
import { Check, CloseSmall, Delete } from "@vibe/icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Locked as Shield, Security as ShieldCheck, Person as User, Link, CloseRound as Unlink } from "@vibe/icons";

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

const columns = [
  { id: "user", title: "User" },
  { id: "role", title: "Role", width: 130 },
  { id: "status", title: "Status", width: 110 },
  { id: "employee", title: "Employee Link", width: 190 },
  { id: "joined", title: "Joined", width: 120 },
  { id: "actions", title: "", width: 90 },
];

export function UsersTable() {
  const confirmAction = useConfirm();
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
    if (!(await confirmAction("Are you sure you want to delete this user?"))) return;

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
        <Loader size="small" />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-text-secondary">
          No users found.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-visible">
      <div className="overflow-x-auto rounded-lg">
        <Table
          columns={columns}
          emptyState={<div />}
          errorState={<div />}
          style={{ width: "100%" }}
        >
          <TableHeader>
            {columns.map((col) => (
              <TableHeaderCell key={col.id} title={col.title} />
            ))}
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const RoleIcon = roleIcons[user.role];
              const isLoading = actionLoading === user.id;
              const linkedEmployee = employees.find(
                (e) => e.id === user.employeeId
              );

              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-text-primary">
                        {user.name || "—"}
                      </p>
                      <p className="text-text-secondary text-xs">
                        {user.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <RoleIcon className="h-3.5 w-3.5 text-gray-400" />
                      <span className="capitalize">{user.role}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.status === "active" && (
                      <VibeLabel text="Active" color="positive" />
                    )}
                    {user.status === "inactive" && (
                      <VibeLabel text="Inactive" color="negative" />
                    )}
                    {user.status === "pending" && (
                      <Badge variant="warning">pending</Badge>
                    )}
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell>
                    <span className="text-text-secondary">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {isLoading ? (
                        <Loader size="xs" />
                      ) : (
                        <>
                          {user.status === "pending" && (
                            <>
                              <IconButton
                                icon={Check}
                                size="xs"
                                aria-label="Approve"
                                onClick={() =>
                                  updateUser(user.id, { status: "active" })
                                }
                              />
                              <IconButton
                                icon={CloseSmall}
                                size="xs"
                                aria-label="Reject"
                                onClick={() =>
                                  updateUser(user.id, { status: "inactive" })
                                }
                              />
                            </>
                          )}

                          {user.status === "active" && (
                            <IconButton
                              icon={CloseSmall}
                              size="xs"
                              aria-label="Deactivate"
                              onClick={() =>
                                updateUser(user.id, { status: "inactive" })
                              }
                            />
                          )}

                          {user.status === "inactive" && (
                            <IconButton
                              icon={Check}
                              size="xs"
                              aria-label="Activate"
                              onClick={() =>
                                updateUser(user.id, { status: "active" })
                              }
                            />
                          )}

                          <MenuButton size="xs" aria-label="Change role">
                            <Menu id={`role-menu-${user.id}`} size="medium">
                              <MenuTitle caption="Set role" />
                              {(["admin", "manager", "user"] as const).map(
                                (role) => (
                                  <MenuItem
                                    key={role}
                                    title={
                                      role.charAt(0).toUpperCase() +
                                      role.slice(1) +
                                      (role === user.role ? " ✓" : "")
                                    }
                                    onClick={() =>
                                      updateUser(user.id, { role })
                                    }
                                  />
                                )
                              )}
                            </Menu>
                          </MenuButton>

                          <IconButton
                            icon={Delete}
                            size="xs"
                            aria-label="Delete user"
                            onClick={() => deleteUser(user.id)}
                          />
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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
          <span className="text-text-primary font-medium text-xs">
            {linkedEmployee.name}
          </span>
          <span className="text-gray-400 text-xs">
            ({linkedEmployee.employeeId})
          </span>
          <button
            className="p-0.5 rounded hover:bg-gray-100 transition-colors"
            title="Change / Unlink"
            onClick={onOpen}
          >
            <Link className="h-3 w-3 text-primary" />
          </button>
        </div>
      ) : (
        <button
          onClick={onOpen}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary transition-colors"
        >
          <Link className="h-3 w-3" />
          Link employee
        </button>
      )}

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={onClose} />
          <div className="absolute left-0 z-20 mt-1 w-64 rounded-lg bg-white shadow-lg ring-1 ring-gray-200 max-h-64 overflow-y-auto">
            <div className="py-1">
              <p className="px-3 py-1.5 text-xs font-medium text-gray-400 sticky top-0 bg-white border-b border-gray-100">
                Select employee
              </p>
              {linkedEmployee && (
                <button
                  className="w-full px-3 py-1.5 text-left text-xs text-negative hover:bg-red-50 flex items-center gap-1.5"
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
                        ? "text-primary font-medium"
                        : "text-text-primary"
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
