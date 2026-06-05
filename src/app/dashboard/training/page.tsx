"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { GraduationCap, Plus, Award, X, AlertCircle } from "lucide-react";

interface Workspace { id: string; name: string }
interface Course { id: string; title: string; category: string | null; isPublished: boolean }
interface Cert { id: string; name: string; validityMonths: number }
interface CertRecord { id: string; employeeName: string | null; certificationName: string | null; status: string; expiresAt: string | null }

const certColors: Record<string, string> = {
  valid: "bg-green-500/20 text-green-600",
  expiring: "bg-amber-500/20 text-amber-600",
  expired: "bg-red-500/20 text-red-600",
};

export default function TrainingPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [records, setRecords] = useState<CertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCourse, setShowCourse] = useState(false);
  const [courseForm, setCourseForm] = useState({ title: "", category: "", description: "" });
  const [showCert, setShowCert] = useState(false);
  const [certForm, setCertForm] = useState({ name: "", validityMonths: "12", requiresCourseId: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((data: Workspace[]) => {
      setWorkspaces(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length > 0) setWorkspaceId(data[0].id); else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const [c, ce, r] = await Promise.all([
      fetch(`/api/courses?workspaceId=${workspaceId}`).then((x) => x.json()).catch(() => ({})),
      fetch(`/api/certifications?workspaceId=${workspaceId}`).then((x) => x.json()).catch(() => ({})),
      fetch(`/api/certification-records?workspaceId=${workspaceId}`).then((x) => x.json()).catch(() => ({})),
    ]);
    setCourses(Array.isArray(c.data) ? c.data : []);
    setCerts(Array.isArray(ce.data) ? ce.data : []);
    setRecords(Array.isArray(r.data) ? r.data : []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const createCourse = async () => {
    if (!courseForm.title.trim()) { setError("Title is required"); return; }
    const res = await fetch("/api/courses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, title: courseForm.title.trim(), category: courseForm.category.trim() || undefined, description: courseForm.description.trim() || undefined }) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed"); return; }
    setShowCourse(false); setCourseForm({ title: "", category: "", description: "" }); load();
  };

  const createCert = async () => {
    if (!certForm.name.trim()) { setError("Name is required"); return; }
    const res = await fetch("/api/certifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, name: certForm.name.trim(), validityMonths: Number(certForm.validityMonths) || 0, requiresCourseId: certForm.requiresCourseId || undefined }) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed"); return; }
    setShowCert(false); setCertForm({ name: "", validityMonths: "12", requiresCourseId: "" }); load();
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><GraduationCap className="h-6 w-6 text-blue-600" /><h1 className="text-xl font-semibold text-gray-900">Training</h1></div>
        <button onClick={() => { setError(""); setShowCourse(true); }} disabled={!workspaceId} className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-md"><Plus className="h-4 w-4" /> New Course</button>
      </div>

      <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.length === 0 && <option value="">No workspaces</option>}
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Courses</h2>
          <div className="grid grid-cols-2 gap-3">
            {loading ? <p className="text-gray-500 text-sm">Loading…</p> : courses.length === 0 ? <p className="text-gray-500 text-sm">No courses yet.</p> : courses.map((c) => (
              <Link key={c.id} href={`/dashboard/training/${c.id}`} className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-200">
                <div className="flex items-start justify-between">
                  <h3 className="text-gray-900 font-medium">{c.title}</h3>
                  {!c.isPublished && <span className="text-xs text-amber-600">draft</span>}
                </div>
                <p className="text-xs text-gray-500 mt-1">{c.category ?? "Uncategorized"}</p>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700"><Award className="h-4 w-4" /> Certifications</h2>
            <button onClick={() => { setError(""); setShowCert(true); }} className="text-xs text-blue-600 hover:text-blue-600">+ Define</button>
          </div>
          <div className="space-y-1 mb-4">
            {certs.map((c) => <div key={c.id} className="text-sm text-gray-600 bg-white border border-gray-200 rounded-md px-3 py-2">{c.name} <span className="text-gray-600">· {c.validityMonths ? `${c.validityMonths}mo` : "no expiry"}</span></div>)}
            {certs.length === 0 && <p className="text-xs text-gray-600">None defined.</p>}
          </div>
          <h3 className="text-xs font-semibold text-gray-600 mb-2">Register</h3>
          <div className="space-y-1">
            {records.length === 0 ? <p className="text-xs text-gray-600">No certifications issued.</p> : records.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs bg-white border border-gray-200 rounded-md px-3 py-2">
                <span className="text-gray-700 truncate">{r.employeeName} · {r.certificationName}</span>
                <span className={`px-1.5 py-0.5 rounded ${certColors[r.status] ?? ""}`}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showCourse && (
        <Modal title="New Course" onClose={() => setShowCourse(false)} error={error}>
          <div className="space-y-3">
            <Field label="Title *" value={courseForm.title} onChange={(v) => setCourseForm({ ...courseForm, title: v })} />
            <Field label="Category" value={courseForm.category} onChange={(v) => setCourseForm({ ...courseForm, category: v })} />
            <label className="block"><span className="text-xs text-gray-500">Description</span><textarea value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} rows={2} className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
          </div>
          <Actions onCancel={() => setShowCourse(false)} onSave={createCourse} />
        </Modal>
      )}
      {showCert && (
        <Modal title="Define Certification" onClose={() => setShowCert(false)} error={error}>
          <div className="space-y-3">
            <Field label="Name *" value={certForm.name} onChange={(v) => setCertForm({ ...certForm, name: v })} />
            <Field label="Validity (months, 0 = none)" value={certForm.validityMonths} onChange={(v) => setCertForm({ ...certForm, validityMonths: v })} type="number" />
            <label className="block"><span className="text-xs text-gray-500">Auto-issue on course completion</span>
              <select value={certForm.requiresCourseId} onChange={(e) => setCertForm({ ...certForm, requiresCourseId: e.target.value })} className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900"><option value="">None</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
            </label>
          </div>
          <Actions onCancel={() => setShowCert(false)} onSave={createCert} />
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, error, children }: { title: string; onClose: () => void; error: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white border border-gray-200 rounded-lg w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-900">{title}</h2><button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X className="h-5 w-5" /></button></div>
        {error && <div className="mb-3 flex items-center gap-2 text-sm text-red-600 bg-red-500/10 rounded-md px-3 py-2"><AlertCircle className="h-4 w-4" /> {error}</div>}
        {children}
      </div>
    </div>
  );
}
function Actions({ onCancel, onSave }: { onCancel: () => void; onSave: () => void }) {
  return <div className="flex justify-end gap-2 mt-5"><button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button><button onClick={onSave} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md">Save</button></div>;
}
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return <label className="block"><span className="text-xs text-gray-500">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900" /></label>;
}
