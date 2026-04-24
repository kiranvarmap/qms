"use client";

import { useEffect, useState, useCallback } from "react";
import { FolderKanban, Plus, ChevronDown, ChevronRight, Pencil, Trash2, X, Check, AlertCircle, ClipboardList } from "lucide-react";
import type { EmpProject, EmpTask, Workshop } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/20 text-green-400",
  completed: "bg-blue-500/20 text-blue-400",
  on_hold: "bg-yellow-500/20 text-yellow-400",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  completed: "Completed",
  on_hold: "On Hold",
};

const emptyProjectForm = { name: "", description: "", workshopId: "", status: "active", startDate: "", endDate: "" };
const emptyTaskForm = { name: "", description: "", estimatedMinutes: "" };

export default function EmpProjectsPage() {
  const [projects, setProjects] = useState<EmpProject[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [tasks, setTasks] = useState<Record<string, EmpTask[]>>({});

  // Project modal
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editProject, setEditProject] = useState<EmpProject | null>(null);
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [projectError, setProjectError] = useState("");
  const [savingProject, setSavingProject] = useState(false);

  // Task modal
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskProjectId, setTaskProjectId] = useState("");
  const [editTask, setEditTask] = useState<EmpTask | null>(null);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [taskError, setTaskError] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ type: "project" | "task"; id: string } | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    const [projRes, wsRes] = await Promise.all([
      fetch("/api/emp-projects"),
      fetch("/api/workshops"),
    ]);
    setProjects(await projRes.json());
    setWorkshops(await wsRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]); // eslint-disable-line react-hooks/set-state-in-effect

  const loadTasks = useCallback(async (projectId: string) => {
    if (tasks[projectId]) return;
    const res = await fetch(`/api/emp-tasks?projectId=${projectId}`);
    const data = await res.json();
    setTasks((prev) => ({ ...prev, [projectId]: data }));
  }, [tasks]);

  const toggleExpand = (id: string) => {
    const next = !expanded[id];
    setExpanded((prev) => ({ ...prev, [id]: next }));
    if (next) loadTasks(id);
  };

  // Project CRUD
  const openNewProject = () => {
    setEditProject(null);
    setProjectForm(emptyProjectForm);
    setProjectError("");
    setShowProjectModal(true);
  };

  const openEditProject = (p: EmpProject) => {
    setEditProject(p);
    setProjectForm({
      name: p.name,
      description: p.description ?? "",
      workshopId: p.workshopId ?? "",
      status: p.status,
      startDate: p.startDate ? p.startDate.split("T")[0] : "",
      endDate: p.endDate ? p.endDate.split("T")[0] : "",
    });
    setProjectError("");
    setShowProjectModal(true);
  };

  const saveProject = async () => {
    if (!projectForm.name.trim()) { setProjectError("Name is required."); return; }
    setSavingProject(true);
    setProjectError("");

    const method = editProject ? "PUT" : "POST";
    const body = editProject ? { id: editProject.id, ...projectForm } : projectForm;

    const res = await fetch("/api/emp-projects", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) { setShowProjectModal(false); loadProjects(); }
    else { const d = await res.json(); setProjectError(d.error ?? "Failed to save."); }
    setSavingProject(false);
  };

  // Task CRUD
  const openNewTask = (projectId: string) => {
    setTaskProjectId(projectId);
    setEditTask(null);
    setTaskForm(emptyTaskForm);
    setTaskError("");
    setShowTaskModal(true);
  };

  const openEditTask = (task: EmpTask) => {
    setTaskProjectId(task.projectId);
    setEditTask(task);
    setTaskForm({
      name: task.name,
      description: task.description ?? "",
      estimatedMinutes: task.estimatedMinutes?.toString() ?? "",
    });
    setTaskError("");
    setShowTaskModal(true);
  };

  const saveTask = async () => {
    if (!taskForm.name.trim()) { setTaskError("Name is required."); return; }
    setSavingTask(true);
    setTaskError("");

    const method = editTask ? "PUT" : "POST";
    const body = editTask
      ? { id: editTask.id, ...taskForm, estimatedMinutes: taskForm.estimatedMinutes ? Number(taskForm.estimatedMinutes) : null }
      : { projectId: taskProjectId, ...taskForm, estimatedMinutes: taskForm.estimatedMinutes ? Number(taskForm.estimatedMinutes) : null };

    const res = await fetch("/api/emp-tasks", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setShowTaskModal(false);
      // Reload tasks for the project
      setTasks((prev) => { const next = { ...prev }; delete next[taskProjectId]; return next; });
      if (expanded[taskProjectId]) loadTasks(taskProjectId);
    } else {
      const d = await res.json();
      setTaskError(d.error ?? "Failed to save.");
    }
    setSavingTask(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "project") {
      await fetch("/api/emp-projects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      loadProjects();
    } else {
      const task = Object.values(tasks).flat().find((t) => t.id === deleteTarget.id);
      if (task) {
        await fetch("/api/emp-tasks", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: deleteTarget.id }),
        });
        setTasks((prev) => { const next = { ...prev }; delete next[task.projectId]; return next; });
        if (expanded[task.projectId]) loadTasks(task.projectId);
      }
    }
    setDeleteTarget(null);
  };

  return (
    <div className="flex-1 min-h-screen bg-gray-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FolderKanban className="w-7 h-7 text-purple-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Projects & Tasks</h1>
            <p className="text-gray-400 text-sm">{projects.length} projects for employee time tracking</p>
          </div>
        </div>
        <button
          onClick={openNewProject}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {loading ? (
        <div className="text-gray-500 text-center py-20">Loading…</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <FolderKanban className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No projects yet. Create your first project.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <div key={p.id} className="bg-gray-900 rounded-xl border border-white/10 overflow-hidden">
              {/* Project row */}
              <div className="flex items-center gap-3 px-4 py-4">
                <button
                  onClick={() => toggleExpand(p.id)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  {expanded[p.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <FolderKanban className="w-4 h-4 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium">{p.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status]}`}>
                      {STATUS_LABELS[p.status]}
                    </span>
                    {p.workshopName && (
                      <span className="text-gray-500 text-xs">[{p.workshopName}]</span>
                    )}
                  </div>
                  {p.description && <p className="text-gray-500 text-xs mt-0.5 truncate">{p.description}</p>}
                </div>
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    onClick={() => { openNewTask(p.id); if (!expanded[p.id]) toggleExpand(p.id); }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white text-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Task
                  </button>
                  <button onClick={() => openEditProject(p)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDeleteTarget({ type: "project", id: p.id })} className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Tasks list */}
              {expanded[p.id] && (
                <div className="border-t border-white/10 bg-gray-950/40">
                  {!tasks[p.id] ? (
                    <div className="px-12 py-4 text-gray-500 text-sm">Loading tasks…</div>
                  ) : tasks[p.id].length === 0 ? (
                    <div className="px-12 py-4 text-gray-500 text-sm flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 opacity-40" />
                      No tasks yet.
                      <button onClick={() => openNewTask(p.id)} className="text-blue-400 hover:underline">Add one</button>
                    </div>
                  ) : (
                    tasks[p.id].map((task, i) => (
                      <div
                        key={task.id}
                        className={`flex items-center gap-3 px-12 py-3 ${i < tasks[p.id].length - 1 ? "border-b border-white/5" : ""}`}
                      >
                        <div className="w-2 h-2 rounded-full bg-gray-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-gray-200 text-sm">{task.name}</span>
                          {task.estimatedMinutes && (
                            <span className="ml-2 text-gray-500 text-xs">~{Math.floor(task.estimatedMinutes / 60)}h {task.estimatedMinutes % 60}m est.</span>
                          )}
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-xs ${STATUS_COLORS[task.status]}`}>{STATUS_LABELS[task.status]}</span>
                        <div className="flex gap-1">
                          <button onClick={() => openEditTask(task)} className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-white transition-colors">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={() => setDeleteTarget({ type: "task", id: task.id })} className="p-1 rounded hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h2 className="text-white font-semibold">{editProject ? "Edit Project" : "New Project"}</h2>
              <button onClick={() => setShowProjectModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              {projectError && (
                <div className="flex items-center gap-2 text-red-400 bg-red-500/10 rounded-lg px-3 py-2 text-sm">
                  <AlertCircle className="w-4 h-4" /> {projectError}
                </div>
              )}
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1.5 block">Project Name *</label>
                <input value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} placeholder="e.g. Product Line 5 Rework" className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1.5 block">Description</label>
                <textarea value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} rows={2} className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-600" placeholder="What is this project about..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1.5 block">Workshop</label>
                  <select value={projectForm.workshopId} onChange={(e) => setProjectForm({ ...projectForm, workshopId: e.target.value })} className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="">— None —</option>
                    {workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1.5 block">Status</label>
                  <select value={projectForm.status} onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })} className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1.5 block">Start Date</label>
                  <input type="date" value={projectForm.startDate} onChange={(e) => setProjectForm({ ...projectForm, startDate: e.target.value })} className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1.5 block">End Date</label>
                  <input type="date" value={projectForm.endDate} onChange={(e) => setProjectForm({ ...projectForm, endDate: e.target.value })} className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
              <button onClick={() => setShowProjectModal(false)} className="px-4 py-2 rounded-lg bg-gray-800 text-white text-sm">Cancel</button>
              <button onClick={saveProject} disabled={savingProject} className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium flex items-center gap-2">
                {savingProject ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Check className="w-4 h-4" />}
                {editProject ? "Save Changes" : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h2 className="text-white font-semibold">{editTask ? "Edit Task" : "New Task"}</h2>
              <button onClick={() => setShowTaskModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              {taskError && (
                <div className="flex items-center gap-2 text-red-400 bg-red-500/10 rounded-lg px-3 py-2 text-sm">
                  <AlertCircle className="w-4 h-4" /> {taskError}
                </div>
              )}
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1.5 block">Task Name *</label>
                <input value={taskForm.name} onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })} placeholder="e.g. Welding Phase 1" className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1.5 block">Description</label>
                <textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} rows={2} className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-600" />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1.5 block">Estimated Time (minutes)</label>
                <input type="number" value={taskForm.estimatedMinutes} onChange={(e) => setTaskForm({ ...taskForm, estimatedMinutes: e.target.value })} placeholder="e.g. 120 = 2 hours" className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
              <button onClick={() => setShowTaskModal(false)} className="px-4 py-2 rounded-lg bg-gray-800 text-white text-sm">Cancel</button>
              <button onClick={saveTask} disabled={savingTask} className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium flex items-center gap-2">
                {savingTask ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Check className="w-4 h-4" />}
                {editTask ? "Save Task" : "Add Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-gray-900 rounded-2xl border border-red-500/20 p-6 w-full max-w-sm text-center">
            <Trash2 className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-1">Delete {deleteTarget.type === "project" ? "Project" : "Task"}?</h3>
            <p className="text-gray-400 text-sm mb-5">
              {deleteTarget.type === "project" ? "All tasks in this project will also be deleted." : "This action cannot be undone."}
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg bg-gray-800 text-white text-sm">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
