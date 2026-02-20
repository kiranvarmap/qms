import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'

const STATUS_META = {
  draft:       { color:'#64748b', label:'Draft' },
  in_progress: { color:'#f59e0b', label:'In Progress' },
  complete:    { color:'#10b981', label:'Complete' },
  rejected:    { color:'#ef4444', label:'Rejected' },
}

function Badge({ status }) {
  const m = STATUS_META[status] || STATUS_META.draft
  return <span style={{ background:`${m.color}22`, color:m.color, border:`1px solid ${m.color}44`, borderRadius:'999px', padding:'3px 12px', fontSize:'0.75rem', fontWeight:700 }}>{m.label}</span>
}

/* ── Create Modal ─────────────────────────────────────── */
function CreateDocModal({ onClose, onCreated }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ title:'', description:'', batch_id:'', batch_number:'' })
  const [signers, setSigners] = useState([{ name:'', role:'', email:'', order:1 }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [batches, setBatches] = useState([])

  useEffect(() => {
    api('/batches').catch(() => []).then(d => setBatches(Array.isArray(d) ? d : []))
  }, [])

  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  function addSigner() {
    setSigners(s => [...s, { name:'', role:'', email:'', order: s.length + 1 }])
  }
  function removeSigner(i) {
    setSigners(s => s.filter((_,idx) => idx !== i).map((x,idx) => ({ ...x, order: idx+1 })))
  }
  function setSigner(i, k, v) {
    setSigners(s => s.map((x,idx) => idx===i ? { ...x, [k]: v } : x))
  }

  async function submit() {
    setError('')
    if (!form.title.trim()) { setError('Title is required'); return }
    if (signers.some(s => !s.name.trim())) { setError('All signer names are required'); return }
    setLoading(true)
    try {
      const payload = {
        ...form,
        signers: signers.map((s,i) => ({ ...s, sign_order: i+1, assigned_to_name: s.name, assigned_to_role: s.role, assigned_to_email: s.email }))
      }
      const doc = await api('/documents', { method:'POST', body: JSON.stringify(payload) })
      onCreated(doc)
    } catch (err) {
      setError(err?.message || 'Failed to create document')
    }
    setLoading(false)
  }

  const inputStyle = { width:'100%', background:'rgba(15,23,42,0.6)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:'0.75rem', padding:'0.7rem 1rem', color:'#f1f5f9', fontSize:'0.9rem', outline:'none', boxSizing:'border-box' }
  const labelStyle = { display:'block', color:'#94a3b8', fontSize:'0.75rem', fontWeight:600, marginBottom:'0.35rem', textTransform:'uppercase', letterSpacing:'0.05em' }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'1rem' }}>
      <div style={{ background:'#1e293b', border:'1px solid rgba(99,102,241,0.3)', borderRadius:'1.5rem', width:'100%', maxWidth:'600px', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 25px 60px rgba(0,0,0,0.5)' }}>
        {/* Header */}
        <div style={{ padding:'1.5rem 2rem', borderBottom:'1px solid rgba(99,102,241,0.15)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <h2 style={{ color:'#f1f5f9', margin:0, fontSize:'1.2rem', fontWeight:700 }}>New Sign-off Document</h2>
            <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.75rem' }}>
              {[1,2,3].map(s => (
                <div key={s} style={{ display:'flex', alignItems:'center', gap:'0.35rem' }}>
                  <div style={{ width:'24px', height:'24px', borderRadius:'50%', background: step>=s ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(99,102,241,0.2)', display:'flex', alignItems:'center', justifyContent:'center', color: step>=s ? '#fff' : '#6366f1', fontSize:'0.75rem', fontWeight:700 }}>{s}</div>
                  <span style={{ color: step===s ? '#f1f5f9' : '#64748b', fontSize:'0.8rem', fontWeight: step===s ? 600 : 400 }}>{['Details','Signers','Review'][s-1]}</span>
                  {s < 3 && <span style={{ color:'#334155' }}>›</span>}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'0.5rem', padding:'6px 12px', cursor:'pointer', fontWeight:600 }}>✕</button>
        </div>

        <div style={{ padding:'1.5rem 2rem' }}>
          {error && <div style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.4)', borderRadius:'0.75rem', padding:'0.75rem 1rem', marginBottom:'1rem', color:'#fca5a5', fontSize:'0.875rem' }}>{error}</div>}

          {/* Step 1 */}
          {step === 1 && (
            <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
              <div><label style={labelStyle}>Document Title *</label><input value={form.title} onChange={setF('title')} required placeholder="e.g. Batch B2024-001 Quality Sign-off" style={inputStyle} /></div>
              <div><label style={labelStyle}>Description</label><textarea value={form.description} onChange={setF('description')} rows={3} placeholder="Purpose of this sign-off document..." style={{ ...inputStyle, resize:'vertical' }} /></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                <div>
                  <label style={labelStyle}>Batch</label>
                  <select value={form.batch_id} onChange={e => { const b = batches.find(x => String(x.id)===e.target.value); setForm(f => ({ ...f, batch_id: e.target.value, batch_number: b?.batch_number||'' })) }} style={inputStyle}>
                    <option value="">Select batch (optional)</option>
                    {batches.map(b => <option key={b.id} value={b.id}>{b.batch_number} — {b.product_name||''}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>Batch Number (manual)</label><input value={form.batch_number} onChange={setF('batch_number')} placeholder="B2024-001" style={inputStyle} /></div>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div>
              <div style={{ color:'#94a3b8', fontSize:'0.875rem', marginBottom:'1.25rem' }}>Add signers in the order they should sign. Each signer will be notified when it's their turn.</div>
              {signers.map((s, i) => (
                <div key={i} style={{ background:'rgba(15,23,42,0.4)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:'0.75rem', padding:'1rem', marginBottom:'0.75rem' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.75rem' }}>
                    <span style={{ color:'#818cf8', fontWeight:700, fontSize:'0.875rem' }}>Signer #{i+1}</span>
                    {signers.length > 1 && <button onClick={() => removeSigner(i)} style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'none', borderRadius:'0.4rem', padding:'3px 10px', cursor:'pointer', fontSize:'0.8rem' }}>Remove</button>}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
                    <div><label style={labelStyle}>Full Name *</label><input value={s.name} onChange={e => setSigner(i,'name',e.target.value)} placeholder="Jane Smith" style={inputStyle} /></div>
                    <div>
                      <label style={labelStyle}>Role</label>
                      <select value={s.role} onChange={e => setSigner(i,'role',e.target.value)} style={inputStyle}>
                        <option value="">Select role</option>
                        {['operator','inspector','supervisor','qa','manager','admin'].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div style={{ gridColumn:'1/-1' }}><label style={labelStyle}>Email</label><input value={s.email} onChange={e => setSigner(i,'email',e.target.value)} placeholder="jane@company.com" style={inputStyle} /></div>
                  </div>
                </div>
              ))}
              <button onClick={addSigner} style={{ width:'100%', background:'rgba(99,102,241,0.1)', border:'1px dashed rgba(99,102,241,0.4)', borderRadius:'0.75rem', padding:'0.75rem', color:'#818cf8', fontWeight:600, cursor:'pointer', fontSize:'0.875rem' }}>+ Add Signer</button>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div>
              <div style={{ background:'rgba(15,23,42,0.4)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:'0.75rem', padding:'1.25rem', marginBottom:'1rem' }}>
                <h3 style={{ color:'#f1f5f9', margin:'0 0 0.75rem', fontSize:'1rem' }}>{form.title}</h3>
                {form.description && <p style={{ color:'#94a3b8', margin:'0 0 0.75rem', fontSize:'0.875rem' }}>{form.description}</p>}
                {form.batch_number && <div style={{ color:'#64748b', fontSize:'0.8rem' }}>📦 Batch: {form.batch_number}</div>}
              </div>
              <h4 style={{ color:'#94a3b8', fontSize:'0.8rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'0.75rem' }}>Signing Order</h4>
              {signers.map((s,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem', background:'rgba(15,23,42,0.3)', borderRadius:'0.5rem', marginBottom:'0.5rem' }}>
                  <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:'0.8rem' }}>{i+1}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ color:'#f1f5f9', fontWeight:600, fontSize:'0.9rem' }}>{s.name}</div>
                    <div style={{ color:'#64748b', fontSize:'0.8rem' }}>{s.role}{s.email ? ` · ${s.email}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'1rem 2rem 1.5rem', display:'flex', justifyContent:'space-between' }}>
          <button onClick={step > 1 ? () => setStep(s=>s-1) : onClose} style={{ background:'rgba(99,102,241,0.1)', color:'#818cf8', border:'1px solid rgba(99,102,241,0.3)', borderRadius:'0.75rem', padding:'0.7rem 1.5rem', fontWeight:600, cursor:'pointer' }}>
            {step > 1 ? '← Back' : 'Cancel'}
          </button>
          {step < 3
            ? <button onClick={() => setStep(s=>s+1)} style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff', border:'none', borderRadius:'0.75rem', padding:'0.7rem 1.5rem', fontWeight:700, cursor:'pointer' }}>Next →</button>
            : <button onClick={submit} disabled={loading} style={{ background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff', border:'none', borderRadius:'0.75rem', padding:'0.7rem 1.5rem', fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? 'Creating...' : '✓ Create Document'}
              </button>
          }
        </div>
      </div>
    </div>
  )
}

/* ── Main Documents Page ──────────────────────────────── */
export default function Documents() {
  const nav = useNavigate()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [toast, setToast] = useState(null)
  const [filter, setFilter] = useState('all')

  function showToast(msg, type='success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function load() {
    setLoading(true)
    try {
      const data = await api('/documents')
      setDocs(Array.isArray(data) ? data : [])
    } catch { setDocs([]) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function onCreated(doc) {
    setShowCreate(false)
    showToast('Document created successfully!')
    load()
    if (doc?.id) nav(`/documents/${doc.id}`)
  }

  const filtered = filter === 'all' ? docs : docs.filter(d => d.status === filter)

  return (
    <div style={{ padding:'2rem', maxWidth:'1100px', margin:'0 auto' }}>
      {toast && <div style={{ position:'fixed', top:'1.5rem', right:'1.5rem', background: toast.type==='error' ? 'rgba(239,68,68,0.95)' : 'rgba(16,185,129,0.95)', color:'#fff', padding:'0.85rem 1.5rem', borderRadius:'0.75rem', fontWeight:600, zIndex:9999, boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}>{toast.msg}</div>}
      {showCreate && <CreateDocModal onClose={() => setShowCreate(false)} onCreated={onCreated} />}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'2rem' }}>
        <div>
          <h1 style={{ color:'#f1f5f9', fontSize:'1.75rem', fontWeight:800, margin:'0 0 0.4rem' }}>Sign-off Documents</h1>
          <p style={{ color:'#64748b', margin:0 }}>Manage batch approval and e-signature workflows</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff', border:'none', borderRadius:'0.75rem', padding:'0.7rem 1.5rem', fontWeight:700, cursor:'pointer', fontSize:'0.9rem', whiteSpace:'nowrap' }}>+ New Document</button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1rem', marginBottom:'2rem' }}>
        {Object.entries(STATUS_META).map(([k,v]) => (
          <div key={k} style={{ background:'rgba(30,41,59,0.6)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:'1rem', padding:'1.25rem 1.5rem', cursor:'pointer', transition:'all 0.2s', ...(filter===k ? { borderColor:`${v.color}55`, background:`${v.color}11` } : {}) }} onClick={() => setFilter(filter===k ? 'all' : k)}>
            <div style={{ color:'#64748b', fontSize:'0.75rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'0.5rem' }}>{v.label}</div>
            <div style={{ color:v.color, fontSize:'2rem', fontWeight:800 }}>{docs.filter(d => d.status===k).length}</div>
          </div>
        ))}
      </div>

      {/* Document List */}
      {loading ? (
        <div style={{ textAlign:'center', padding:'4rem', color:'#64748b' }}>Loading documents...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'4rem', color:'#64748b' }}>
          <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>📄</div>
          <div style={{ fontWeight:600, marginBottom:'0.5rem', color:'#94a3b8' }}>No documents yet</div>
          <div style={{ fontSize:'0.875rem' }}>Create your first sign-off document to get started</div>
          <button onClick={() => setShowCreate(true)} style={{ marginTop:'1.5rem', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff', border:'none', borderRadius:'0.75rem', padding:'0.75rem 1.5rem', fontWeight:700, cursor:'pointer' }}>+ New Document</button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
          {filtered.map(doc => {
            const total = doc.sign_requests?.length || 0
            const signed = doc.sign_requests?.filter(r => r.status==='signed').length || 0
            const progress = total > 0 ? (signed / total) * 100 : 0
            return (
              <div key={doc.id} onClick={() => nav(`/documents/${doc.id}`)} style={{ background:'rgba(30,41,59,0.6)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:'1rem', padding:'1.25rem 1.5rem', cursor:'pointer', transition:'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(99,102,241,0.4)'; e.currentTarget.style.background='rgba(30,41,59,0.9)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(99,102,241,0.15)'; e.currentTarget.style.background='rgba(30,41,59,0.6)' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'1rem' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.4rem', flexWrap:'wrap' }}>
                      <h3 style={{ color:'#f1f5f9', margin:0, fontWeight:700, fontSize:'1rem' }}>{doc.title}</h3>
                      <Badge status={doc.status} />
                    </div>
                    {doc.description && <p style={{ color:'#64748b', margin:'0 0 0.5rem', fontSize:'0.875rem' }}>{doc.description}</p>}
                    <div style={{ display:'flex', gap:'1.5rem', flexWrap:'wrap' }}>
                      {doc.batch_number && <span style={{ color:'#94a3b8', fontSize:'0.8rem' }}>📦 {doc.batch_number}</span>}
                      <span style={{ color:'#94a3b8', fontSize:'0.8rem' }}>✍️ {signed}/{total} signed</span>
                      {doc.created_by_name && <span style={{ color:'#94a3b8', fontSize:'0.8rem' }}>👤 {doc.created_by_name}</span>}
                      <span style={{ color:'#64748b', fontSize:'0.8rem' }}>{doc.created_at ? new Date(doc.created_at).toLocaleDateString() : ''}</span>
                    </div>
                  </div>
                  <div style={{ color:'#6366f1', fontSize:'1.25rem' }}>›</div>
                </div>
                {total > 0 && (
                  <div style={{ marginTop:'0.75rem' }}>
                    <div style={{ height:'4px', background:'rgba(99,102,241,0.15)', borderRadius:'999px', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${progress}%`, background:'linear-gradient(90deg,#6366f1,#10b981)', borderRadius:'999px', transition:'width 0.5s' }} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
