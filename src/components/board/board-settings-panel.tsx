"use client";

import { useEffect, useState, useCallback } from "react";
import { X, Shield, Bell, Loader2, Plus, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColumnDef } from "@/lib/types";

interface SystemUser {
  id: string;
  name: string | null;
  email: string;
}

interface ColumnPerm {
  id: string;
  columnId: string | null;
  userId: string;
  canView: boolean;
  canEdit: boolean;
  userName: string | null;
  userEmail: string | null;
  columnName: string | null;
}

interface RowPerm {
  id: string;
  itemId: string;
  userId: string;
  canView: boolean;
  canEdit: boolean;
  userName: string | null;
  userEmail: string | null;
  itemName: string | null;
}

interface NotificationRule {
  id: string;
  columnId: string;
  triggerValue: string;
  notifyUserIds: string[];
  emailSubject: string | null;
  isActive: boolean;
  columnName: string | null;
}

interface BoardSettingsPanelProps {
  boardId: string;
  boardName: string;
  columns: ColumnDef[];
  workspaceId: string;
  onClose: () => void;
}

export function BoardSettingsPanel({
  boardId,
  boardName,
  columns,
  onClose,
}: BoardSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<"permissions" | "notifications">("permissions");

  // Permissions state
  const [colPerms, setColPerms] = useState<ColumnPerm[]>([]);
  const [rowPerms, setRowPerms] = useState<RowPerm[]>([]);
  const [permsLoading, setPermsLoading] = useState(false);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);

  // New column permission form
  const [newPermUserId, setNewPermUserId] = useState("");
  const [newPermColumnId, setNewPermColumnId] = useState(""); // empty = board-wide
  const [addingPerm, setAddingPerm] = useState(false);

  // Notifications state
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [newRuleColumnId, setNewRuleColumnId] = useState("");
  const [newRuleTrigger, setNewRuleTrigger] = useState("");
  const [newRuleUserIds, setNewRuleUserIds] = useState<string[]>([]);
  const [newRuleSubject, setNewRuleSubject] = useState("");
  const [addingRule, setAddingRule] = useState(false);

  const loadPerms = useCallback(async () => {
    setPermsLoading(true);
    try {
      const [permsRes, usersRes] = await Promise.all([
        fetch(`/api/boards/${boardId}/permissions`),
        fetch("/api/users"),
      ]);
      if (permsRes.ok) {
        const data = await permsRes.json();
        setColPerms(data.columnPermissions ?? []);
        setRowPerms(data.rowPermissions ?? []);
      }
      if (usersRes.ok) setSystemUsers(await usersRes.json());
    } finally {
      setPermsLoading(false);
    }
  }, [boardId]);

  const loadRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const res = await fetch(`/api/boards/${boardId}/notifications`);
      if (res.ok) setRules(await res.json());
    } finally {
      setRulesLoading(false);
    }
  }, [boardId]);

  useEffect(() => { loadPerms(); }, [loadPerms]);
  useEffect(() => { if (activeTab === "notifications") loadRules(); }, [activeTab, loadRules]);

  const addColumnPerm = async () => {
    if (!newPermUserId) return;
    setAddingPerm(true);
    try {
      await fetch(`/api/boards/${boardId}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "column",
          userId: newPermUserId,
          columnId: newPermColumnId || null,
          canView: true,
          canEdit: false,
        }),
      });
      setNewPermUserId("");
      setNewPermColumnId("");
      await loadPerms();
    } finally {
      setAddingPerm(false);
    }
  };

  const deletePerm = async (permId: string, type: "column" | "row") => {
    await fetch(`/api/boards/${boardId}/permissions?permId=${permId}&type=${type}`, {
      method: "DELETE",
    });
    if (type === "column") setColPerms((prev) => prev.filter((p) => p.id !== permId));
    else setRowPerms((prev) => prev.filter((p) => p.id !== permId));
  };

  const updateColPerm = async (permId: string, field: "canView" | "canEdit", value: boolean) => {
    setColPerms((prev) => prev.map((p) => p.id === permId ? { ...p, [field]: value } : p));
    const perm = colPerms.find((p) => p.id === permId);
    if (!perm) return;
    await fetch(`/api/boards/${boardId}/permissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "column",
        userId: perm.userId,
        columnId: perm.columnId,
        canView: field === "canView" ? value : perm.canView,
        canEdit: field === "canEdit" ? value : perm.canEdit,
      }),
    });
  };

  const addRule = async () => {
    if (!newRuleColumnId || !newRuleTrigger) return;
    setAddingRule(true);
    try {
      const res = await fetch(`/api/boards/${boardId}/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          columnId: newRuleColumnId,
          triggerValue: newRuleTrigger,
          notifyUserIds: newRuleUserIds,
          emailSubject: newRuleSubject || null,
        }),
      });
      if (res.ok) {
        setNewRuleColumnId("");
        setNewRuleTrigger("");
        setNewRuleUserIds([]);
        setNewRuleSubject("");
        await loadRules();
      }
    } finally {
      setAddingRule(false);
    }
  };

  const deleteRule = async (ruleId: string) => {
    await fetch(`/api/boards/${boardId}/notifications?ruleId=${ruleId}`, {
      method: "DELETE",
    });
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
  };

  const toggleRuleActive = async (rule: NotificationRule) => {
    setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, isActive: !r.isActive } : r));
    await fetch(`/api/boards/${boardId}/notifications`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruleId: rule.id, isActive: !rule.isActive }),
    });
  };

  // Get status/dropdown options for a column
  const getColumnOptions = (columnId: string) => {
    const col = columns.find((c) => c.id === columnId);
    if (!col) return [];
    const config = col.config as { labels?: Array<{ id: string; text: string }> };
    return config?.labels ?? [];
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[520px] z-50 bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Board Settings</h2>
            <p className="text-xs text-gray-600 mt-0.5">{boardName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 flex px-5">
          <button
            onClick={() => setActiveTab("permissions")}
            className={cn(
              "py-3 text-sm font-medium border-b-2 mr-6 flex items-center gap-1.5",
              activeTab === "permissions" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            <Shield className="h-4 w-4" />
            Column Permissions
          </button>
          <button
            onClick={() => setActiveTab("notifications")}
            className={cn(
              "py-3 text-sm font-medium border-b-2 flex items-center gap-1.5",
              activeTab === "notifications" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            <Bell className="h-4 w-4" />
            Notifications
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ── Permissions ─────────────────────────────────────────── */}
          {activeTab === "permissions" && (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                <strong>Note:</strong> Column permissions restrict which users can view or edit specific columns.
                Users not listed can see all columns by default (they inherit workspace access).
              </div>

              {/* Add new permission */}
              <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-semibold text-gray-700">Add Column Permission</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">User</label>
                    <select
                      value={newPermUserId}
                      onChange={(e) => setNewPermUserId(e.target.value)}
                      className="w-full h-8 rounded border border-gray-200 px-2 text-xs bg-white"
                    >
                      <option value="">Select user…</option>
                      {systemUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Column (blank = all)</label>
                    <select
                      value={newPermColumnId}
                      onChange={(e) => setNewPermColumnId(e.target.value)}
                      className="w-full h-8 rounded border border-gray-200 px-2 text-xs bg-white"
                    >
                      <option value="">All columns</option>
                      {columns.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  onClick={addColumnPerm}
                  disabled={!newPermUserId || addingPerm}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {addingPerm ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Add Permission
                </button>
              </div>

              {/* Existing permissions */}
              {permsLoading ? (
                <div className="flex items-center gap-2 text-gray-600 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />Loading…
                </div>
              ) : colPerms.length === 0 ? (
                <p className="text-sm text-gray-600 text-center py-4">No column permissions set. All workspace members can see all columns.</p>
              ) : (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700">Column Rules ({colPerms.length})</h4>
                  {colPerms.map((perm) => (
                    <div key={perm.id} className="flex items-center gap-3 border border-gray-200 rounded-lg p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{perm.userName ?? perm.userEmail}</p>
                        <p className="text-xs text-gray-600">{perm.columnName ?? "All columns"}</p>
                      </div>
                      <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                        <input type="checkbox" checked={perm.canView} onChange={(e) => updateColPerm(perm.id, "canView", e.target.checked)} className="rounded" />
                        View
                      </label>
                      <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                        <input type="checkbox" checked={perm.canEdit} onChange={(e) => updateColPerm(perm.id, "canEdit", e.target.checked)} className="rounded" />
                        Edit
                      </label>
                      <button
                        onClick={() => deletePerm(perm.id, "column")}
                        className="p-1 rounded hover:bg-red-50 text-gray-700 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {rowPerms.length > 0 && (
                <div className="space-y-2 mt-4">
                  <h4 className="text-sm font-semibold text-gray-700">Row Rules ({rowPerms.length})</h4>
                  {rowPerms.map((perm) => (
                    <div key={perm.id} className="flex items-center gap-3 border border-gray-200 rounded-lg p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{perm.userName ?? perm.userEmail}</p>
                        <p className="text-xs text-gray-600">Row: {perm.itemName ?? perm.itemId}</p>
                      </div>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded", perm.canView ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600")}>
                        {perm.canView ? "Can view" : "Hidden"}
                      </span>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded", perm.canEdit ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500")}>
                        {perm.canEdit ? "Can edit" : "Read-only"}
                      </span>
                      <button
                        onClick={() => deletePerm(perm.id, "row")}
                        className="p-1 rounded hover:bg-red-50 text-gray-700 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Notifications ────────────────────────────────────────── */}
          {activeTab === "notifications" && (
            <>
              <p className="text-xs text-gray-500">
                Send email notifications to selected users when a column&apos;s status changes to a specific value.
              </p>

              {/* Add rule */}
              <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-semibold text-gray-700">New Notification Rule</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Column</label>
                    <select
                      value={newRuleColumnId}
                      onChange={(e) => { setNewRuleColumnId(e.target.value); setNewRuleTrigger(""); }}
                      className="w-full h-8 rounded border border-gray-200 px-2 text-xs bg-white"
                    >
                      <option value="">Select column…</option>
                      {columns.filter((c) => ["status", "dropdown", "priority"].includes(c.type)).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Trigger value</label>
                    <select
                      value={newRuleTrigger}
                      onChange={(e) => setNewRuleTrigger(e.target.value)}
                      className="w-full h-8 rounded border border-gray-200 px-2 text-xs bg-white"
                      disabled={!newRuleColumnId}
                    >
                      <option value="">Select value…</option>
                      {getColumnOptions(newRuleColumnId).map((opt) => (
                        <option key={opt.id} value={opt.text}>{opt.text}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Notify users</label>
                  <div className="flex flex-wrap gap-1.5">
                    {systemUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() =>
                          setNewRuleUserIds((prev) =>
                            prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                          )
                        }
                        className={cn(
                          "px-2 py-0.5 text-xs rounded-full border transition-colors",
                          newRuleUserIds.includes(u.id)
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                        )}
                      >
                        {newRuleUserIds.includes(u.id) && <Check className="h-2.5 w-2.5 inline mr-0.5" />}
                        {u.name ?? u.email}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Email subject (optional)</label>
                  <input
                    value={newRuleSubject}
                    onChange={(e) => setNewRuleSubject(e.target.value)}
                    placeholder="e.g. Task status changed to Done"
                    className="w-full h-8 rounded border border-gray-200 px-2 text-xs"
                  />
                </div>
                <button
                  onClick={addRule}
                  disabled={!newRuleColumnId || !newRuleTrigger || addingRule}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {addingRule ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Create Rule
                </button>
              </div>

              {/* Existing rules */}
              {rulesLoading ? (
                <div className="flex items-center gap-2 text-gray-600 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />Loading…
                </div>
              ) : rules.length === 0 ? (
                <p className="text-sm text-gray-600 text-center py-4">No notification rules yet.</p>
              ) : (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700">Active Rules ({rules.length})</h4>
                  {rules.map((rule) => (
                    <div key={rule.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            When <strong>{rule.columnName}</strong> changes to{" "}
                            <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs font-semibold">
                              {rule.triggerValue}
                            </span>
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            Notify {(rule.notifyUserIds as string[]).length} user(s)
                          </p>
                          {rule.emailSubject && (
                            <p className="text-xs text-gray-600 italic">{rule.emailSubject}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => toggleRuleActive(rule)}
                            className={cn(
                              "w-8 h-4 rounded-full transition-colors relative",
                              rule.isActive ? "bg-green-500" : "bg-gray-200"
                            )}
                          >
                            <span className={cn("absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform", rule.isActive ? "translate-x-4" : "translate-x-0.5")} />
                          </button>
                          <button
                            onClick={() => deleteRule(rule.id)}
                            className="p-1 rounded hover:bg-red-50 text-gray-700 hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
