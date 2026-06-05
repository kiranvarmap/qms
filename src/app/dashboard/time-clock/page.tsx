"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, X, Clock, LogIn, LogOut, AlertCircle } from "lucide-react";
import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmpData {
  id: string;
  employeeId: string;
  name: string;
  department: string | null;
  designation: string | null;
  avatarUrl: string | null;
}

interface ActiveLog {
  id: string;
  workshopId: string | null;
  workshopName: string | null;
  projectId: string | null;
  projectName: string | null;
  taskId: string | null;
  taskName: string | null;
  checkInAt: string;
}

interface WorkshopOpt { id: string; name: string; }
interface ProjectOpt  { id: string; name: string; }
interface TaskOpt     { id: string; name: string; }
interface WorkspaceOpt { id: string; name: string; }
interface BoardOpt     { id: string; name: string; }
interface BoardItemOpt { id: string; name: string; }

type KioskState = "idle" | "looking_up" | "check_in" | "check_out" | "success" | "error";

// ─── Live clock ───────────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setDate(now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="text-center select-none">
      <div className="text-6xl font-mono font-bold text-gray-900 tracking-widest">{time}</div>
      <div className="text-gray-600 text-lg mt-1">{date}</div>
    </div>
  );
}

// ─── Camera capture component ─────────────────────────────────────────────────

interface CameraCaptureProps {
  onCapture: (photoUrl: string) => void;
  onCancel: () => void;
  label?: string;
}

function CameraCapture({ onCapture, onCancel, label }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);
  const [error, setError] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  // Single effect: init camera + drive preview animation loop
  useEffect(() => {
    let mounted = true;

    const drawPreview = () => {
      if (!mounted) return;
      const video = videoRef.current;
      const canvas = previewCanvasRef.current;
      if (!video || !canvas) { animRef.current = requestAnimationFrame(drawPreview); return; }
      const ctx = canvas.getContext("2d");
      if (!ctx) { animRef.current = requestAnimationFrame(drawPreview); return; }
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const ts = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "medium" });
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, canvas.height - 36, canvas.width, 36);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px monospace";
      ctx.fillText(ts, 10, canvas.height - 12);
      animRef.current = requestAnimationFrame(drawPreview);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } })
      .then((stream) => {
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play()
            .then(() => { animRef.current = requestAnimationFrame(drawPreview); })
            .catch(() => {});
        }
      })
      .catch(() => setError("Camera not available. Please allow camera access."));

    return () => {
      mounted = false;
      cancelAnimationFrame(animRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleCapture = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Bake timestamp onto capture
    const now = new Date().toLocaleString("en-US", { dateStyle: "full", timeStyle: "long" });
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, canvas.height - 44, canvas.width, 44);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px monospace";
    ctx.fillText(now, 10, canvas.height - 14);

    setUploading(true);
    canvas.toBlob(async (blob) => {
      if (!blob) { setUploading(false); return; }
      const fd = new FormData();
      fd.append("file", blob, `timeclock-${Date.now()}.jpg`);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        onCapture(data.url);
      } catch {
        setError("Upload failed. Please retry.");
      }
      setUploading(false);
    }, "image/jpeg", 0.92);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {label && <p className="text-gray-700 font-medium text-sm">{label}</p>}
      {error ? (
        <div className="w-80 h-48 bg-gray-100 rounded-xl flex flex-col items-center justify-center text-red-600 gap-2 text-sm px-4 text-center">
          <AlertCircle className="w-8 h-8" />
          {error}
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
          <video ref={videoRef} className="hidden" muted playsInline />
          <canvas ref={previewCanvasRef} className="w-80 h-60 object-cover" />
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-600 text-gray-900 text-sm flex items-center gap-2 transition-colors"
        >
          <X className="w-4 h-4" /> Cancel
        </button>
        <button
          onClick={handleCapture}
          disabled={uploading || !!error}
          className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2 transition-colors"
        >
          {uploading ? (
            <span className="animate-spin w-4 h-4 border-2 border-gray-200 border-t-transparent rounded-full" />
          ) : (
            <Camera className="w-4 h-4" />
          )}
          {uploading ? "Processing..." : "Capture & Submit"}
        </button>
      </div>
    </div>
  );
}

// ─── Main kiosk page ──────────────────────────────────────────────────────────

