import { useState } from 'react'
import { createInspection } from '../api.js'

export default function CreateInspection({ onCreated }) {
  const [form, setForm] = useState({
    batch_id: '', operator_id: '', status: 'pass', defect_count: 0, notes: ''
  })
  const [result, setResult] = useState(null)
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async e => {
    e.preventDefault()
    setLoading(true)
    setErr(null)
    setResult(null)
    try {
      const data = { ...form, defect_count: parseInt(form.defect_count, 10) || 0 }
      const r = await createInspection(data)
      setResult(r)
      onCreated && onCreated()
    } catch(e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <h2>Create Inspection</h2>
      <div className="card" style={{maxWidth:600}}>
        {err && <div className="alert alert-error">{err}</div>}
        {result && (
          <div className="alert alert-success">
            ✓ Inspection created: <strong>{result.id}</strong> — enqueued for processing.
          </div>
        )}
        <form onSubmit={submit}>
          <label>Batch ID *</label>
          <input required value={form.batch_id} onChange={e => set('batch_id', e.target.value)} placeholder="e.g. BATCH-2026-001" />

          <label>Operator ID *</label>
          <input required value={form.operator_id} onChange={e => set('operator_id', e.target.value)} placeholder="e.g. OP-001" />

          <label>Status *</label>
          <select value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="pass">Pass</option>
            <option value="fail">Fail</option>
          </select>

          <label>Defect Count</label>
          <input type="number" min="0" value={form.defect_count} onChange={e => set('defect_count', e.target.value)} />

          <label>Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes..." />

          <div className="mt">
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Inspection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
