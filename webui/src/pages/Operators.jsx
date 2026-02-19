import { useState, useEffect } from 'react'
import { listOperators, createOperator } from '../api'

export default function Operators({ toast }) {
  const [operators, setOperators] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', employee_id: '', department: '', email: '' })

  const load = () => {
    setLoading(true)
    listOperators().then(d => setOperators(Array.isArray(d) ? d : d.items || [])).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    try {
      await createOperator(form)
      toast('Operator added', 'success')
      setForm({ name: '', employee_id: '', department: '', email: '' })
      setShowForm(false)
      load()
    } catch { toast('Failed to create operator', 'error') }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Operators</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(f => !f)}>
          {showForm ? 'Cancel' : '+ Add Operator'}
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
                <label>Employee ID</label>
                <input value={form.employee_id} onChange={e => set('employee_id', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Department</label>
                <input value={form.department} onChange={e => set('department', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm">Save Operator</button>
          </form>
        </div>
      )}

      {loading ? <span className="spinner" /> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Employee ID</th><th>Department</th><th>Email</th>
                <th>Inspections</th><th>Pass Rate</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {operators.length === 0 && <tr><td colSpan={7}><div className="empty">No operators registered</div></td></tr>}
              {operators.map(o => (
                <tr key={o.id}>
                  <td><strong>{o.name}</strong></td>
                  <td style={{ fontFamily: 'monospace' }}>{o.employee_id || '—'}</td>
                  <td>{o.department || '—'}</td>
                  <td style={{ fontSize: 12 }}>{o.email || '—'}</td>
                  <td>{o.inspection_count ?? '—'}</td>
                  <td>
                    {o.pass_rate != null ? (
                      <span style={{ color: o.pass_rate >= 80 ? '#16a34a' : o.pass_rate >= 50 ? '#d97706' : '#dc2626' }}>
                        {o.pass_rate}%
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    <span className={`badge ${o.active !== false ? 'badge-pass' : 'badge-fail'}`}>
                      {o.active !== false ? 'active' : 'inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
