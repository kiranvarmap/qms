import { useState, useEffect } from 'react'
import { listDefectTypes, createDefectType, deleteDefectType } from '../api'

const SEVERITIES = ['minor', 'major', 'critical']

export default function Defects({ toast }) {
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', severity: 'minor', description: '' })

  const load = () => {
    setLoading(true)
    listDefectTypes().then(d => setTypes(Array.isArray(d) ? d : d.items || [])).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    try {
      await createDefectType(form)
      toast('Defect type created', 'success')
      setForm({ name: '', severity: 'minor', description: '' })
      setShowForm(false)
      load()
    } catch { toast('Failed to create defect type', 'error') }
  }

  const del = async (id) => {
    if (!confirm('Delete this defect type?')) return
    try { await deleteDefectType(id); toast('Deleted', 'success'); load() }
    catch { toast('Cannot delete — in use', 'error') }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Defect Catalogue</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(f => !f)}>
          {showForm ? 'Cancel' : '+ Add Defect Type'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <form onSubmit={submit}>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="form-group">
                <label>Name *</label>
                <input required value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Severity</label>
                <select value={form.severity} onChange={e => set('severity', e.target.value)}>
                  {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Description</label>
                <input value={form.description} onChange={e => set('description', e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm">Save Defect Type</button>
          </form>
        </div>
      )}

      {loading ? <span className="spinner" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Severity</th><th>Description</th><th></th></tr></thead>
            <tbody>
              {types.length === 0 && <tr><td colSpan={4}><div className="empty">No defect types defined</div></td></tr>}
              {types.map(t => (
                <tr key={t.id}>
                  <td><strong>{t.name}</strong></td>
                  <td><span className={`badge badge-${t.severity}`}>{t.severity}</span></td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{t.description || '—'}</td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => del(t.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
