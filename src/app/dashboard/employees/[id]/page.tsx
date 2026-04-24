"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft, Clock, LogIn, LogOut, Calendar,
  Briefcase, Hammer, CheckSquare, TrendingUp, AlertCircle
} from "lucide-react";
import type { Employee, TimeLog } from "@/lib/types";

interface EmployeeWithLogs extends Employee {
  logs: TimeLog[];
}

function fmtDuration(mins: number | null) {
  if (!mins && mins !== 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function fmtDateTime(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const statusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-400",
  inactive: "bg-gray-600/40 text-gray-400",
  on_leave: "bg-yellow-500/20 text-yellow-400",
};

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<EmployeeWithLogs | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "logs" | "photos">("overview");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/employees/${id}`);
    if (!res.ok) { router.push("/dashboard/employees"); return; }
    const d = await res.json();
    setData(d);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500">
        Loading employee…
      </div>
    );
  }

  if (!data) return null;

  const emp = data as EmployeeWithLogs;
  const logs = emp.logs ?? [];
  const completedLogs = logs.filter((l) => l.status === "completed");
  const activeLogs = logs.filter((l) => l.status === "active");
  const totalMinutes = completedLogs.reduce((s, l) => s + (l.durationMinutes ?? 0), 0);
  const allPhotos = logs.flatMap((l) => {
    const p: { url: string; time: string; type: string; project: string | null; task: string | null }[] = [];
    if (l.checkInPhoto) p.push({ url: l.checkInPhoto, time: l.checkInAt, type: "Check In", project: l.projectName, task: l.taskName });
    if (l.checkOutPhoto) p.push({ url: l.checkOutPhoto, time: l.checkOutAt!, type: "Check Out", project: l.projectName, task: l.taskName });
    return p;
  });

  // Projects worked on
  const projectMap: Record<string, { name: string; mins: number; sessions: number }> = {};
  for (const l of completedLogs) {
    if (l.projectId) {
      if (!projectMap[l.projectId]) projectMap[l.projectId] = { name: l.projectName ?? l.projectId, mins: 0, sessions: 0 };
      projectMap[l.projectId].mins += l.durationMinutes ?? 0;
      projectMap[l.projectId].sessions += 1;
    }
  }

  // Daily activity (last 30 days)
  const dailyMap: Record<string, number> = {};
  for (const l of completedLogs) {
    const day = new Date(l.checkInAt).toISOString().split("T")[0];
    dailyMap[day] = (dailyMap[day] ?? 0) + (l.durationMinutes ?? 0);
  }

  return (
    <div className="flex-1 min-h-screen bg-gray-950 p-6">
      {/* Back */}
      <Link href="/dashboard/employees" className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-5 transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" /> Back to Employees
      </Link>

      {/* Profile header */}
      <div className="bg-gray-900 rounded-2xl border border-white/10 p-6 mb-5">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-2xl bg-blue-600/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {emp.avatarUrl ? (
              <Image src={emp.avatarUrl} alt={emp.name} width={80} height={80} className="object-cover rounded-2xl" />
            ) : (
              <span className="text-4xl font-bold text-blue-400">{emp.name.charAt(0)}</span>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white">{emp.name}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[emp.status]}`}>
                {emp.status === "on_leave" ? "On Leave" : emp.status.charAt(0).toUpperCase() + emp.status.slice(1)}
              </span>
              {activeLogs.length > 0 && (
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  Currently Checked In
                </span>
              )}
            </div>
            <p className="text-gray-400 mt-0.5">{emp.designation ?? "—"} · {emp.department ?? "—"}</p>
            <div className="flex flex-wrap gap-4 mt-3 text-sm">
              <span className="text-gray-500 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> ID: <span className="font-mono text-gray-300">{emp.employeeId}</span></span>
              {emp.email && <span className="text-gray-500">{emp.email}</span>}
              {emp.phone && <span className="text-gray-500">{emp.phone}</span>}
              {emp.joiningDate && <span className="text-gray-500">Joined {fmtDate(emp.joiningDate)}</span>}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-white/10">
          {[
            { label: "Total Hours", value: fmtDuration(totalMinutes), icon: Clock, color: "text-blue-400" },
            { label: "Total Sessions", value: completedLogs.length, icon: LogIn, color: "text-green-400" },
            { label: "Projects", value: Object.keys(projectMap).length, icon: Briefcase, color: "text-purple-400" },
            { label: "Avg Session", value: completedLogs.length > 0 ? fmtDuration(Math.round(totalMinutes / completedLogs.length)) : "—", icon: TrendingUp, color: "text-yellow-400" },
          ].map((s) => (
            <div key={s.label} className="bg-gray-800/50 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-gray-400 text-xs">{s.label}</span>
              </div>
              <p className="text-white font-bold text-xl">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Active session banner */}
      {activeLogs.map((l) => (
        <div key={l.id} className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-5 flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-green-400 flex-shrink-0 animate-pulse" />
          <div className="flex-1 text-sm">
            <span className="text-green-400 font-medium">Active session</span>
            <span className="text-gray-400"> — checked in at {fmtDateTime(l.checkInAt)}</span>
            {l.projectName && <span className="text-gray-400"> · {l.projectName}</span>}
            {l.taskName && <span className="text-gray-400"> → {l.taskName}</span>}
            {l.workshopName && <span className="text-gray-400 ml-2 text-xs">[{l.workshopName}]</span>}
          </div>
          {l.checkInPhoto && (
            <button onClick={() => setPhotoPreview(l.checkInPhoto)} className="text-xs text-green-400 underline">View photo</button>
          )}
        </div>
      ))}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-900/60 rounded-xl p-1 w-fit border border-white/10">
        {(["overview", "logs", "photos"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              activeTab === tab ? "bg-white/10 text-white" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {tab === "logs" ? `Time Logs (${logs.length})` : tab === "photos" ? `Photos (${allPhotos.length})` : "Overview"}
          </button>
        ))}
      </div>

      {/* OVERVIEW tab */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Projects breakdown */}
          <div className="bg-gray-900 rounded-xl border border-white/10 p-5">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><Briefcase className="w-4 h-4 text-purple-400" /> Projects Worked</h3>
            {Object.keys(projectMap).length === 0 ? (
              <p className="text-gray-500 text-sm">No project assignments yet</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(projectMap).sort(([, a], [, b]) => b.mins - a.mins).map(([pid, p]) => (
                  <div key={pid} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-white text-sm truncate">{p.name}</span>
                        <span className="text-gray-400 text-xs ml-2 flex-shrink-0">{fmtDuration(p.mins)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full"
                          style={{ width: `${Math.min(100, (p.mins / totalMinutes) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-gray-500 text-xs">{p.sessions}x</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="bg-gray-900 rounded-xl border border-white/10 p-5">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-yellow-400" /> Recent Activity</h3>
            {logs.slice(0, 8).length === 0 ? (
              <p className="text-gray-500 text-sm">No activity yet</p>
            ) : (
              <div className="space-y-2">
                {logs.slice(0, 8).map((l) => (
                  <div key={l.id} className="flex items-center gap-2 text-sm">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${l.status === "active" ? "bg-green-400" : "bg-gray-600"}`} />
                    <span className="text-gray-400 text-xs min-w-[80px]">{fmtDateTime(l.checkInAt)}</span>
                    <span className="text-white truncate">{l.projectName ?? "—"}</span>
                    {l.taskName && <span className="text-gray-500 truncate text-xs">→ {l.taskName}</span>}
                    <span className="ml-auto text-gray-400 flex-shrink-0 text-xs">{fmtDuration(l.durationMinutes)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* LOGS tab */}
      {activeTab === "logs" && (
        <div className="bg-gray-900 rounded-xl border border-white/10 overflow-hidden">
          {logs.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No time logs recorded yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Workshop</th>
                  <th className="text-left px-4 py-3 font-medium">Project</th>
                  <th className="text-left px-4 py-3 font-medium">Task</th>
                  <th className="text-left px-4 py-3 font-medium">Check In</th>
                  <th className="text-left px-4 py-3 font-medium">Check Out</th>
                  <th className="text-left px-4 py-3 font-medium">Duration</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l, i) => (
                  <tr key={l.id} className={`border-b border-white/5 hover:bg-white/[0.02] ${i === logs.length - 1 ? "border-b-0" : ""}`}>
                    <td className="px-4 py-3 text-gray-400">{fmtDate(l.checkInAt)}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-gray-300"><Hammer className="w-3 h-3 text-gray-500" />{l.workshopName ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{l.projectName ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-300">{l.taskName ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                      <div className="flex items-center gap-1.5">
                        <LogIn className="w-3 h-3 text-green-500" />
                        {new Date(l.checkInAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        {l.checkInPhoto && (
                          <button onClick={() => setPhotoPreview(l.checkInPhoto)} className="text-blue-400 hover:underline">📷</button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                      <div className="flex items-center gap-1.5">
                        {l.checkOutAt ? (
                          <>
                            <LogOut className="w-3 h-3 text-red-400" />
                            {new Date(l.checkOutAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                            {l.checkOutPhoto && (
                              <button onClick={() => setPhotoPreview(l.checkOutPhoto)} className="text-blue-400 hover:underline">📷</button>
                            )}
                          </>
                        ) : "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">{fmtDuration(l.durationMinutes)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${l.status === "active" ? "bg-green-500/20 text-green-400" : "bg-gray-700 text-gray-400"}`}>
                        {l.status === "active" ? "Active" : "Done"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* PHOTOS tab */}
      {activeTab === "photos" && (
        <div>
          {allPhotos.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <CheckSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No check-in/out photos yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {allPhotos.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setPhotoPreview(p.url)}
                  className="group relative rounded-xl overflow-hidden bg-gray-900 border border-white/10 aspect-video hover:border-blue-500/50 transition-colors"
                >
                  <Image src={p.url} alt={p.type} fill className="object-cover group-hover:scale-105 transition-transform duration-200" />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="text-white text-xs font-medium">{p.type}</p>
                    <p className="text-gray-300 text-xs">{fmtDateTime(p.time)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Photo lightbox */}
      {photoPreview && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPhotoPreview(null)}
        >
          <div className="relative max-w-2xl w-full">
            <Image src={photoPreview} alt="Time clock photo" width={800} height={600} className="rounded-xl object-contain w-full" />
            <button
              onClick={() => setPhotoPreview(null)}
              className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5 text-white hover:bg-black/80"
            >
              <AlertCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
