import { useEffect, useState } from 'react'
import { api } from '../api'

export default function Operators() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ name: '', employee_id: '', department: '', role: '' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const load = () => api('/operators').catch(() => []).then(d => {
    setRows(Array.isArray(d) ? d : [])
    setLoading(false)
  })

  useEffect(() => { load() }, [])

  const showToast = (msg, type='success') => {
    setToast({msg,type})
    setTimeout(() => setToast(null), 3000)
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api('/operators', { method:'POST', body: JSON.stringify(form) })
      if (!res?.id) throw new Error('Failed')
      showToast('Operator created!')
      setModal(false)
      setForm({ name:'', employee_id:'', department:'', role:'' })
      load()
    } catch (err) {
      showToast(err?.message || 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <div className="page-header">
        <div>
          <h1 className="page-title">Operators</h1>
          <p className="page-sub">{rows.length} registered</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Add Operator</button>
      </div>

      <div className="card">
        <div className="card-body" style={{padding:0}}>
          {loading ? (
            <div style={{padding:40,textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}} /></div>
          ) : rows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👷</div>
              <div>No operators registered</div>
              <button className="btn btn-primary" style={{marginTop:16}} onClick={() => setModal(true)}>Add First Operator</button>
            </div>
          ) : (
            <table className="table">
              <thead><tr><th>#</th><th>Name</th><th>Employee ID</th><th>Department</th><th>Role</th><th>Joined</th></tr></thead>
              <tbody>
                {rows.map((op, i) => (
                  <tr key={op.id}>
                    <td style={{color:'var(--text-muted)',fontSize:12}}>{i+1}</td>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:32,height:32,borderRadius:'50%',background:'var(--brand)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#fff',flexShrink:0}}>
                          {op.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <span style={{fontWeight:500}}>{op.name}</span>
                      </div>
                    </td>
                    <td><code style={{fontSize:12,background:'var(--bg-secondary)',padding:'2px 6px',borderRadius:4}}>{op.employee_id || '—'}</code></td>
                    <td>{op.department || '—'}</td>
                    <td>{op.role ? <span className="badge badge-blue">{op.role}</span> : '—'}</td>
                    <td style={{color:'var(--text-muted)',fontSize:12}}>{op.created_at ? new Date(op.created_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">New Operator</h3>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={save}>
              <div className="modal-body">
                <div className="form-group"><label>Full Name *</label><input required value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} placeholder="John Smith" /></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div className="form-group"><label>Employee ID</label><input value={form.employee_id} onChange={e => setForm(p=>({...p,employee_id:e.target.value}))} placeholder="auto-generated" /></div>
                  <div className="form-group"><label>Role</label><input value={form.role} onChange={e => setForm(p=>({...p,role:e.target.value}))} placeholder="e.g. Inspector" /></div>
                </div>
                <div className="form-group"><label>Department</label><input value={form.department} onChange={e => setForm(p=>({...p,department:e.target.value}))} placeholder="e.g. QA" /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
