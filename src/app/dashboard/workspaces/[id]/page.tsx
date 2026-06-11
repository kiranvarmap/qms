"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Plus,
  Loader2,
  ArrowLeft,
  Table2,
  Trash2,
  X,
} from "lucide-react";

interface Board {
  id: string;
  name: string;
  description: string | null;
  color: string;
  createdAt: string;
}

interface WorkspaceData {
  id: string;
  name: string;
  description: string | null;
  color: string;
  boards: Board[];
  members: Array<{ userId: string; role: string; name: string; email: string }>;
}

const COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#6366f1",
];

export default function WorkspaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [boardName, setBoardName] = useState("");
  const [boardColor, setBoardColor] = useState("#3b82f6");
  const [creating, setCreating] = useState(false);

  const fetchWorkspace = useCallback(async () => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`);
      if (!res.ok) {
        router.push("/dashboard/workspaces");
        return;
      }
      const data = await res.json();
      setWorkspace(data);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, router]);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/boards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: boardName, color: boardColor }),
      });
      if (res.ok) {
        setShowCreate(false);
        setBoardName("");
        setBoardColor("#3b82f6");
        await fetchWorkspace();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteBoard = async (boardId: string) => {
    if (!confirm("Delete this board and all its data?")) return;
    await fetch(`/api/boards/${boardId}`, { method: "DELETE" });
    await fetchWorkspace();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
      </div>
    );
  }

  if (!workspace) return null;

  return (
    <div className="px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/workspaces">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-900 font-bold text-lg flex-shrink-0"
            style={{ backgroundColor: workspace.color }}
          >
            {workspace.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{workspace.name}</h1>
            {workspace.description && (
              <p className="text-sm text-gray-500">{workspace.description}</p>
            )}
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Board
        </Button>
      </div>

      {/* Create Board Dialog */}
      {showCreate && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setShowCreate(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b px-6 py-4">
                <h2 className="text-lg font-semibold">New Board</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowCreate(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <form onSubmit={handleCreateBoard} className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label>Board Name</Label>
                  <Input
                    value={boardName}
                    onChange={(e) => setBoardName(e.target.value)}
                    placeholder="e.g. Sprint Backlog"
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setBoardColor(c)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          boardColor === c ? "border-gray-900 scale-110" : "border-transparent"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={creating}>
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Board
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Boards Grid */}
      {workspace.boards.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Table2 className="mx-auto h-12 w-12 text-gray-700 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No boards yet</h3>
            <p className="text-sm text-gray-500 mb-4">
              Create your first board to start managing tasks.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Board
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspace.boards.map((board) => (
            <Card key={board.id} className="group relative hover:shadow-md transition-shadow">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-3 right-3 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 hover:bg-red-50"
                onClick={() => handleDeleteBoard(board.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Link href={`/dashboard/boards/${board.id}`}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-10 rounded-full flex-shrink-0"
                      style={{ backgroundColor: board.color }}
                    />
                    <div>
                      <CardTitle className="text-base">{board.name}</CardTitle>
                      <CardDescription className="text-xs">
                        Created {new Date(board.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
