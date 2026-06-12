"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Enter as LogIn, Alert as AlertCircle } from "@vibe/icons";

export default function PortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    const res = await fetch("/api/portal/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    setBusy(false);
    if (!res.ok) { const er = await res.json().catch(() => ({})); setError(er.error || "Login failed"); return; }
    router.push("/portal");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-[24px] font-semibold tracking-tight text-gray-900 [font-family:var(--font-display)]">Customer Portal</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to view your estimates and invoices.</p>
        </div>
        <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
          {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2"><AlertCircle className="h-4 w-4" /> {error}</div>}
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
          <button type="submit" disabled={busy} className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-md py-2.5">
            <LogIn className="h-4 w-4" /> {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
