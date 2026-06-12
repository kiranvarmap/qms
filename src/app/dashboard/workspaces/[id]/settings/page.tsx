"use client";

import { NativeSelect } from "@/components/ui";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Update as Save, Tags as Tag, Group as Users, Delete as Trash2, Add as Plus, Check } from "@vibe/icons";
import { Loader as Loader2 } from "@vibe/core";
import { cn } from "@/lib/utils";

interface WorkspaceLabel {
  boardLabel: string;
  groupLabel: string;
  itemLabel: string;
  projectLabel: string;
  taskLabel: string;
  workshopLabel: string;
}

interface WorkspaceMember {
  userId: string;
  role: string;
  userName: string | null;
  userEmail: string;
  userRole: string;
  canAccessBoards: boolean;
  canAccessInspections: boolean;
  canAccessDocSign: boolean;
  canAccessTimeClock: boolean;
}

interface SystemUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

const DEFAULT_LABELS: WorkspaceLabel = {
  boardLabel: "Board",
  groupLabel: "Group",
  itemLabel: "Item",
  projectLabel: "Project",
  taskLabel: "Task",
  workshopLabel: "Workshop",
};

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const workspaceId = params.id as string;

  const [activeTab, setActiveTab] = useState<"labels" | "members">("labels");

  // Labels state
  const [labels, setLabels] = useState<WorkspaceLabel>(DEFAULT_LABELS);
  const [labelsLoading, setLabelsLoading] = useState(true);
  const [labelsSaving, setLabelsSaving] = useState(false);
  const [labelsSaved, setLabelsSaved] = useState(false);

  // Members state
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [addUserId, setAddUserId] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  const loadLabels = useCallback(async () => {
    setLabelsLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/labels`);
      if (res.ok) {
        const data = await res.json();
        setLabels(data);
      }
    } finally {
      setLabelsLoading(false);
    }
  }, [workspaceId]);

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const [membersRes, usersRes] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/members`),
        fetch("/api/users"),
      ]);
      if (membersRes.ok) setMembers(await membersRes.json());
      if (usersRes.ok) setSystemUsers(await usersRes.json());
    } finally {
      setMembersLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { loadLabels(); }, [loadLabels]);
  useEffect(() => { if (activeTab === "members") loadMembers(); }, [activeTab, loadMembers]);

  const saveLabels = async () => {
    setLabelsSaving(true);
    try {
      await fetch(`/api/workspaces/${workspaceId}/labels`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(labels),
      });
      setLabelsSaved(true);
      setTimeout(() => setLabelsSaved(false), 2000);
    } finally {
      setLabelsSaving(false);
    }
  };

  const addMember = async () => {
    if (!addUserId) return;
    setAddingMember(true);
    try {
      await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: addUserId, role: "member" }),
      });
      setAddUserId("");
      await loadMembers();
    } finally {
      setAddingMember(false);
    }
  };

  const updateMemberPermission = async (
    userId: string,
    field: keyof WorkspaceMember,
    value: boolean | string
  ) => {
    const member = members.find((m) => m.userId === userId);
    if (!member) return;
    const updated = { ...member, [field]: value };
    setMembers((prev) => prev.map((m) => (m.userId === userId ? updated : m)));
    await fetch(`/api/workspaces/${workspaceId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        role: updated.role,
        canAccessBoards: updated.canAccessBoards,
        canAccessInspections: updated.canAccessInspections,
        canAccessDocSign: updated.canAccessDocSign,
        canAccessTimeClock: updated.canAccessTimeClock,
      }),
    });
  };

  const removeMember = async (userId: string) => {
    await fetch(`/api/workspaces/${workspaceId}/members?userId=${userId}`, {
      method: "DELETE",
    });
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  };

  const nonMembers = systemUsers.filter(
    (u) => !members.find((m) => m.userId === u.id)
  );

  const LABEL_FIELDS: Array<{ key: keyof WorkspaceLabel; label: string; description: string }> = [
    { key: "boardLabel", label: "Board", description: "Used in sidebar, board titles, and headers" },
    { key: "groupLabel", label: "Group", description: "Sections/groups inside a board" },
    { key: "itemLabel", label: "Item", description: "Rows/cards on a board" },
    { key: "projectLabel", label: "Project", description: "Used in Employee Time Clock and Inspections" },
    { key: "taskLabel", label: "Task", description: "Tasks within a project, shown in Time Clock" },
    { key: "workshopLabel", label: "Workshop", description: "Physical work areas used in Time Clock" },
  ];

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold tracking-tight text-gray-900 [font-family:var(--font-display)]">Workspace Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure labels, members, and access permissions for this workspace.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6 flex gap-6">
        {(["labels", "members"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "pb-3 text-sm font-medium border-b-2 transition-colors capitalize flex items-center gap-1.5",
              activeTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            {tab === "labels" ? <Tag className="h-4 w-4" /> : <Users className="h-4 w-4" />}
            {tab === "labels" ? "Custom Labels" : "Members & Permissions"}
          </button>
        ))}
      </div>

      {/* ── Labels tab ───────────────────────────────────────────────── */}
      {activeTab === "labels" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Custom Label Names</CardTitle>
            <CardDescription>
              Rename the default labels used throughout boards, inspections, time clock, and
              document signing in this workspace. Changes apply across all sub-apps.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {labelsLoading ? (
              <div className="flex items-center gap-2 text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
                  {LABEL_FIELDS.map(({ key, label, description }) => (
                    <div key={key} className="space-y-1.5">
                      <Label className="text-sm font-medium">
                        {label} label
                        <span className="ml-1 text-gray-600 font-normal">
                          (default: &quot;{DEFAULT_LABELS[key]}&quot;)
                        </span>
                      </Label>
                      <Input
                        value={labels[key]}
                        onChange={(e) =>
                          setLabels((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        placeholder={DEFAULT_LABELS[key]}
                        className="h-9"
                      />
                      <p className="text-xs text-gray-600">{description}</p>
                    </div>
                  ))}
                </div>

                <Button onClick={saveLabels} disabled={labelsSaving} size="sm">
                  {labelsSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : labelsSaved ? (
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {labelsSaved ? "Saved!" : "Save Labels"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Members tab ──────────────────────────────────────────────── */}
      {activeTab === "members" && (
        <div className="space-y-4">
          {/* Add member */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add Member</CardTitle>
              <CardDescription>Grant a user access to this workspace and its sub-apps.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <NativeSelect
 value={addUserId}
 onChange={(e) => setAddUserId(e.target.value)}
                  className="flex-1 h-9 rounded-md border border-gray-200 px-3 text-sm bg-white"
                >
                  <option value="">Select a user…</option>
                  {nonMembers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name ?? u.email} ({u.email})
                    </option>
                  ))}
                </NativeSelect>
                <Button size="sm" onClick={addMember} disabled={!addUserId || addingMember}>
                  {addingMember ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Members list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Members ({members.length})
              </CardTitle>
              <CardDescription>
                Toggle which sub-apps each member can access in this workspace.
                Admin users always have full access.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {membersLoading ? (
                <div className="p-6 flex items-center gap-2 text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              ) : members.length === 0 ? (
                <p className="p-6 text-sm text-gray-600">No members yet.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {/* Header row */}
                  <div className="grid grid-cols-[1fr_100px_90px_90px_90px_90px_40px] gap-2 px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <span>User</span>
                    <span>Role</span>
                    <span className="text-center">Boards</span>
                    <span className="text-center">Inspections</span>
                    <span className="text-center">DocSign</span>
                    <span className="text-center">TimeClock</span>
                    <span></span>
                  </div>
                  {members.map((m) => (
                    <div
                      key={m.userId}
                      className="grid grid-cols-[1fr_100px_90px_90px_90px_90px_40px] gap-2 px-4 py-3 items-center"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{m.userName ?? m.userEmail}</p>
                        <p className="text-xs text-gray-600">{m.userEmail}</p>
                      </div>
                      <NativeSelect
 value={m.role}
 onChange={(e) => updateMemberPermission(m.userId, "role", e.target.value)}
                        className="h-7 rounded border border-gray-200 px-2 text-xs bg-white"
                      >
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                      </NativeSelect>
                      {(
                        [
                          ["canAccessBoards", "boards"],
                          ["canAccessInspections", "inspections"],
                          ["canAccessDocSign", "docsign"],
                          ["canAccessTimeClock", "timeclock"],
                        ] as const
                      ).map(([field]) => (
                        <div key={field} className="flex justify-center">
                          <button
                            onClick={() =>
                              updateMemberPermission(m.userId, field, !m[field])
                            }
                            className={cn(
                              "w-9 h-5 rounded-full transition-colors relative",
                              m[field] ? "bg-blue-600" : "bg-gray-200"
                            )}
                          >
                            <span
                              className={cn(
                                "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                                m[field] ? "translate-x-4" : "translate-x-0.5"
                              )}
                            />
                          </button>
                        </div>
                      ))}
                      <div className="flex justify-center">
                        {m.role !== "owner" && (
                          <button
                            onClick={() => removeMember(m.userId)}
                            className="p-1 text-gray-600 hover:text-red-500 rounded"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
