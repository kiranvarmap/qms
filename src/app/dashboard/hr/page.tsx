"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Users, Pencil, X, CalendarDays } from "lucide-react";

interface Workspace { id: string; name: string }
interface Department { id: string; name: string }
interface LeaveType { id: string; name: string; defaultDays: number }
interface Employee {
  id: string; name: string; email: string | null; employeeId: string; designation: string | null;
  employmentType: string | null; departmentId: string | null; departmentName: string | null;
  managerEmployeeId: string | null; managerName: string | null;
}

const EMP_TYPES = ["full_time", "part_time", "contract", "intern"];

export default function HrPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Employee | null>(null);
  const [form, setForm] = useState({ departmentId: "", managerEmployeeId: "", employmentType: "", designation: "" });
  const [newDept, setNewDept] = useState("");
  const [newLeave, setNewLeave] = useState({ name: "", defaultDays: "" });

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((data: Workspace[]) => {
      setWorkspaces(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length > 0) setWorkspaceId(data[0].id); else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const [e, d, l] = await Promise.all([
      fetch(`/api/hr/employees?workspaceId=${workspaceId}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/departments?workspaceId=${workspaceId}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/leave-types?workspaceId=${workspaceId}`).then((r) => r.json()).catch(() => ({})),
    ]);
    setEmployees(Array.isArray(e.data) ? e.data : []);
    setDepartments(Array.isArray(d.data) ? d.data : []);
    setLeaveTypes(Array.isArray(l.data) ? l.data : []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const openEdit = (emp: Employee) => {
    setEdit(emp);
    setForm({
      departmentId: emp.departmentId ?? "", managerEmployeeId: emp.managerEmployeeId ?? "",
      employmentType: emp.employmentType ?? "", designation: emp.designation ?? "",
    });
  };

  const saveEdit = async () => {
    if (!edit) return;
    await fetch(`/api/hr/employees/${edit.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        departmentId: form.departmentId || null,
        managerEmployeeId: form.managerEmployeeId || null,
        employmentType: form.employmentType || null,
        designation: form.designation || null,
      }),
    });
    setEdit(null); load();
  };

  const addDept = async () => {
    if (!newDept.trim()) return;
    await fetch("/api/departments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, name: newDept.trim() }) });
    setNewDept(""); load();
  };
  const addLeaveType = async () => {
    if (!newLeave.name.trim()) return;
    await fetch("/api/leave-types", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, name: newLeave.name.trim(), defaultDays: Number(newLeave.defaultDays) || 0 }) });
    setNewLeave({ name: "", defaultDays: "" }); load();
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><Users className="h-6 w-6 text-blue-400" /><h1 className="text-xl font-semibold text-white">HR Directory</h1></div>
        <Link href="/dashboard/leave" className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-300 hover:text-white border border-white/10 rounded-md"><CalendarDays className="h-4 w-4" /> Leave</Link>
      </div>

      <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-gray-900 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-200">
        {workspaces.length === 0 && <option value="">No workspaces</option>}
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-gray-900 border border-white/10 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b border-white/10">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Department</th>
              <th className="px-4 py-3 font-medium">Manager</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium text-right"></th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No employees.</td></tr>
              ) : employees.map((emp) => (
                <tr key={emp.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-gray-200">{emp.name}<div className="text-xs text-gray-500">{emp.designation ?? emp.employeeId}</div></td>
                  <td className="px-4 py-3 text-gray-400">{emp.departmentName ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{emp.managerName ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{emp.employmentType?.replace(/_/g, " ") ?? "—"}</td>
                  <td className="px-4 py-3 text-right"><button onClick={() => openEdit(emp)} className="p-1.5 text-gray-500 hover:text-gray-200"><Pencil className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-900 border border-white/10 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Departments</h3>
            <div className="space-y-1 mb-2">{departments.map((d) => <div key={d.id} className="text-sm text-gray-400">{d.name}</div>)}{departments.length === 0 && <p className="text-xs text-gray-600">None yet.</p>}</div>
            <div className="flex gap-2"><input value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="New department" className="flex-1 bg-gray-950 border border-white/10 rounded-md px-2 py-1.5 text-sm text-gray-200" /><button onClick={addDept} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-md">Add</button></div>
          </div>
          <div className="bg-gray-900 border border-white/10 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Leave types</h3>
            <div className="space-y-1 mb-2">{leaveTypes.map((l) => <div key={l.id} className="text-sm text-gray-400">{l.name} <span className="text-gray-600">· {l.defaultDays}d</span></div>)}{leaveTypes.length === 0 && <p className="text-xs text-gray-600">None yet.</p>}</div>
            <div className="flex gap-2"><input value={newLeave.name} onChange={(e) => setNewLeave({ ...newLeave, name: e.target.value })} placeholder="Name" className="flex-1 bg-gray-950 border border-white/10 rounded-md px-2 py-1.5 text-sm text-gray-200" /><input value={newLeave.defaultDays} onChange={(e) => setNewLeave({ ...newLeave, defaultDays: e.target.value })} type="number" placeholder="Days" className="w-16 bg-gray-950 border border-white/10 rounded-md px-2 py-1.5 text-sm text-gray-200" /><button onClick={addLeaveType} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-md">Add</button></div>
          </div>
        </div>
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setEdit(null)}>
          <div className="bg-gray-900 border border-white/10 rounded-lg w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-white">Edit — {edit.name}</h2><button onClick={() => setEdit(null)} className="text-gray-500 hover:text-gray-300"><X className="h-5 w-5" /></button></div>
            <div className="space-y-3">
              <label className="block"><span className="text-xs text-gray-500">Department</span>
                <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} className="mt-1 w-full bg-gray-950 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-200"><option value="">None</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
              </label>
              <label className="block"><span className="text-xs text-gray-500">Manager</span>
                <select value={form.managerEmployeeId} onChange={(e) => setForm({ ...form, managerEmployeeId: e.target.value })} className="mt-1 w-full bg-gray-950 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-200"><option value="">None</option>{employees.filter((x) => x.id !== edit.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
              </label>
              <label className="block"><span className="text-xs text-gray-500">Employment type</span>
                <select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })} className="mt-1 w-full bg-gray-950 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-200"><option value="">—</option>{EMP_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</select>
              </label>
              <label className="block"><span className="text-xs text-gray-500">Designation</span><input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} className="mt-1 w-full bg-gray-950 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-200" /></label>
            </div>
            <div className="flex justify-end gap-2 mt-5"><button onClick={() => setEdit(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200">Cancel</button><button onClick={saveEdit} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md">Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
