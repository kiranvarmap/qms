"use client";

import { useEffect, useState, useRef } from "react";
import { X, ClipboardList, Clock, Link2, Loader2, CheckCircle2, AlertCircle, Plus, MessageSquare, Send, Pencil, Trash2, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface LinkedInspection {
  inspectionId: string;
  title: string;
  site: string | null;
  status: string;
  score: number | null;
  startedAt: string;
  completedAt: string | null;
  templateTitle: string;
  linkedAt: string;
}
interface LinkedTimeLog {
  timeLogId: string;
  employeeName: string;
  employeeCode: string;
  projectName: string | null;
  taskName: string | null;
  checkInAt: string;
  checkOutAt: string | null;
  durationMinutes: number | null;
  notes: string | null;
  status: string;
  linkedAt: string;
}
interface AvailableInspection { id: string; title: string; status: string; score: number | null; completedAt: string | null; }
interface AvailableTimeLog { id: string; employeeName: string; checkInAt: string; checkOutAt: string | null; durationMinutes: number | null; status: string; }
interface Comment { id: string; content: string; userId: string; userName: string | null; userImage: string | null; createdAt: string; updatedAt: string; }
interface ActivityEntry { id: string; action: string; details: Record<string, unknown>; createdAt: string; userId: string; userName: string | null; }

interface ItemDetailPanelProps {
  itemId: string;
  itemName: string;
  boardId: string;
  currentUserId?: string;
  startDate?: string | null;
  endDate?: string | null;
  onDatesChanged?: () => void;
  onClose: () => void;
}

function formatDuration(minutes: number | null) {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function formatRelative(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
function Avatar({ name, image, size = 7 }: { name: string | null; image?: string | null; size?: number }) {
  const initials = (name ?? "?").charAt(0).toUpperCase();
  const s = `w-${size} h-${size}`;
  if (image) return <img src={image} alt={name ?? ""} className={cn(s, "rounded-full object-cover flex-shrink-0")} />;
  return <div className={cn(s, "rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0")}>{initials}</div>;
}

export function ItemDetailPanel({ itemId, itemName, boardId, currentUserId, startDate, endDate, onDatesChanged, onClose }: ItemDetailPanelProps) {
  type Tab = "comments" | "inspections" | "timelogs" | "activity";
  const [activeTab, setActiveTab] = useState<Tab>("comments");
  const [start, setStart] = useState((startDate ?? "").slice(0, 10));
  const [end, setEnd] = useState((endDate ?? "").slice(0, 10));

  const saveDates = async (next: { startDate?: string | null; endDate?: string | null }) => {
    await fetch(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    }).catch(() => {});
    onDatesChanged?.();
  };
  const [inspections, setInspections] = useState<LinkedInspection[]>([]);
  const [timeLogs, setTimeLogs] = useState<LinkedTimeLog[]>([]);
  const [loadingInspections, setLoadingInspections] = useState(false);
  const [loadingTimeLogs, setLoadingTimeLogs] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [showLinkInspection, setShowLinkInspection] = useState(false);
  const [showLinkTimeLog, setShowLinkTimeLog] = useState(false);
  const [availableInspections, setAvailableInspections] = useState<AvailableInspection[]>([]);
  const [availableTimeLogs, setAvailableTimeLogs] = useState<AvailableTimeLog[]>([]);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    setLoadingComments(true);
    fetch(`/api/items/${itemId}/comments`).then(r => r.json()).then(setComments).finally(() => setLoadingComments(false));
  }, [itemId]);

  useEffect(() => {
    if (activeTab === "inspections" && inspections.length === 0) {
      setLoadingInspections(true);
      fetch(`/api/items/${itemId}/inspections`).then(r => r.json()).then(setInspections).finally(() => setLoadingInspections(false));
    }
    if (activeTab === "timelogs" && timeLogs.length === 0) {
      setLoadingTimeLogs(true);
      fetch(`/api/items/${itemId}/timelogs`).then(r => r.json()).then(setTimeLogs).finally(() => setLoadingTimeLogs(false));
    }
    if (activeTab === "activity") {
      setLoadingActivity(true);
      fetch(`/api/boards/${boardId}/activity?itemId=${itemId}`).then(r => r.json()).then(setActivity).finally(() => setLoadingActivity(false));
    }
  }, [activeTab, itemId, boardId]);

  const submitComment = async () => {
    if (!commentText.trim() || submittingComment) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/items/${itemId}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: commentText.trim() }) });
      if (res.ok) { const c = await res.json(); setComments(p => [...p, c]); setCommentText(""); setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50); }
    } finally { setSubmittingComment(false); }
  };
  const saveEdit = async (id: string) => {
    if (!editText.trim()) return;
    const res = await fetch(`/api/comments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: editText.trim() }) });
    if (res.ok) { setComments(p => p.map(c => c.id === id ? { ...c, content: editText.trim() } : c)); setEditingId(null); }
  };
  const deleteComment = async (id: string) => {
    await fetch(`/api/comments/${id}`, { method: "DELETE" }); setComments(p => p.filter(c => c.id !== id));
  };
  const linkInspection = async (inspectionId: string) => {
    setLinking(true);
    try {
      await fetch(`/api/items/${itemId}/inspections`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inspectionId }) });
      setInspections(await fetch(`/api/items/${itemId}/inspections`).then(r => r.json())); setShowLinkInspection(false);
    } finally { setLinking(false); }
  };
  const unlinkInspection = async (inspectionId: string) => {
    await fetch(`/api/items/${itemId}/inspections?inspectionId=${inspectionId}`, { method: "DELETE" }); setInspections(p => p.filter(i => i.inspectionId !== inspectionId));
  };
  const linkTimeLog = async (timeLogId: string) => {
    setLinking(true);
    try {
      await fetch(`/api/items/${itemId}/timelogs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timeLogId }) });
      setTimeLogs(await fetch(`/api/items/${itemId}/timelogs`).then(r => r.json())); setShowLinkTimeLog(false);
    } finally { setLinking(false); }
  };
  const unlinkTimeLog = async (timeLogId: string) => {
    await fetch(`/api/items/${itemId}/timelogs?timeLogId=${timeLogId}`, { method: "DELETE" }); setTimeLogs(p => p.filter(t => t.timeLogId !== timeLogId));
  };

  const tabs = [
    { id: "comments" as Tab, label: "Comments", icon: <MessageSquare className="h-3.5 w-3.5" />, count: comments.length },
    { id: "inspections" as Tab, label: "Inspections", icon: <ClipboardList className="h-3.5 w-3.5" />, count: inspections.length },
    { id: "timelogs" as Tab, label: "Time", icon: <Clock className="h-3.5 w-3.5" />, count: timeLogs.length },
    { id: "activity" as Tab, label: "Activity", icon: <Activity className="h-3.5 w-3.5" /> },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[500px] z-50 bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 truncate">{itemName}</h2>
            <p className="text-xs text-gray-600 mt-0.5">Item details</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><X className="h-4 w-4" /></button>
        </div>

        {/* Schedule: Start / End date (powers Gantt & Calendar) */}
        <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex flex-col">
            <label className="text-[11px] uppercase tracking-wider text-gray-600 font-medium mb-1">Start date</label>
            <input
              type="date"
              value={start}
              onChange={(e) => { setStart(e.target.value); saveDates({ startDate: e.target.value || null }); }}
              className="text-sm border border-gray-300 rounded px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[11px] uppercase tracking-wider text-gray-600 font-medium mb-1">End date</label>
            <input
              type="date"
              value={end}
              min={start || undefined}
              onChange={(e) => { setEnd(e.target.value); saveDates({ endDate: e.target.value || null }); }}
              className="text-sm border border-gray-300 rounded px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="border-b border-gray-200 flex px-5 flex-shrink-0 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn("py-3 px-1 text-xs font-medium border-b-2 flex items-center gap-1 transition-colors whitespace-nowrap mr-5",
                activeTab === tab.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              {tab.icon}{tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full font-semibold">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
          {activeTab === "comments" && (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {loadingComments ? (
                  <div className="flex items-center gap-2 text-gray-600 text-sm py-8 justify-center"><Loader2 className="h-4 w-4 animate-spin" />Loading...</div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-8"><MessageSquare className="h-8 w-8 text-gray-900 mx-auto mb-2" /><p className="text-sm text-gray-600">No comments yet.</p></div>
                ) : comments.map(comment => (
                  <div key={comment.id} className="flex gap-3 group">
                    <Avatar name={comment.userName} image={comment.userImage} size={7} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">{comment.userName ?? "Unknown"}</span>
                        <span className="text-xs text-gray-600">{formatRelative(comment.createdAt)}</span>
                        {comment.updatedAt !== comment.createdAt && <span className="text-xs text-gray-700">(edited)</span>}
                      </div>
                      {editingId === comment.id ? (
                        <div className="space-y-2">
                          <textarea value={editText} onChange={e => setEditText(e.target.value)}
                            className="w-full text-sm border border-gray-300 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} autoFocus />
                          <div className="flex gap-2">
                            <button onClick={() => saveEdit(comment.id)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md font-medium hover:bg-blue-700">Save</button>
                            <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 px-3 py-1.5 rounded-md hover:bg-gray-100">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap break-words">{comment.content}</div>
                      )}
                    </div>
                    {currentUserId === comment.userId && editingId !== comment.id && (
                      <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0 pt-1">
                        <button onClick={() => { setEditingId(comment.id); setEditText(comment.content); }} className="p-1 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-600"><Pencil className="h-3 w-3" /></button>
                        <button onClick={() => deleteComment(comment.id)} className="p-1 rounded hover:bg-red-50 text-gray-600 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={commentsEndRef} />
              </div>
              <div className="border-t border-gray-200 p-4 flex-shrink-0 flex gap-3">
                <div className="flex-1">
                  <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitComment(); } }}
                    placeholder="Write a comment... (Ctrl+Enter to send)"
                    className="w-full text-sm border border-gray-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} />
                </div>
                <button onClick={submitComment} disabled={!commentText.trim() || submittingComment}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 self-end">
                  {submittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {activeTab === "inspections" && (
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Linked Inspections</h3>
                <button onClick={() => { setShowLinkInspection(true); fetch("/api/inspections?limit=50").then(r => r.json()).then(setAvailableInspections); }}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                  <Link2 className="h-3.5 w-3.5" />Link Inspection
                </button>
              </div>
              {loadingInspections ? (
                <div className="flex items-center gap-2 text-gray-600 text-sm py-4 justify-center"><Loader2 className="h-4 w-4 animate-spin" />Loading...</div>
              ) : inspections.length === 0 ? (
                <p className="text-sm text-gray-600 py-6 text-center">No inspections linked yet.</p>
              ) : inspections.map(insp => (
                <div key={insp.inspectionId} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        {insp.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <AlertCircle className="h-3.5 w-3.5 text-amber-500" />}
                        <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", insp.status === "completed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>
                          {insp.status === "completed" ? "Completed" : "In Progress"}
                        </span>
                        {insp.score != null && <span className="text-xs text-gray-500">Score: <strong>{insp.score.toFixed(1)}%</strong></span>}
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">{insp.title}</p>
                      <p className="text-xs text-gray-600">{insp.templateTitle}</p>
                    </div>
                    <button onClick={() => unlinkInspection(insp.inspectionId)} className="p-1 rounded hover:bg-red-50 text-gray-700 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "timelogs" && (
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Linked Time Logs</h3>
                <button onClick={() => { setShowLinkTimeLog(true); fetch("/api/time-logs?limit=50").then(r => r.json()).then(setAvailableTimeLogs); }}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                  <Link2 className="h-3.5 w-3.5" />Link Time Log
                </button>
              </div>
              {timeLogs.length > 0 && (
                <div className="bg-blue-50 rounded-lg p-3 flex items-center gap-3">
                  <Clock className="h-5 w-5 text-blue-500" />
                  <div><p className="text-xs text-blue-600 font-medium">Total tracked</p><p className="text-base font-semibold text-blue-800">{formatDuration(timeLogs.reduce((a, t) => a + (t.durationMinutes ?? 0), 0))}</p></div>
                </div>
              )}
              {loadingTimeLogs ? (
                <div className="flex items-center gap-2 text-gray-600 text-sm py-4 justify-center"><Loader2 className="h-4 w-4 animate-spin" />Loading...</div>
              ) : timeLogs.length === 0 ? (
                <p className="text-sm text-gray-600 py-6 text-center">No time logs linked yet.</p>
              ) : timeLogs.map(log => (
                <div key={log.timeLogId} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">{log.employeeName.charAt(0)}</div>
                        <span className="text-sm font-medium text-gray-900">{log.employeeName}</span>
                        <span className="text-xs text-gray-600">#{log.employeeCode}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-semibold text-gray-700">{formatDuration(log.durationMinutes)}</span>
                        <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", log.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                          {log.status === "active" ? "Active" : "Completed"}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => unlinkTimeLog(log.timeLogId)} className="p-1 rounded hover:bg-red-50 text-gray-700 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "activity" && (
            <div className="p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Activity</h3>
              {loadingActivity ? (
                <div className="flex items-center gap-2 text-gray-600 text-sm py-8 justify-center"><Loader2 className="h-4 w-4 animate-spin" />Loading...</div>
              ) : activity.length === 0 ? (
                <div className="text-center py-8"><Activity className="h-8 w-8 text-gray-900 mx-auto mb-2" /><p className="text-sm text-gray-600">No activity recorded yet.</p></div>
              ) : activity.map(entry => (
                <div key={entry.id} className="flex gap-3">
                  <Avatar name={entry.userName} size={6} />
                  <div><p className="text-sm text-gray-700"><span className="font-medium">{entry.userName ?? "System"}</span> <span className="text-gray-500">{entry.action}</span></p><p className="text-xs text-gray-600">{formatRelative(entry.createdAt)}</p></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showLinkInspection && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/30" onClick={() => setShowLinkInspection(false)} />
          <div className="fixed z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] bg-white rounded-xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between"><h3 className="font-semibold">Link an Inspection</h3><button onClick={() => setShowLinkInspection(false)} className="p-1 rounded hover:bg-gray-100"><X className="h-4 w-4 text-gray-500" /></button></div>
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
              {availableInspections.length === 0 ? <p className="p-5 text-sm text-gray-600 text-center">No inspections available.</p> : availableInspections.map(insp => (
                <button key={insp.id} disabled={linking || inspections.some(i => i.inspectionId === insp.id)} onClick={() => linkInspection(insp.id)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 disabled:opacity-50 text-left">
                  <div><p className="text-sm font-medium">{insp.title}</p><p className="text-xs text-gray-600">{insp.status === "completed" ? "Completed" : "In Progress"}</p></div>
                  {inspections.some(i => i.inspectionId === insp.id) ? <span className="text-xs text-green-600 font-medium">Linked</span> : <Plus className="h-4 w-4 text-gray-600" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {showLinkTimeLog && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/30" onClick={() => setShowLinkTimeLog(false)} />
          <div className="fixed z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] bg-white rounded-xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between"><h3 className="font-semibold">Link a Time Log</h3><button onClick={() => setShowLinkTimeLog(false)} className="p-1 rounded hover:bg-gray-100"><X className="h-4 w-4 text-gray-500" /></button></div>
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
              {availableTimeLogs.length === 0 ? <p className="p-5 text-sm text-gray-600 text-center">No time logs available.</p> : availableTimeLogs.map(log => (
                <button key={log.id} disabled={linking || timeLogs.some(t => t.timeLogId === log.id)} onClick={() => linkTimeLog(log.id)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 disabled:opacity-50 text-left">
                  <div><p className="text-sm font-medium">{log.employeeName}</p><p className="text-xs text-gray-600">{formatDate(log.checkInAt)}</p></div>
                  {timeLogs.some(t => t.timeLogId === log.id) ? <span className="text-xs text-green-600 font-medium">Linked</span> : <Plus className="h-4 w-4 text-gray-600" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
