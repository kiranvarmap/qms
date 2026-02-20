import { useEffect, useState } from 'react'
import { api } from '../api'
import { useNavigate } from 'react-router-dom'

const SEVERITY_OPTS = ['none','minor','major','critical']

export default function CreateInspection() {
  const [batches, setBatches] = useState([])
  const [operators, setOperators] = useState([])
  const [defectTypes, setDefectTypes] = useState([])
  const [form, setForm] = useState({
    batch_id: '', operator_id: '', status: 'pending', notes: '', severity: 'none'
  })
  const [defects, setDefects] = useState([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const nav = useNavigate()

  useEffect(() => {
    Promise.all([
      api('/batches').catch(() => []),
      api('/operators').catch(() => []),
      api('/defects/types').catch(() => []),
    ]).then(([b, o, d]) => {
      setBatches(Array.isArray(b) ? b : [])
      setOperators(Array.isArray(o) ? o : [])
      setDefectTypes(Array.isArray(d) ? d : [])
    })
  }, [])

  const addDefect = () => setDefects(p => [...p, { defect_type_id: '', quantity: 1, notes: '' }])
  const removeDefect = i => setDefects(p => p.filter((_, x) => x !== i))
  const updateDefect = (i, k, v) => setDefects(p => p.map((d, x) => x === i ? { ...d, [k]: v } : d))

  const showToast = (msg, type='success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form }
      if (payload.batch_id) payload.batch_id = parseInt(payload.batch_id)
      if (payload.operator_id) payload.operator_id = parseInt(payload.operator_id)
      if (payload.severity === 'none') delete payload.severity
      const ins = await api('/inspections', { method:'POST', body: JSON.stringify(payload) })
      if (!ins?.id) throw new Error('Create failed')
      for (const d of defects) {
        if (!d.defect_type_id) continue
        await api(`/defects/inspection/${ins.id}`, {
          method:'POST',
          body: JSON.stringify({ defect_type_id: String(d.defect_type_id), quantity: parseInt(d.quantity)||1, notes: d.notes })
        }).catch(() => {})
      }
      showToast('Inspection created successfully!')
      setTimeout(() => nav('/inspections'), 1500)
    } catch (err) {
      showToast(err?.message || 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{maxWidth:760}}>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <div className="page-header">
        <div>
          <h1 className="page-title">New Inspection</h1>
          <p className="page-sub">Record a quality inspection</p>
        </div>
        <button className="btn btn-ghost" onClick={() => nav('/inspections')}>← Back</button>
      </div>

      <form onSubmit={submit}>
        <div className="card" style={{marginBottom:16}}>
          <div className="card-header"><h2 className="card-title">Inspection Details</h2></div>
          <div className="card-body">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
              <div className="form-group">
                <label>Batch</label>
                <select value={form.batch_id} onChange={e => setForm(p => ({...p, batch_id: e.target.value}))}>
                  <option value="">— Select batch —</option>
                  {batches.map(b => <option key={b.id} value={b.id}>{b.batch_number || `Batch #${b.id}`}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Operator</label>
                <select value={form.operator_id} onChange={e => setForm(p => ({...p, operator_id: e.target.value}))}>
                  <option value="">— Select operator —</option>
                  {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={e => setForm(p => ({...p, status: e.target.value}))}>
                  <option value="pending">Pending</option>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                </select>
              </div>
              <div className="form-group">
                <label>Severity</label>
                <select value={form.severity} onChange={e => setForm(p => ({...p, severity: e.target.value}))}>
                  {SEVERITY_OPTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group" style={{marginTop:4}}>
              <label>Notes</label>
              <textarea rows={3} value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} placeholder="Optional inspection notes…" />
            </div>
          </div>
        </div>

        <div className="card" style={{marginBottom:16}}>
          <div className="card-header">
            <h2 className="card-title">Defects Found</h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={addDefect}>+ Add Defect</button>
          </div>
          <div className="card-body">
            {defects.length === 0 ? (
              <div style={{color:'var(--text-muted)',textAlign:'center',padding:'20px 0',fontSize:13}}>
                No defects added. Click "+ Add Defect" to record defects.
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {defects.map((d, i) => (
                  <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 80px 1fr auto',gap:10,alignItems:'end'}}>
                    <div className="form-group" style={{margin:0}}>
                      <label style={{fontSize:11}}>Defect Type</label>
                      <select value={d.defect_type_id} onChange={e => updateDefect(i,'defect_type_id',e.target.value)}>
                        <option value="">— Type —</option>
                        {defectTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{margin:0}}>
                      <label style={{fontSize:11}}>Qty</label>
                      <input type="number" min={1} value={d.quantity} onChange={e => updateDefect(i,'quantity',e.target.value)} />
                    </div>
                    <div className="form-group" style={{margin:0}}>
                      <label style={{fontSize:11}}>Notes</label>
                      <input value={d.notes} onChange={e => updateDefect(i,'notes',e.target.value)} placeholder="optional" />
                    </div>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => removeDefect(i)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <button type="button" className="btn btn-ghost" onClick={() => nav('/inspections')}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Inspection'}</button>
        </div>
      </form>
    </div>
  )
}