export default function TimeClockPage() {
  const [state, setState] = useState<KioskState>("idle");
  const [badgeInput, setBadgeInput] = useState("");
  const [employee, setEmployee] = useState<EmpData | null>(null);
  const [activeLog, setActiveLog] = useState<ActiveLog | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [elapsedMins, setElapsedMins] = useState(0);

  // Check-in form
  const [workshops, setWorkshops] = useState<WorkshopOpt[]>([]);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [tasks, setTasks] = useState<TaskOpt[]>([]);
  const [selectedWorkshop, setSelectedWorkshop] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedTask, setSelectedTask] = useState("");
  const [checkoutNotes, setCheckoutNotes] = useState("");

  // Scope ladder: link the shift to Workspace → Board → Task (Plan B.4)
  const [workspaces, setWorkspaces] = useState<WorkspaceOpt[]>([]);
  const [wsBoards, setWsBoards] = useState<BoardOpt[]>([]);
  const [boardItems, setBoardItems] = useState<BoardItemOpt[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState("");
  const [selectedBoard, setSelectedBoard] = useState("");
  const [selectedBoardItem, setSelectedBoardItem] = useState("");

  // Live elapsed timer for check-out display
  useEffect(() => {
    if (state !== "check_out" || !activeLog) return;
    const update = () => {
      const secs = (new Date().getTime() - new Date(activeLog.checkInAt).getTime()) / 60000;
      setElapsedMins(Math.round(secs));
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [state, activeLog]);

  // Load workshops for check-in form
  useEffect(() => {
    fetch("/api/workshops")
      .then((r) => r.json())
      .then((data) => setWorkshops(data.filter((w: WorkshopOpt & { isActive?: boolean }) => w.isActive !== false)))
      .catch(() => {});
  }, []);

  // Load projects when workshop changes
  useEffect(() => {
    if (!selectedWorkshop) { setProjects([]); setTasks([]); return; } // eslint-disable-line react-hooks/set-state-in-effect
    fetch(`/api/emp-projects?workshopId=${selectedWorkshop}`)
      .then((r) => r.json())
      .then(setProjects)
      .catch(() => {});
  }, [selectedWorkshop]);

  useEffect(() => {
    if (!selectedProject) { setTasks([]); return; } // eslint-disable-line react-hooks/set-state-in-effect
    fetch(`/api/emp-tasks?projectId=${selectedProject}`)
      .then((r) => r.json())
      .then(setTasks)
      .catch(() => {});
  }, [selectedProject]);

  // ── Scope ladder: Workspace → Board → Task ───────────────────────────
  useEffect(() => {
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((d) => setWorkspaces(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedWorkspace) { setWsBoards([]); setBoardItems([]); return; } // eslint-disable-line react-hooks/set-state-in-effect
    fetch(`/api/workspaces/${selectedWorkspace}`)
      .then((r) => r.json())
      .then((d) => setWsBoards(d.boards ?? []))
      .catch(() => {});
  }, [selectedWorkspace]);

  useEffect(() => {
    if (!selectedBoard) { setBoardItems([]); return; } // eslint-disable-line react-hooks/set-state-in-effect
    fetch(`/api/boards/${selectedBoard}`)
      .then((r) => r.json())
      .then((d) => setBoardItems((d.items ?? []).map((i: { id: string; name: string }) => ({ id: i.id, name: i.name }))))
      .catch(() => {});
  }, [selectedBoard]);

  const lookupEmployee = async () => {
    const badge = badgeInput.trim().toUpperCase();
    if (!badge) return;
    setState("looking_up");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/time-logs/active?badge=${badge}`);
      if (!res.ok) {
        const d = await res.json();
        setErrorMsg(d.error ?? "Employee not found");
        setState("error");
        return;
      }
      const { employee: emp, activeLog: log } = await res.json();
      setEmployee(emp);
      setActiveLog(log);
      setState(log ? "check_out" : "check_in");
    } catch {
      setErrorMsg("Network error. Please try again.");
      setState("error");
    }
  };

  const handleCheckIn = async (photoUrl: string) => {
    if (!employee) return;
    const res = await fetch("/api/time-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: employee.id,
        workshopId: selectedWorkshop || null,
        projectId: selectedProject || null,
        taskId: selectedTask || null,
        // Scope ladder — link the shift to a work item for roll-up reporting
        workspaceId: selectedWorkspace || null,
        boardId: selectedBoard || null,
        itemId: selectedBoardItem || null,
        checkInPhoto: photoUrl,
      }),
    });
    if (res.ok) {
      setSuccessMsg(`✓ ${employee.name} checked IN successfully`);
      setState("success");
    } else {
      const d = await res.json();
      setErrorMsg(d.error ?? "Check-in failed");
      setState("error");
    }
  };

  const handleCheckOut = async (photoUrl: string) => {
    if (!activeLog) return;
    const res = await fetch(`/api/time-logs/${activeLog.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkOutPhoto: photoUrl, notes: checkoutNotes }),
    });
    if (res.ok) {
      const log = await res.json();
      const mins = log.durationMinutes ?? 0;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      setSuccessMsg(`✓ ${employee?.name} checked OUT — ${h}h ${m}m logged`);
      setState("success");
    } else {
      const d = await res.json();
      setErrorMsg(d.error ?? "Check-out failed");
      setState("error");
    }
  };

  const reset = () => {
    setState("idle");
    setBadgeInput("");
    setEmployee(null);
    setActiveLog(null);
    setErrorMsg("");
    setSuccessMsg("");
    setSelectedWorkshop("");
    setSelectedProject("");
    setSelectedTask("");
    setSelectedWorkspace("");
    setSelectedBoard("");
    setSelectedBoardItem("");
    setCheckoutNotes("");
  };

  const getProjectsForWorkshop = () => {
    if (selectedWorkshop) return projects;
    return [];
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start pt-10 px-4">
      {/* Clock */}
      <LiveClock />

      {/* Card */}
      <div className="mt-10 w-full max-w-lg">
        {/* IDLE — badge entry */}
        {(state === "idle" || state === "looking_up") && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col items-center gap-6 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center">
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Time Clock</h1>
            <p className="text-gray-600 text-sm text-center">Enter your Employee ID / Badge Number to check in or out</p>
            <div className="w-full flex flex-col gap-3">
              <input
                type="text"
                value={badgeInput}
                onChange={(e) => setBadgeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookupEmployee()}
                placeholder="e.g. EMP001"
                autoFocus
                className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-xl text-center tracking-widest font-mono placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={lookupEmployee}
                disabled={state === "looking_up" || !badgeInput.trim()}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-base flex items-center justify-center gap-2 transition-colors"
              >
                {state === "looking_up" ? (
                  <>
                    <span className="animate-spin w-5 h-5 border-2 border-gray-200 border-t-transparent rounded-full" />
                    Looking up employee…
                  </>
                ) : (
                  "Continue →"
                )}
              </button>
            </div>
          </div>
        )}

        {/* ERROR state */}
        {state === "error" && (
          <div className="bg-white rounded-2xl border border-red-500/30 p-8 flex flex-col items-center gap-5 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-red-600/20 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Error</h2>
            <p className="text-red-600 text-center text-sm">{errorMsg}</p>
            <button onClick={reset} className="px-6 py-2 rounded-xl bg-gray-100 hover:bg-gray-600 text-gray-900 font-medium transition-colors">
              Try Again
            </button>
          </div>
        )}

        {/* SUCCESS state */}
        {state === "success" && (
          <div className="bg-white rounded-2xl border border-green-500/30 p-8 flex flex-col items-center gap-5 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-green-600/20 flex items-center justify-center">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Success!</h2>
            <p className="text-green-600 text-center font-medium">{successMsg}</p>
            <button onClick={reset} className="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-base transition-colors mt-2">
              Next Employee
            </button>
          </div>
        )}

        {/* CHECK-IN state */}
        {state === "check_in" && employee && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xl flex flex-col gap-5">
            {/* Employee header */}
            <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
              <div className="w-14 h-14 rounded-2xl bg-blue-600/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                {employee.avatarUrl ? (
                  <Image src={employee.avatarUrl} alt={employee.name} width={56} height={56} className="object-cover rounded-2xl" />
                ) : (
                  <span className="text-2xl font-bold text-blue-600">{employee.name.charAt(0)}</span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-900 font-bold text-lg">{employee.name}</span>
                  <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-600 text-xs font-medium">Checking In</span>
                </div>
                <p className="text-gray-600 text-sm">{employee.employeeId} · {employee.department ?? "—"}</p>
              </div>
              <LogIn className="w-6 h-6 text-green-600 ml-auto" />
            </div>

            {/* Selections */}
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-gray-600 uppercase tracking-wider font-medium mb-1.5 block">Workshop / Work Area</label>
                <select
                  value={selectedWorkshop}
                  onChange={(e) => { setSelectedWorkshop(e.target.value); setSelectedProject(""); setSelectedTask(""); }}
                  className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">— Select Workshop —</option>
                  {workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-600 uppercase tracking-wider font-medium mb-1.5 block">Project</label>
                <select
                  value={selectedProject}
                  onChange={(e) => { setSelectedProject(e.target.value); setSelectedTask(""); }}
                  disabled={!selectedWorkshop && projects.length === 0}
                  className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="">— Select Project —</option>
                  {getProjectsForWorkshop().map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-600 uppercase tracking-wider font-medium mb-1.5 block">Task</label>
                <select
                  value={selectedTask}
                  onChange={(e) => setSelectedTask(e.target.value)}
                  disabled={!selectedProject}
                  className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="">— Select Task —</option>
                  {tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              {/* ── Link to Work: Workspace → Board → Task (optional) ── */}
              <div className="border-t border-gray-200 pt-3 mt-1">
                <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-2">
                  Link to Work Item (optional) — tracked &amp; rolled up by task / board / workspace
                </p>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs text-gray-600 uppercase tracking-wider font-medium mb-1.5 block">Workspace</label>
                    <select
                      value={selectedWorkspace}
                      onChange={(e) => { setSelectedWorkspace(e.target.value); setSelectedBoard(""); setSelectedBoardItem(""); }}
                      className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">— Select Workspace —</option>
                      {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 uppercase tracking-wider font-medium mb-1.5 block">Board</label>
                    <select
                      value={selectedBoard}
                      onChange={(e) => { setSelectedBoard(e.target.value); setSelectedBoardItem(""); }}
                      disabled={!selectedWorkspace}
                      className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="">— Select Board —</option>
                      {wsBoards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 uppercase tracking-wider font-medium mb-1.5 block">Task</label>
                    <select
                      value={selectedBoardItem}
                      onChange={(e) => setSelectedBoardItem(e.target.value)}
                      disabled={!selectedBoard}
                      className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="">— Select Task —</option>
                      {boardItems.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Camera */}
            <div className="mt-2">
              <CameraCapture
                label="Take a photo to confirm check-in"
                onCapture={handleCheckIn}
                onCancel={reset}
              />
            </div>
          </div>
        )}

        {/* CHECK-OUT state */}
        {state === "check_out" && employee && activeLog && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xl flex flex-col gap-5">
            {/* Employee header */}
            <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
              <div className="w-14 h-14 rounded-2xl bg-orange-600/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                {employee.avatarUrl ? (
                  <Image src={employee.avatarUrl} alt={employee.name} width={56} height={56} className="object-cover rounded-2xl" />
                ) : (
                  <span className="text-2xl font-bold text-orange-600">{employee.name.charAt(0)}</span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-900 font-bold text-lg">{employee.name}</span>
                  <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-600 text-xs font-medium">Checking Out</span>
                </div>
                <p className="text-gray-600 text-sm">{employee.employeeId} · {employee.department ?? "—"}</p>
              </div>
              <LogOut className="w-6 h-6 text-orange-600 ml-auto" />
            </div>

            {/* Active session info */}
            <div className="bg-gray-100 rounded-xl p-4 space-y-2 text-sm">
              <p className="text-gray-600 text-xs uppercase tracking-wider font-medium mb-2">Current Session</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <span className="text-gray-500">Workshop</span>
                <span className="text-gray-900 font-medium">{activeLog.workshopName ?? "—"}</span>
                <span className="text-gray-500">Project</span>
                <span className="text-gray-900 font-medium">{activeLog.projectName ?? "—"}</span>
                <span className="text-gray-500">Task</span>
                <span className="text-gray-900 font-medium">{activeLog.taskName ?? "—"}</span>
                <span className="text-gray-500">Checked in</span>
                <span className="text-gray-900 font-medium">
                  {new Date(activeLog.checkInAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="text-gray-500">Duration</span>
                <span className="text-green-600 font-semibold">
                  {`${Math.floor(elapsedMins / 60)}h ${elapsedMins % 60}m`}
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-600 uppercase tracking-wider font-medium mb-1.5 block">Notes (optional)</label>
              <textarea
                value={checkoutNotes}
                onChange={(e) => setCheckoutNotes(e.target.value)}
                placeholder="Any remarks about today's work..."
                rows={2}
                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-600"
              />
            </div>

            {/* Camera */}
            <CameraCapture
              label="Take a photo to confirm check-out"
              onCapture={handleCheckOut}
              onCancel={reset}
            />
          </div>
        )}
      </div>
    </div>
  );
}
