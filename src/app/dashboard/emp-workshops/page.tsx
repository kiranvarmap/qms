"use client";

import { useEffect, useState, useCallback } from "react";
import { Hammer, Plus, Pencil, Trash2, X, Check, MapPin, AlertCircle } from "lucide-react";
import type { Workshop } from "@/lib/types";

const emptyForm = { name: "", location: "", description: "" };

export default function WorkshopsPage() {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Workshop | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/workshops");
    const data = await res.json();
    setWorkshops(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  };

  const openEdit = (ws: Workshop) => {
    setEditTarget(ws);
    setForm({ name: ws.name, location: ws.location ?? "", description: ws.description ?? "" });
    setError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError("");

    const method = editTarget ? "PUT" : "POST";
    const body = editTarget
      ? { id: editTarget.id, ...form }
      : form;

    const res = await fetch("/api/workshops", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) { setShowModal(false); load(); }
    else { const d = await res.json(); setError(d.error ?? "Failed to save."); }
    setSaving(false);
  };

  const handleToggleActive = async (ws: Workshop) => {
    await fetch("/api/workshops", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ws.id, isActive: !ws.isActive }),
    });
    load();
  };

  const handleDelete = async (id: string) => {
    await fetch("/api/workshops", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setDeleteConfirm(null);
    load();
  };

  return (
    <div className="flex-1 min-h-screen bg-gray-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Hammer className="w-7 h-7 text-orange-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Workshops</h1>
            <p className="text-gray-400 text-sm">Manage work areas and stations</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Workshop
        </button>
      </div>

      {loading ? (
        <div className="text-gray-500 text-center py-20">Loading…</div>
      ) : workshops.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Hammer className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No workshops yet. Add your first work area.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workshops.map((ws) => (
            <div
              key={ws.id}
              className={`bg-gray-900 rounded-xl border p-5 flex flex-col gap-3 transition-colors ${ws.isActive ? "border-white/10" : "border-white/5 opacity-60"}`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <Hammer className="w-5 h-5 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold truncate">{ws.name}</h3>
                  {ws.location && (
                    <p className="text-gray-400 text-sm flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" /> {ws.location}
                    </p>
                  )}
                  {ws.description && <p className="text-gray-500 text-xs mt-1 line-clamp-2">{ws.description}</p>}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${ws.isActive ? "bg-green-500/20 text-green-400" : "bg-gray-700 text-gray-400"}`}
                >
                  {ws.isActive ? "Active" : "Inactive"}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleToggleActive(ws)}
                    className="px-2 py-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white text-xs transition-colors"
                    title={ws.isActive ? "Deactivate" : "Activate"}
                  >
                    {ws.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => openEdit(ws)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(ws.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h2 className="text-white font-semibold">{editTarget ? "Edit Workshop" : "Add Workshop"}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-red-400 bg-red-500/10 rounded-lg px-3 py-2 text-sm">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1.5 block">Workshop Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Assembly Line A"
                  className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1.5 block">Location</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. Building B, Floor 2"
                  className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1.5 block">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="What kind of work happens here..."
                  className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-600"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium flex items-center gap-2"
              >
                {saving ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Check className="w-4 h-4" />}
                {editTarget ? "Save" : "Add Workshop"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-gray-900 rounded-2xl border border-red-500/20 p-6 w-full max-w-sm text-center">
            <Trash2 className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-1">Delete Workshop?</h3>
            <p className="text-gray-400 text-sm mb-5">Time logs associated with this workshop will lose the reference.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
