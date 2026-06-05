"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Search, UserCog, Pencil, Trash2, X, Check, AlertCircle } from "lucide-react";
import type { Employee } from "@/lib/types";

const DEPARTMENTS = ["Engineering", "Production", "Quality", "Maintenance", "Logistics", "Administration", "HR", "Finance"];
const STATUSES = ["active", "inactive", "on_leave"] as const;

const statusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-600",
  inactive: "bg-gray-600/40 text-gray-600",
  on_leave: "bg-yellow-500/20 text-yellow-600",
};

const statusLabels: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  on_leave: "On Leave",
};

const emptyForm = {
  employeeId: "",
  name: "",
  email: "",
  phone: "",
  department: "",
  designation: "",
  joiningDate: "",
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/employees");
    const data = await res.json();
    setEmployees(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  };

  const openEdit = (emp: Employee) => {
    setEditTarget(emp);
    setForm({
      employeeId: emp.employeeId,
      name: emp.name,
      email: emp.email ?? "",
      phone: emp.phone ?? "",
      department: emp.department ?? "",
      designation: emp.designation ?? "",
      joiningDate: emp.joiningDate ? emp.joiningDate.split("T")[0] : "",
    });
    setError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.employeeId.trim() || !form.name.trim()) {
      setError("Employee ID and Full Name are required.");
      return;
    }
    setSaving(true);
    setError("");

    const method = editTarget ? "PATCH" : "POST";
    const url = editTarget ? `/api/employees/${editTarget.id}` : "/api/employees";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setShowModal(false);
      load();
    } else {
      const d = await res.json();
      setError(d.error ?? "Failed to save.");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/employees/${id}`, { method: "DELETE" });
    setDeleteConfirm(null);
    load();
  };

  const filtered = employees.filter((e) => {
    const matchSearch =
      !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.employeeId.toLowerCase().includes(search.toLowerCase()) ||
      (e.department ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="flex-1 min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <UserCog className="w-7 h-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
            <p className="text-gray-600 text-sm">{employees.length} total · {employees.filter((e) => e.status === "active").length} active</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID, department..."
            className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-gray-900 text-sm placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-gray-500 text-center py-20">Loading employees…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <UserCog className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{employees.length === 0 ? "No employees yet. Add your first employee." : "No employees match your search."}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">Employee</th>
                <th className="text-left px-4 py-3 font-medium">ID</th>
                <th className="text-left px-4 py-3 font-medium">Department</th>
                <th className="text-left px-4 py-3 font-medium">Designation</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp, i) => (
                <tr
                  key={emp.id}
                  className={`border-b border-gray-200 hover:bg-gray-50 ${i === filtered.length - 1 ? "border-b-0" : ""}`}
                >
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/employees/${emp.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                      <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-600 font-bold text-sm">{emp.name.charAt(0)}</span>
                      </div>
                      <span className="text-gray-900 font-medium">{emp.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-700">{emp.employeeId}</td>
                  <td className="px-4 py-3 text-gray-600">{emp.department ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{emp.designation ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[emp.status]}`}>
                      {statusLabels[emp.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => openEdit(emp)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(emp.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-600 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-gray-900 font-semibold">{editTarget ? "Edit Employee" : "Add Employee"}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-600 hover:text-gray-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-500/10 rounded-lg px-3 py-2 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-600 uppercase tracking-wider font-medium mb-1.5 block">Employee ID *</label>
                  <input
                    value={form.employeeId}
                    onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                    placeholder="e.g. EMP001"
                    disabled={!!editTarget}
                    className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 uppercase tracking-wider font-medium mb-1.5 block">Full Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="John Doe"
                    className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 uppercase tracking-wider font-medium mb-1.5 block">Email</label>
                  <input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="john@company.com"
                    type="email"
                    className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 uppercase tracking-wider font-medium mb-1.5 block">Phone</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+1 555 0100"
                    className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 uppercase tracking-wider font-medium mb-1.5 block">Department</label>
                  <select
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">— Select —</option>
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 uppercase tracking-wider font-medium mb-1.5 block">Designation</label>
                  <input
                    value={form.designation}
                    onChange={(e) => setForm({ ...form, designation: e.target.value })}
                    placeholder="Machine Operator"
                    className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 uppercase tracking-wider font-medium mb-1.5 block">Joining Date</label>
                  <input
                    type="date"
                    value={form.joiningDate}
                    onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
                    className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-100 text-gray-900 text-sm transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium flex items-center gap-2 transition-colors"
              >
                {saving ? <span className="animate-spin w-4 h-4 border-2 border-gray-200 border-t-transparent rounded-full" /> : <Check className="w-4 h-4" />}
                {editTarget ? "Save Changes" : "Add Employee"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl border border-red-500/20 p-6 w-full max-w-sm shadow-2xl text-center">
            <Trash2 className="w-10 h-10 text-red-600 mx-auto mb-3" />
            <h3 className="text-gray-900 font-semibold mb-1">Delete Employee?</h3>
            <p className="text-gray-600 text-sm mb-5">This will permanently delete the employee and all their time logs.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-100 text-gray-900 text-sm">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
