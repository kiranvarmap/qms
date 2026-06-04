"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Check, BookOpen, X, AlertCircle } from "lucide-react";

interface Lesson { id: string; title: string; contentType: string; contentText: string | null; contentUrl: string | null }
interface Course { id: string; workspaceId: string; title: string; description: string | null; category: string | null; isPublished: boolean; lessons: Lesson[] }
interface Employee { id: string; name: string }
interface Enrollment { id: string; employeeId: string; employeeName: string | null; status: string; progressPct: number }

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [enrollEmp, setEnrollEmp] = useState("");
  const [openEnrollment, setOpenEnrollment] = useState<string | null>(null);
  const [showLesson, setShowLesson] = useState(false);
  const [lessonForm, setLessonForm] = useState({ title: "", contentType: "text", contentText: "", contentUrl: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const c = await fetch(`/api/courses/${id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    setCourse(c);
    if (c) {
      const [e, emp] = await Promise.all([
        fetch(`/api/enrollments?workspaceId=${c.workspaceId}&courseId=${id}`).then((r) => r.json()).catch(() => ({})),
        fetch(`/api/employees`).then((r) => r.json()).catch(() => []),
      ]);
      setEnrollments(Array.isArray(e.data) ? e.data : []);
      setEmployees(Array.isArray(emp) ? emp : []);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const togglePublish = async () => {
    if (!course) return;
    await fetch(`/api/courses/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPublished: !course.isPublished }) });
    load();
  };

  const addLesson = async () => {
    if (!lessonForm.title.trim()) { setError("Title required"); return; }
    const res = await fetch(`/api/courses/${id}/lessons`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: lessonForm.title.trim(), contentType: lessonForm.contentType, contentText: lessonForm.contentText || undefined, contentUrl: lessonForm.contentUrl || undefined }) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed"); return; }
    setShowLesson(false); setLessonForm({ title: "", contentType: "text", contentText: "", contentUrl: "" }); load();
  };

  const enroll = async () => {
    if (!enrollEmp || !course) return;
    const res = await fetch("/api/enrollments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId: course.workspaceId, courseId: id, employeeId: enrollEmp }) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed"); return; }
    setEnrollEmp(""); load();
  };

  const complete = async (enrollmentId: string, lessonId: string) => {
    await fetch(`/api/enrollments/${enrollmentId}/progress`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lessonId }) });
    load();
  };

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (!course) return <div className="p-8 text-gray-500">Course not found.</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/dashboard/training" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 mb-4"><ArrowLeft className="h-4 w-4" /> Training</Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">{course.title}</h1>
          <p className="text-sm text-gray-400 mt-1">{course.category ?? "Uncategorized"}{course.description ? ` · ${course.description}` : ""}</p>
        </div>
        <button onClick={togglePublish} className={`px-3 py-1.5 text-xs font-medium rounded-md ${course.isPublished ? "bg-green-600/20 text-green-400" : "bg-blue-600 text-white hover:bg-blue-500"}`}>{course.isPublished ? "Published" : "Publish"}</button>
      </div>

      {error && <div className="mb-4 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-md px-3 py-2"><AlertCircle className="h-4 w-4" /> {error}</div>}

      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-300"><BookOpen className="h-4 w-4" /> Lessons</h2>
            <button onClick={() => { setError(""); setShowLesson(true); }} className="text-xs text-blue-400 hover:text-blue-300">+ Add lesson</button>
          </div>
          <div className="space-y-1">
            {course.lessons.length === 0 ? <p className="text-xs text-gray-600">No lessons yet.</p> : course.lessons.map((l, i) => (
              <div key={l.id} className="bg-gray-900 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-300">{i + 1}. {l.title} <span className="text-xs text-gray-600">· {l.contentType}</span></div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-300 mb-2">Enrollments</h2>
          <div className="flex gap-2 mb-3">
            <select value={enrollEmp} onChange={(e) => setEnrollEmp(e.target.value)} className="flex-1 bg-gray-950 border border-white/10 rounded-md px-3 py-1.5 text-sm text-gray-200"><option value="">Select employee…</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
            <button onClick={enroll} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-md inline-flex items-center gap-1"><Plus className="h-4 w-4" /> Enroll</button>
          </div>
          <div className="space-y-1">
            {enrollments.length === 0 ? <p className="text-xs text-gray-600">No one enrolled.</p> : enrollments.map((e) => (
              <div key={e.id} className="bg-gray-900 border border-white/10 rounded-md">
                <button onClick={() => setOpenEnrollment(openEnrollment === e.id ? null : e.id)} className="w-full flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-gray-200">{e.employeeName}</span>
                  <span className="flex items-center gap-2">
                    <span className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden"><span className="block h-full bg-blue-500" style={{ width: `${e.progressPct}%` }} /></span>
                    <span className="text-xs text-gray-500 w-8 text-right">{e.progressPct}%</span>
                  </span>
                </button>
                {openEnrollment === e.id && e.status !== "completed" && (
                  <div className="px-3 pb-2 space-y-1">
                    {course.lessons.map((l) => (
                      <div key={l.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-400 truncate">{l.title}</span>
                        <button onClick={() => complete(e.id, l.id)} className="inline-flex items-center gap-1 text-gray-500 hover:text-green-400"><Check className="h-3.5 w-3.5" /> Complete</button>
                      </div>
                    ))}
                  </div>
                )}
                {openEnrollment === e.id && e.status === "completed" && <div className="px-3 pb-2 text-xs text-green-400">Completed ✓</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showLesson && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowLesson(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-lg w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-white">Add Lesson</h2><button onClick={() => setShowLesson(false)} className="text-gray-500 hover:text-gray-300"><X className="h-5 w-5" /></button></div>
            <div className="space-y-3">
              <label className="block"><span className="text-xs text-gray-500">Title</span><input value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} className="mt-1 w-full bg-gray-950 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-200" /></label>
              <label className="block"><span className="text-xs text-gray-500">Type</span>
                <select value={lessonForm.contentType} onChange={(e) => setLessonForm({ ...lessonForm, contentType: e.target.value })} className="mt-1 w-full bg-gray-950 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-200"><option value="text">Text</option><option value="video">Video URL</option><option value="file">File URL</option></select>
              </label>
              {lessonForm.contentType === "text"
                ? <label className="block"><span className="text-xs text-gray-500">Content</span><textarea value={lessonForm.contentText} onChange={(e) => setLessonForm({ ...lessonForm, contentText: e.target.value })} rows={3} className="mt-1 w-full bg-gray-950 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-200" /></label>
                : <label className="block"><span className="text-xs text-gray-500">URL</span><input value={lessonForm.contentUrl} onChange={(e) => setLessonForm({ ...lessonForm, contentUrl: e.target.value })} className="mt-1 w-full bg-gray-950 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-200" /></label>}
            </div>
            <div className="flex justify-end gap-2 mt-5"><button onClick={() => setShowLesson(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200">Cancel</button><button onClick={addLesson} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md">Add</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
