import { useEffect, useState } from 'react'
import { api } from '../api'

const SEV_COLORS = { critical:'red', major:'orange', minor:'yellow', none:'blue' }

export default function Defects() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ name:'', code:'', description:'', severity:'minor' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const load = () => api('/defects/types').catch(() => []).then(d => {
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
      const res = await api('/defects/types', { method:'POST', body: JSON.stringify(form) })
      if (!res?.id) throw new Error('Failed')
      showToast('Defect type created!')
      setModal(false)
      setForm({ name:'', code:'', description:'', severity:'minor' })
      load()
    } catch (err) {
      showToast(err?.message || 'Failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <div className="page-header">
        <div>
          <h1 className="page-title">Defect Types</h1>
          <p className="page-sub">Classify and manage defect categories</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Add Type</button>
      </div>

      <div className="card">
        <div className="card-body" style={{padding:0}}>
          {loading ? (
            <div style={{padding:40,textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}} /></div>
          ) : rows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">⚠️</div>
              <div>No defect types defined</div>
              <button className="btn btn-primary" style={{marginTop:16}} onClick={() => setModal(true)}>Add Defect Type</button>
            </div>
          ) : (
            <table className="table">
              <thead><tr><th>#</th><th>Name</th><th>Code</th><th>Severity</th><th>Description</th><th>Created</th></tr></thead>
              <tbody>
                {rows.map((d, i) => (
                  <tr key={d.id}>
                    <td style={{color:'var(--text-muted)',fontSize:12}}>{i+1}</td>
                    <td style={{fontWeight:500}}>{d.name}</td>
                    <td><code style={{fontSize:12,background:'var(--bg-secondary)',padding:'2px 6px',borderRadius:4}}>{d.code}</code></td>
                    <td><span className={`badge badge-${SEV_COLORS[d.severity] || 'blue'}`}>{d.severity || '—'}</span></td>
                    <td style={{color:'var(--text-muted)',fontSize:13,maxWidth:260}}>{d.description || '—'}</td>
                    <td style={{color:'var(--text-muted)',fontSize:12}}>{d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'}</td>
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
              <h3 className="modal-title">New Defect Type</h3>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={save}>
              <div className="modal-body">
                <div className="form-group"><label>Name *</label><input required value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Surface Scratch" /></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div className="form-group"><label>Code</label><input value={form.code} onChange={e => setForm(p=>({...p,code:e.target.value}))} placeholder="auto-generated" /></div>
                  <div className="form-group"><label>Severity</label>
                    <select value={form.severity} onChange={e => setForm(p=>({...p,severity:e.target.value}))}>
                      <option value="minor">Minor</option>
                      <option value="major">Major</option>
                      <option value="critical">Critical</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                </div>
                <div className="form-group"><label>Description</label><textarea rows={2} value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))} /></div>
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
