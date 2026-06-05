"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormField {
  id: string;
  label: string;
  helpText: string | null;
  isRequired: boolean;
  isVisible: boolean;
  prefillParam: string | null;
  columnId: string | null;
  columnType: string | null;
  columnConfig: { labels?: { id: string; text: string; color?: string }[] } | null;
  position: number;
}

interface FormData {
  id: string;
  name: string;
  description: string | null;
  submitMessage: string | null;
  isActive: boolean;
  fields: FormField[];
}

export default function PublicFormPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const [form, setForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/forms/slug/${slug}`)
      .then(r => { if (!r.ok) { setNotFound(true); return null; } return r.json(); })
      .then((data: FormData | null) => {
        if (!data) return;
        setForm(data);
        // Pre-fill from URL query params
        const prefilled: Record<string, string> = {};
        for (const f of data.fields) {
          if (f.prefillParam) {
            const v = searchParams.get(f.prefillParam);
            if (v) prefilled[f.id] = v;
          }
        }
        if (Object.keys(prefilled).length > 0) setValues(prefilled);
      })
      .finally(() => setLoading(false));
  }, [slug, searchParams]);

  const validate = () => {
    const errs: Record<string, string> = {};
    for (const field of form?.fields ?? []) {
      if (field.isRequired && !values[field.id]?.trim()) errs[field.id] = "This field is required.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/forms/${form!.id}/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      if (res.ok) setSubmitted(true);
      else { const data = await res.json(); setErrors({ _global: data.error ?? "Submission failed. Please try again." }); }
    } finally { setSubmitting(false); }
  };

  const setVal = (fieldId: string, val: string) =>
    setValues(p => ({ ...p, [fieldId]: val }));

  const renderField = (field: FormField) => {
    const colType = field.columnType ?? "text";
    const labels = field.columnConfig?.labels ?? [];
    const hasError = !!errors[field.id];

    const baseCls = cn(
      "w-full border-2 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-0 transition-all bg-white",
      hasError
        ? "border-red-300 focus:border-red-400"
        : "border-gray-200 focus:border-blue-500 hover:border-gray-300"
    );

    // Status / Priority / Dropdown → coloured option select
    if (colType === "status" || colType === "priority" || colType === "dropdown") {
      const selectedLabel = labels.find(l => l.text === values[field.id]);
      return (
        <div className="relative">
          <select
            className={cn(baseCls, "appearance-none pr-8 cursor-pointer",
              selectedLabel?.color ? "font-semibold" : "")}
            style={selectedLabel?.color ? { backgroundColor: selectedLabel.color + "18", borderColor: selectedLabel.color + "66", color: selectedLabel.color } : {}}
            value={values[field.id] ?? ""}
            onChange={e => setVal(field.id, e.target.value)}
          >
            <option value="">Select an option…</option>
            {labels.map(l => (
              <option key={l.id} value={l.text} style={{ color: l.color ?? "inherit" }}>{l.text}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      );
    }

    // Checkbox
    if (colType === "checkbox" || colType === "boolean") {
      const checked = values[field.id] === "true";
      return (
        <button
          type="button"
          onClick={() => setVal(field.id, checked ? "false" : "true")}
          className={cn(
            "flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 w-full text-left transition-all cursor-pointer",
            checked ? "bg-blue-50 border-blue-500" : "bg-white border-gray-200 hover:border-gray-300"
          )}
        >
          <div className={cn(
            "w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all",
            checked ? "bg-blue-600 border-blue-600" : "border-gray-300"
          )}>
            {checked && (
              <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <span className={cn("text-sm font-medium", checked ? "text-blue-700" : "text-gray-600")}>
            {checked ? "Yes" : "No"}
          </span>
        </button>
      );
    }

    // Date
    if (colType === "date") {
      return (
        <input
          type="date"
          className={baseCls}
          value={values[field.id] ?? ""}
          onChange={e => setVal(field.id, e.target.value)}
        />
      );
    }

    // Number / Rating
    if (colType === "number" || colType === "rating") {
      return (
        <input
          type="number"
          className={baseCls}
          placeholder="0"
          value={values[field.id] ?? ""}
          onChange={e => setVal(field.id, e.target.value)}
        />
      );
    }

    // Link / URL
    if (colType === "link") {
      return (
        <input
          type="url"
          className={baseCls}
          placeholder="https://"
          value={values[field.id] ?? ""}
          onChange={e => setVal(field.id, e.target.value)}
        />
      );
    }

    // Long text / no column / default
    if (colType === "text" || !field.columnId) {
      return (
        <textarea
          className={cn(baseCls, "resize-none leading-relaxed")}
          rows={3}
          placeholder="Type your answer…"
          value={values[field.id] ?? ""}
          onChange={e => setVal(field.id, e.target.value)}
        />
      );
    }

    // Fallback single-line text (formula, person, etc.)
    return (
      <input
        type="text"
        className={baseCls}
        placeholder="Type your answer…"
        value={values[field.id] ?? ""}
        onChange={e => setVal(field.id, e.target.value)}
      />
    );
  };

  // ── States ─────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        <p className="text-sm text-gray-400">Loading form…</p>
      </div>
    </div>
  );

  if (notFound || !form) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center max-w-sm w-full">
        <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h1 className="text-lg font-bold text-gray-800 mb-2">Form not found</h1>
        <p className="text-sm text-gray-400">This form may have been removed or made private.</p>
      </div>
    </div>
  );

  if (!form.isActive) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center max-w-sm w-full">
        <AlertCircle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
        <h1 className="text-lg font-bold text-gray-800 mb-2">Form is closed</h1>
        <p className="text-sm text-gray-400">This form is no longer accepting responses.</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-10 text-center max-w-sm w-full">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="h-9 w-9 text-green-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">All done!</h1>
        <p className="text-sm text-gray-500 leading-relaxed">{form.submitMessage || "Thank you for your submission."}</p>
      </div>
    </div>
  );

  // ── Form ───────────────────────────────────────────────────────────
  const visibleFields = form.fields.filter(f => f.isVisible);
  const requiredCount = visibleFields.filter(f => f.isRequired).length;
  const filledRequired = visibleFields.filter(f => f.isRequired && values[f.id]?.trim()).length;
  const progress = requiredCount > 0 ? Math.round((filledRequired / requiredCount) * 100) : 100;

  return (
    <div className="min-h-screen bg-[var(--allgrey-background-color)] py-10 px-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 overflow-hidden">

          {/* Header band */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 pt-8 pb-7">
            <h1 className="text-2xl font-bold text-white leading-tight">{form.name}</h1>
            {form.description && (
              <p className="text-sm text-blue-100 mt-2 leading-relaxed">{form.description}</p>
            )}
            {requiredCount > 0 && (
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs text-blue-200 mb-1.5">
                  <span>{filledRequired} of {requiredCount} required fields filled</span>
                  <span className="font-semibold">{progress}%</span>
                </div>
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Fields */}
          <form onSubmit={submit} className="px-8 py-8 space-y-7">
            {errors._global && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />{errors._global}
              </div>
            )}

            {visibleFields.map(field => {
              const isCheckbox = field.columnType === "checkbox" || field.columnType === "boolean";
              return (
                <div key={field.id} className="space-y-1.5">
                  {!isCheckbox && (
                    <label className="block text-sm font-semibold text-gray-800">
                      {field.label}
                      {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                    </label>
                  )}
                  {field.helpText && (
                    <p className="text-xs text-gray-400 leading-relaxed">{field.helpText}</p>
                  )}
                  {renderField(field)}
                  {errors[field.id] && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />{errors[field.id]}
                    </p>
                  )}
                </div>
              );
            })}

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-200 active:scale-[0.99] text-sm"
              >
                {submitting
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting…</>
                  : <><ChevronRight className="h-4 w-4" />Submit</>}
              </button>
            </div>
          </form>
        </div>
        <p className="text-center text-[11px] text-gray-400 mt-5">Powered by QMS Platform</p>
      </div>
    </div>
  );
}

