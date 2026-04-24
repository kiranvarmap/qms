"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  BarChart3, Users, FolderKanban, Hammer, ListTodo,
  Clock, TrendingUp, UserCheck, Activity, Download, RefreshCw
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(mins: number) {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split("T")[0];
}
function defaultTo() {
  return new Date().toISOString().split("T")[0];
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverviewData {
  totalMinutes: number;
  totalSessions: number;
  activeSessions: number;
  uniqueEmployees: number;
  uniqueProjects: number;
  uniqueWorkshops: number;
  recentActivity: RecentLog[];
}

interface RecentLog {
  employeeName: string | null;
  employeeCode: string | null;
  workshopName: string | null;
  projectName: string | null;
  taskName: string | null;
  checkInAt: string;
  checkOutAt: string | null;
  durationMinutes: number | null;
  status: string;
}

interface EmployeeReport {
  employeeId: string;
  name: string;
  code: string;
  department: string | null;
  minutes: number;
  sessions: number;
  active: number;
}

interface ProjectReport {
  projectId: string;
  name: string;
  minutes: number;
  sessions: number;
  uniqueEmployees: number;
  taskBreakdown: { taskId: string; name: string; minutes: number; sessions: number }[];
}

interface WorkshopReport {
  workshopId: string;
  name: string;
  minutes: number;
  sessions: number;
  uniqueEmployees: number;
  projectBreakdown: { projectId: string; name: string; minutes: number }[];
}

interface TaskReport {
  taskId: string;
  name: string;
  projectName: string;
  minutes: number;
  sessions: number;
  uniqueEmployees: number;
}

type ReportTab = "overview" | "employee" | "project" | "workshop" | "task";

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-white/10 p-4">
      <div className={`inline-flex p-2 rounded-lg bg-white/5 mb-3`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className="text-white text-2xl font-bold">{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function Bar({ value, max, color = "bg-blue-500" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden w-24">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Main report page ─────────────────────────────────────────────────────────

export default function EmpReportsPage() {
  const [tab, setTab] = useState<ReportTab>("overview");
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(defaultTo());
  const [loading, setLoading] = useState(false);

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [empData, setEmpData] = useState<EmployeeReport[]>([]);
  const [projData, setProjData] = useState<ProjectReport[]>([]);
  const [wsData, setWsData] = useState<WorkshopReport[]>([]);
  const [taskData, setTaskData] = useState<TaskReport[]>([]);

  const [expandedProj, setExpandedProj] = useState<string | null>(null);
  const [expandedWs, setExpandedWs] = useState<string | null>(null);

  // Sort
  const [empSort, setEmpSort] = useState<"minutes" | "sessions">("minutes");
  const [projSort, setProjSort] = useState<"minutes" | "sessions">("minutes");

  const fetchReport = useCallback(async (type: ReportTab) => {
    setLoading(true);
    const params = new URLSearchParams({ type, from, to });
    const res = await fetch(`/api/emp-reports?${params}`);
    const data = await res.json();

    if (type === "overview") setOverview(data);
    else if (type === "employee") setEmpData(data);
    else if (type === "project") setProjData(data);
    else if (type === "workshop") setWsData(data);
    else if (type === "task") setTaskData(data);

    setLoading(false);
  }, [from, to]);

  // Fetch overview + current tab whenever date range changes or tab switches
  useEffect(() => {
    fetchReport(tab); // eslint-disable-line react-hooks/set-state-in-effect
    if (tab !== "overview") fetchReport("overview");
  }, [tab, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const TABS: { id: ReportTab; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "employee", label: "By Employee", icon: Users },
    { id: "project", label: "By Project", icon: FolderKanban },
    { id: "workshop", label: "By Workshop", icon: Hammer },
    { id: "task", label: "By Task", icon: ListTodo },
  ];

  const maxEmpMins = Math.max(...empData.map((e) => e.minutes), 1);
  const maxProjMins = Math.max(...projData.map((p) => p.minutes), 1);
  const maxWsMins = Math.max(...wsData.map((w) => w.minutes), 1);
  const maxTaskMins = Math.max(...taskData.map((t) => t.minutes), 1);

  return (
    <div className="flex-1 min-h-screen bg-gray-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-7 h-7 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Employee Reports</h1>
            <p className="text-gray-400 text-sm">Time tracking analytics across all dimensions</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Date range */}
          <div className="flex items-center gap-2 bg-gray-900 border border-white/10 rounded-lg px-3 py-1.5">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-transparent text-white text-sm focus:outline-none"
            />
            <span className="text-gray-500 text-sm">→</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-transparent text-white text-sm focus:outline-none"
            />
          </div>
          <button
            onClick={() => fetchReport(tab)}
            disabled={loading}
            className="p-2 rounded-lg bg-gray-900 border border-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Overview stats — always visible */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <StatCard icon={Clock} label="Total Hours" value={fmtDuration(overview.totalMinutes)} color="text-blue-400" />
          <StatCard icon={Activity} label="Total Sessions" value={overview.totalSessions} color="text-purple-400" />
          <StatCard icon={TrendingUp} label="Active Now" value={overview.activeSessions} sub={`checked in`} color="text-green-400" />
          <StatCard icon={UserCheck} label="Employees" value={overview.uniqueEmployees} color="text-yellow-400" />
          <StatCard icon={FolderKanban} label="Projects" value={overview.uniqueProjects} color="text-pink-400" />
          <StatCard icon={Hammer} label="Workshops" value={overview.uniqueWorkshops} color="text-orange-400" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-900/60 rounded-xl p-1 border border-white/10 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? "bg-white/10 text-white" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 mb-4 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading report data…
        </div>
      )}

      {/* OVERVIEW TAB */}
      {tab === "overview" && overview && (
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-xl border border-white/10 p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-400" /> Recent Activity
            </h3>
            {overview.recentActivity.length === 0 ? (
              <p className="text-gray-500 text-sm">No activity in this date range</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
                      <th className="text-left py-2 font-medium pr-4">Employee</th>
                      <th className="text-left py-2 font-medium pr-4">Workshop</th>
                      <th className="text-left py-2 font-medium pr-4">Project</th>
                      <th className="text-left py-2 font-medium pr-4">Task</th>
                      <th className="text-left py-2 font-medium pr-4">Check In</th>
                      <th className="text-left py-2 font-medium pr-4">Duration</th>
                      <th className="text-left py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recentActivity.map((l, i) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="py-2.5 pr-4 text-white font-medium">{l.employeeName ?? "—"} <span className="text-gray-500 font-mono text-xs">#{l.employeeCode}</span></td>
                        <td className="py-2.5 pr-4 text-gray-400">{l.workshopName ?? "—"}</td>
                        <td className="py-2.5 pr-4 text-gray-400">{l.projectName ?? "—"}</td>
                        <td className="py-2.5 pr-4 text-gray-400">{l.taskName ?? "—"}</td>
                        <td className="py-2.5 pr-4 text-gray-500 text-xs font-mono">
                          {new Date(l.checkInAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="py-2.5 pr-4 font-semibold text-white">{fmtDuration(l.durationMinutes ?? 0)}</td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${l.status === "active" ? "bg-green-500/20 text-green-400" : "bg-gray-700 text-gray-400"}`}>
                            {l.status === "active" ? "Active" : "Done"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EMPLOYEE TAB */}
      {tab === "employee" && (
        <div className="bg-gray-900 rounded-xl border border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
            <h3 className="text-white font-semibold flex items-center gap-2"><Users className="w-4 h-4 text-blue-400" /> Employee Breakdown</h3>
            <div className="flex gap-2">
              <button onClick={() => setEmpSort("minutes")} className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${empSort === "minutes" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}>By Hours</button>
              <button onClick={() => setEmpSort("sessions")} className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${empSort === "sessions" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}>By Sessions</button>
            </div>
          </div>
          {empData.length === 0 ? (
            <div className="text-center py-16 text-gray-500 text-sm">No data for this date range</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-medium">Employee</th>
                  <th className="text-left px-4 py-3 font-medium">Department</th>
                  <th className="text-left px-4 py-3 font-medium">Total Hours</th>
                  <th className="text-left px-4 py-3 font-medium">Sessions</th>
                  <th className="text-left px-4 py-3 font-medium">Avg/Session</th>
                  <th className="text-left px-4 py-3 font-medium">Distribution</th>
                  {overview && overview.activeSessions > 0 && <th className="px-4 py-3 font-medium">Status</th>}
                </tr>
              </thead>
              <tbody>
                {[...empData].sort((a, b) => b[empSort] - a[empSort]).map((e, i, arr) => (
                  <tr key={e.employeeId} className={`border-b border-white/5 hover:bg-white/[0.02] ${i === arr.length - 1 ? "border-b-0" : ""}`}>
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/employees/${e.employeeId}`} className="flex items-center gap-2.5 hover:opacity-80">
                        <div className="w-7 h-7 rounded-lg bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-blue-400 font-bold text-xs">{e.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-white font-medium">{e.name}</p>
                          <p className="text-gray-500 text-xs font-mono">{e.code}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{e.department ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold text-white">{fmtDuration(e.minutes)}</td>
                    <td className="px-4 py-3 text-gray-300">{e.sessions}</td>
                    <td className="px-4 py-3 text-gray-400">{e.sessions > 0 ? fmtDuration(Math.round(e.minutes / e.sessions)) : "—"}</td>
                    <td className="px-4 py-3"><Bar value={e.minutes} max={maxEmpMins} color="bg-blue-500" /></td>
                    {overview && overview.activeSessions > 0 && (
                      <td className="px-4 py-3">
                        {e.active > 0 && <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400 animate-pulse">Active</span>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* PROJECT TAB */}
      {tab === "project" && (
        <div className="bg-gray-900 rounded-xl border border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
            <h3 className="text-white font-semibold flex items-center gap-2"><FolderKanban className="w-4 h-4 text-purple-400" /> Project Breakdown</h3>
            <div className="flex gap-2">
              <button onClick={() => setProjSort("minutes")} className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${projSort === "minutes" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}>By Hours</button>
              <button onClick={() => setProjSort("sessions")} className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${projSort === "sessions" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}>By Sessions</button>
            </div>
          </div>
          {projData.length === 0 ? (
            <div className="text-center py-16 text-gray-500 text-sm">No data for this date range</div>
          ) : (
            <div>
              {[...projData].sort((a, b) => b[projSort] - a[projSort]).map((p, i, arr) => (
                <div key={p.projectId} className={`${i < arr.length - 1 ? "border-b border-white/5" : ""}`}>
                  <div
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] cursor-pointer"
                    onClick={() => setExpandedProj(expandedProj === p.projectId ? null : p.projectId)}
                  >
                    <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                      <FolderKanban className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium">{p.name}</p>
                      <p className="text-gray-500 text-xs">{p.taskBreakdown.length} tasks · {p.uniqueEmployees} employees</p>
                    </div>
                    <span className="text-white font-bold text-sm">{fmtDuration(p.minutes)}</span>
                    <span className="text-gray-400 text-sm">{p.sessions} sessions</span>
                    <Bar value={p.minutes} max={maxProjMins} color="bg-purple-500" />
                  </div>
                  {expandedProj === p.projectId && p.taskBreakdown.length > 0 && (
                    <div className="border-t border-white/5 bg-gray-950/30 px-14 py-2">
                      {p.taskBreakdown.sort((a, b) => b.minutes - a.minutes).map((t) => (
                        <div key={t.taskId} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-600 flex-shrink-0" />
                          <span className="text-gray-300 text-sm flex-1">{t.name}</span>
                          <span className="text-gray-400 text-sm">{fmtDuration(t.minutes)}</span>
                          <span className="text-gray-500 text-xs">{t.sessions}x</span>
                          <Bar value={t.minutes} max={p.minutes} color="bg-purple-400" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* WORKSHOP TAB */}
      {tab === "workshop" && (
        <div className="bg-gray-900 rounded-xl border border-white/10 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10">
            <h3 className="text-white font-semibold flex items-center gap-2"><Hammer className="w-4 h-4 text-orange-400" /> Workshop Breakdown</h3>
          </div>
          {wsData.length === 0 ? (
            <div className="text-center py-16 text-gray-500 text-sm">No data for this date range</div>
          ) : (
            <div>
              {[...wsData].sort((a, b) => b.minutes - a.minutes).map((w, i, arr) => (
                <div key={w.workshopId} className={`${i < arr.length - 1 ? "border-b border-white/5" : ""}`}>
                  <div
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] cursor-pointer"
                    onClick={() => setExpandedWs(expandedWs === w.workshopId ? null : w.workshopId)}
                  >
                    <div className="w-7 h-7 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                      <Hammer className="w-3.5 h-3.5 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium">{w.name}</p>
                      <p className="text-gray-500 text-xs">{w.projectBreakdown.length} projects · {w.uniqueEmployees} employees</p>
                    </div>
                    <span className="text-white font-bold text-sm">{fmtDuration(w.minutes)}</span>
                    <span className="text-gray-400 text-sm">{w.sessions} sessions</span>
                    <Bar value={w.minutes} max={maxWsMins} color="bg-orange-500" />
                  </div>
                  {expandedWs === w.workshopId && w.projectBreakdown.length > 0 && (
                    <div className="border-t border-white/5 bg-gray-950/30 px-14 py-2">
                      {w.projectBreakdown.sort((a, b) => b.minutes - a.minutes).map((p) => (
                        <div key={p.projectId} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-600 flex-shrink-0" />
                          <span className="text-gray-300 text-sm flex-1">{p.name}</span>
                          <span className="text-gray-400 text-sm">{fmtDuration(p.minutes)}</span>
                          <Bar value={p.minutes} max={w.minutes} color="bg-orange-400" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TASK TAB */}
      {tab === "task" && (
        <div className="bg-gray-900 rounded-xl border border-white/10 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10">
            <h3 className="text-white font-semibold flex items-center gap-2"><ListTodo className="w-4 h-4 text-pink-400" /> Task Breakdown</h3>
          </div>
          {taskData.length === 0 ? (
            <div className="text-center py-16 text-gray-500 text-sm">No data for this date range</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-medium">Task</th>
                  <th className="text-left px-4 py-3 font-medium">Project</th>
                  <th className="text-left px-4 py-3 font-medium">Total Hours</th>
                  <th className="text-left px-4 py-3 font-medium">Sessions</th>
                  <th className="text-left px-4 py-3 font-medium">Employees</th>
                  <th className="text-left px-4 py-3 font-medium">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {[...taskData].sort((a, b) => b.minutes - a.minutes).map((t, i, arr) => (
                  <tr key={t.taskId} className={`border-b border-white/5 hover:bg-white/[0.02] ${i === arr.length - 1 ? "border-b-0" : ""}`}>
                    <td className="px-5 py-3 text-white font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{t.projectName}</td>
                    <td className="px-4 py-3 font-semibold text-white">{fmtDuration(t.minutes)}</td>
                    <td className="px-4 py-3 text-gray-300">{t.sessions}</td>
                    <td className="px-4 py-3 text-gray-400">{t.uniqueEmployees}</td>
                    <td className="px-4 py-3"><Bar value={t.minutes} max={maxTaskMins} color="bg-pink-500" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Export hint */}
      <div className="mt-4 flex items-center gap-2 text-gray-600 text-xs">
        <Download className="w-3.5 h-3.5" />
        <span>Use browser Print (Ctrl/Cmd+P) to save as PDF or export this report</span>
      </div>
    </div>
  );
}
