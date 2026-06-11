"use client";

import { useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, FlaskConical, Play } from "lucide-react";

interface Result { feasible: boolean; plannedEnd: string; deliveryRisk: string; conflicts: { description: string; severity: string }[] }

const fmtTime = (s: string | null) => (s ? new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

function ResultCard({ title, r }: { title: string; r: Result | null }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex-1">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">{title}</h3>
      {!r ? <p className="text-xs text-gray-400">—</p> : (
        <>
          <p className="text-xs text-gray-500">Completion</p>
          <p className="text-lg font-semibold text-gray-900 mb-2">{fmtTime(r.plannedEnd)}</p>
          <p className="text-xs text-gray-500">Risk: <span className="font-medium">{r.deliveryRisk}</span> · {r.feasible ? "feasible" : "blocked"}</p>
          <p className="text-xs text-gray-500 mt-1">{r.conflicts.length} conflict(s)</p>
        </>
      )}
    </div>
  );
}

export default function SimulatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [hoursPerDay, setHoursPerDay] = useState("8");
  const [extraCrew, setExtraCrew] = useState("0");
  const [startDate, setStartDate] = useState("");
  const [baseline, setBaseline] = useState<Result | null>(null);
  const [scenario, setScenario] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    // Extra crew is applied globally as a flat bump in the demo override map is
    // keyed per stage; here we send hoursPerDay + requestedStartDate, which the
    // engine applies across all stages. (Per-stage crew uses the builder.)
    const overrides: Record<string, unknown> = { hoursPerDay: Number(hoursPerDay) || 8 };
    if (startDate) overrides.requestedStartDate = new Date(startDate).toISOString();
    const r = await fetch(`/api/work-orders/${id}/simulate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(overrides) }).then((x) => x.json());
    setBaseline(r.baseline ?? null);
    setScenario(r.scenario ?? null);
    setBusy(false);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href={`/dashboard/production/${id}/plan`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="h-4 w-4" /> Feasibility</Link>
      <div className="flex items-center gap-3 mb-6"><FlaskConical className="h-6 w-6 text-purple-600" /><h1 className="text-xl font-semibold text-gray-900">What-If Simulation</h1></div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm mb-6">
        <div className="grid grid-cols-3 gap-3">
          <label className="block"><span className="text-xs text-gray-500">Working hours/day (overtime)</span>
            <input type="number" value={hoursPerDay} onChange={(e) => setHoursPerDay(e.target.value)} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
          <label className="block"><span className="text-xs text-gray-500">Extra crew (info)</span>
            <input type="number" value={extraCrew} onChange={(e) => setExtraCrew(e.target.value)} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
          <label className="block"><span className="text-xs text-gray-500">Earliest start</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
        </div>
        <button onClick={run} disabled={busy} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-md"><Play className="h-4 w-4" /> {busy ? "Running…" : "Run simulation"}</button>
      </div>

      <div className="flex gap-4">
        <ResultCard title="Baseline" r={baseline} />
        <ResultCard title="Scenario" r={scenario} />
      </div>

      {baseline && scenario && (
        <p className="mt-4 text-sm text-gray-600">
          {new Date(scenario.plannedEnd).getTime() < new Date(baseline.plannedEnd).getTime()
            ? `Scenario finishes ${Math.round((new Date(baseline.plannedEnd).getTime() - new Date(scenario.plannedEnd).getTime()) / 3600000)}h earlier.`
            : new Date(scenario.plannedEnd).getTime() > new Date(baseline.plannedEnd).getTime()
            ? `Scenario finishes ${Math.round((new Date(scenario.plannedEnd).getTime() - new Date(baseline.plannedEnd).getTime()) / 3600000)}h later.`
            : "No change to completion time."}
        </p>
      )}
    </div>
  );
}
