import { useState, useEffect } from 'react'
import { createInspection, listBatches, listOperators } from '../api'

const SEVERITIES = ['minor', 'major', 'critical']

export default function CreateInspection({ toast, onCreated }) {
  const [batches, setBatches] = useState([])
  const [operators, setOperators] = useState([])
  const [form, setForm] = useState({
    batch_id: '', operator_id: '', defect_count: 0,
    severity: 'minor', notes: '', status: 'pending'
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    listBatches().then(d => setBatches(Array.isArray(d) ? d : d.items || [])).catch(console.error)
    listOperators().then(d => setOperators(Array.isArray(d) ? d : d.items || [])).catch(console.error)
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await createInspection({ ...form, defect_count: parseInt(form.defect_count, 10) || 0 })
      toast('Inspection created', 'success')
      setForm({ batch_id: '', operator_id: '', defect_count: 0, severity: 'minor', notes: '', status: 'pending' })
      onCreated?.()
    } catch (err) {
      toast(err?.message || 'Failed to create inspection', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header"><h2>New Inspection</h2></div>
      <div className="card" style={{ maxWidth: 640 }}>
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Batch *</label>
              {batches.length > 0 ? (
                <select required value={form.batch_id} onChange={e => set('batch_id', e.target.value)}>
                  <option value="">Select batch…</option>
                  {batches.map(b => <option key={b.id} value={b.batch_number}>{b.batch_number} — {b.product_name}</option>)}
                </select>
              ) : (
                <input required placeholder="Batch ID (e.g. BATCH-001)" value={form.batch_id}
                  onChange={e => set('batch_id', e.target.value)} />
              )}
            </div>
            <div className="form-group">
              <label>Operator *</label>
              {operators.length > 0 ? (
                <select required value={form.operator_id} onChange={e => set('operator_id', e.target.value)}>
                  <option value="">Select operator…</option>
                  {operators.map(o => <option key={o.id} value={o.name}>{o.name} — {o.department}</option>)}
                </select>
              ) : (
                <input required placeholder="Operator name" value={form.operator_id}
                  onChange={e => set('operator_id', e.target.value)} />
              )}
            </div>
            <div className="form-group">
              <label>Defect Count</label>
              <input type="number" min={0} value={form.defect_count}
                onChange={e => set('defect_count', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Severity</label>
              <select value={form.severity} onChange={e => set('severity', e.target.value)}>
                {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Initial Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="pending">Pending</option>
                <option value="in_review">In Review</option>
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
                <option value="conditional_pass">Conditional Pass</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Notes</label>
              <textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)}
                placeholder="Optional notes…" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating…' : 'Create Inspection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
