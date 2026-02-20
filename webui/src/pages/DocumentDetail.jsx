import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api.js'

const STATUS_META = {
  pending:     { color:'#f59e0b', label:'Pending',     icon:'⏳' },
  signed:      { color:'#10b981', label:'Signed',      icon:'✅' },
  rejected:    { color:'#ef4444', label:'Rejected',    icon:'❌' },
  skipped:     { color:'#64748b', label:'Skipped',     icon:'⏭' },
}
const DOC_STATUS = {
  draft:       { color:'#64748b', label:'Draft' },
  in_progress: { color:'#f59e0b', label:'In Progress' },
  complete:    { color:'#10b981', label:'Complete' },
  rejected:    { color:'#ef4444', label:'Rejected' },
}

function SignModal({ sr, docId, onDone, onClose }) {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function act(action) {
    setLoading(true); setError('')
    try {
      await api(`/documents/${docId}/sign-requests/${sr.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ notes })
      })
      onDone()
    } catch (err) {
      setError(err?.message || 'Action failed')
      setLoading(false)
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'1rem' }}>
      <div style={{ background:'#1e293b', border:'1px solid rgba(99,102,241,0.3)', borderRadius:'1.5rem', width:'100%', maxWidth:'480px', boxShadow:'0 25px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ padding:'1.5rem 2rem', borderBottom:'1px solid rgba(99,102,241,0.15)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h2 style={{ color:'#f1f5f9', margin:0, fontSize:'1.15rem', fontWeight:700 }}>Sign / Reject</h2>
          <button onClick={onClose} style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'0.5rem', padding:'5px 12px', cursor:'pointer', fontWeight:600 }}>✕</button>
        </div>
        <div style={{ padding:'1.5rem 2rem' }}>
          <div style={{ background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:'0.75rem', padding:'1rem', marginBottom:'1.25rem' }}>
            <div style={{ color:'#f1f5f9', fontWeight:600 }}>Assigned to: {sr.assigned_to_name}</div>
            {sr.assigned_to_role && <div style={{ color:'#64748b', fontSize:'0.85rem', marginTop:'2px' }}>{sr.assigned_to_role}</div>}
          </div>
          {error && <div style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.4)', borderRadius:'0.75rem', padding:'0.75rem 1rem', marginBottom:'1rem', color:'#fca5a5', fontSize:'0.875rem' }}>{error}</div>}
          <div>
            <label style={{ display:'block', color:'#94a3b8', fontSize:'0.8rem', fontWeight:600, marginBottom:'0.4rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Add a note or comment..." style={{ width:'100%', background:'rgba(15,23,42,0.6)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:'0.75rem', padding:'0.75rem 1rem', color:'#f1f5f9', fontSize:'0.9rem', outline:'none', boxSizing:'border-box', resize:'vertical' }} />
          </div>
        </div>
        <div style={{ padding:'1rem 2rem 1.5rem', display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ background:'rgba(99,102,241,0.1)', color:'#818cf8', border:'1px solid rgba(99,102,241,0.3)', borderRadius:'0.75rem', padding:'0.7rem 1.25rem', fontWeight:600, cursor:'pointer' }}>Cancel</button>
          <button onClick={() => act('reject')} disabled={loading} style={{ background:'rgba(239,68,68,0.15)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.4)', borderRadius:'0.75rem', padding:'0.7rem 1.25rem', fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer' }}>❌ Reject</button>
          <button onClick={() => act('sign')} disabled={loading} style={{ background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg,#10b981,#059669)', color:'#fff', border:'none', borderRadius:'0.75rem', padding:'0.7rem 1.25rem', fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Processing...' : '✅ Sign'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DocumentDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [doc, setDoc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeSR, setActiveSR] = useState(null)
  const [toast, setToast] = useState(null)

  const user = (() => { try { return JSON.parse(localStorage.getItem('qms_user') || '{}') } catch { return {} } })()

  function showToast(msg, type='success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function load() {
    setLoading(true)
    try {
      const data = await api(`/documents/${id}`)
      setDoc(data)
    } catch (err) {
      showToast('Failed to load document', 'error')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  function onSigned() {
    setActiveSR(null)
    showToast('Action recorded successfully!')
    load()
  }

  async function deleteDoc() {
    if (!window.confirm('Delete this document? This cannot be undone.')) return
    try {
      await api(`/documents/${id}`, { method:'DELETE' })
      showToast('Document deleted')
      setTimeout(() => nav('/documents'), 1000)
    } catch (err) {
      showToast(err?.message || 'Delete failed', 'error')
    }
  }

  if (loading) return <div style={{ padding:'4rem', textAlign:'center', color:'#64748b' }}>Loading document...</div>
  if (!doc) return <div style={{ padding:'4rem', textAlign:'center', color:'#ef4444' }}>Document not found</div>

  const ds = DOC_STATUS[doc.status] || DOC_STATUS.draft
  const requests = doc.sign_requests || []
  const signed = requests.filter(r => r.status==='signed').length
  const progress = requests.length > 0 ? (signed / requests.length) * 100 : 0

  // Find if current user has a pending sign request
  const myPending = requests.find(r =>
    r.status === 'pending' && (
      r.assigned_to_id === user.id ||
      r.assigned_to_name?.toLowerCase() === (user.full_name||user.username||'').toLowerCase() ||
      r.assigned_to_email === user.email
    )
  )

  return (
    <div style={{ padding:'2rem', maxWidth:'900px', margin:'0 auto' }}>
      {toast && <div style={{ position:'fixed', top:'1.5rem', right:'1.5rem', background: toast.type==='error' ? 'rgba(239,68,68,0.95)' : 'rgba(16,185,129,0.95)', color:'#fff', padding:'0.85rem 1.5rem', borderRadius:'0.75rem', fontWeight:600, zIndex:9999, boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}>{toast.msg}</div>}
      {activeSR && <SignModal sr={activeSR} docId={doc.id} onDone={onSigned} onClose={() => setActiveSR(null)} />}

      {/* Back */}
      <button onClick={() => nav('/documents')} style={{ background:'rgba(99,102,241,0.1)', color:'#818cf8', border:'1px solid rgba(99,102,241,0.2)', borderRadius:'0.75rem', padding:'0.5rem 1rem', fontWeight:600, cursor:'pointer', fontSize:'0.875rem', marginBottom:'1.5rem' }}>← Back to Documents</button>

      {/* Doc Header */}
      <div style={{ background:'rgba(30,41,59,0.6)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:'1.25rem', padding:'1.75rem 2rem', marginBottom:'1.5rem' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', flexWrap:'wrap', marginBottom:'0.5rem' }}>
              <h1 style={{ color:'#f1f5f9', margin:0, fontSize:'1.4rem', fontWeight:800 }}>{doc.title}</h1>
              <span style={{ background:`${ds.color}22`, color:ds.color, border:`1px solid ${ds.color}44`, borderRadius:'999px', padding:'3px 12px', fontSize:'0.8rem', fontWeight:700 }}>{ds.label}</span>
            </div>
            {doc.description && <p style={{ color:'#94a3b8', margin:'0 0 0.75rem', fontSize:'0.9rem' }}>{doc.description}</p>}
            <div style={{ display:'flex', gap:'1.5rem', flexWrap:'wrap' }}>
              {doc.batch_number && <span style={{ color:'#64748b', fontSize:'0.85rem' }}>📦 {doc.batch_number}</span>}
              {doc.created_by_name && <span style={{ color:'#64748b', fontSize:'0.85rem' }}>👤 Created by {doc.created_by_name}</span>}
              {doc.created_at && <span style={{ color:'#64748b', fontSize:'0.85rem' }}>📅 {new Date(doc.created_at).toLocaleDateString()}</span>}
            </div>
          </div>
          {(user.role === 'admin' || user.role === 'manager') && (
            <button onClick={deleteDoc} style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'0.75rem', padding:'0.6rem 1.25rem', fontWeight:600, cursor:'pointer', fontSize:'0.85rem', flexShrink:0 }}>🗑 Delete</button>
          )}
        </div>

        {/* Progress Bar */}
        {requests.length > 0 && (
          <div style={{ marginTop:'1.25rem' }}>
            <div style={{ display:'flex', justifyContent:'space-between', color:'#64748b', fontSize:'0.8rem', marginBottom:'0.4rem' }}>
              <span>Signing progress</span>
              <span>{signed}/{requests.length} signed</span>
            </div>
            <div style={{ height:'6px', background:'rgba(99,102,241,0.15)', borderRadius:'999px', overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${progress}%`, background:'linear-gradient(90deg,#6366f1,#10b981)', borderRadius:'999px', transition:'width 0.5s' }} />
            </div>
          </div>
        )}
      </div>

      {/* My Action Banner */}
      {myPending && (
        <div style={{ background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.4)', borderRadius:'1rem', padding:'1.25rem 1.5rem', marginBottom:'1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap' }}>
          <div>
            <div style={{ color:'#f1f5f9', fontWeight:700, marginBottom:'0.25rem' }}>✍️ Your signature is required</div>
            <div style={{ color:'#94a3b8', fontSize:'0.875rem' }}>You have a pending sign request on this document</div>
          </div>
          <button onClick={() => setActiveSR(myPending)} style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff', border:'none', borderRadius:'0.75rem', padding:'0.7rem 1.5rem', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>Sign Now →</button>
        </div>
      )}

      {/* Signers Timeline */}
      <div style={{ background:'rgba(30,41,59,0.6)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:'1.25rem', overflow:'hidden' }}>
        <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid rgba(99,102,241,0.1)' }}>
          <h2 style={{ color:'#f1f5f9', margin:0, fontSize:'1rem', fontWeight:700 }}>Signing Workflow</h2>
        </div>
        {requests.length === 0 ? (
          <div style={{ padding:'2.5rem', textAlign:'center', color:'#64748b' }}>No signers assigned</div>
        ) : (
          <div style={{ padding:'1rem 1.5rem' }}>
            {requests.sort((a,b) => (a.sign_order||0) - (b.sign_order||0)).map((sr, idx) => {
              const sm = STATUS_META[sr.status] || STATUS_META.pending
              const isMe = sr.assigned_to_id === user.id ||
                           sr.assigned_to_name?.toLowerCase() === (user.full_name||user.username||'').toLowerCase()
              return (
                <div key={sr.id} style={{ display:'flex', gap:'1rem', paddingBottom: idx < requests.length-1 ? '1.5rem' : 0, position:'relative' }}>
                  {/* Line */}
                  {idx < requests.length-1 && <div style={{ position:'absolute', left:'19px', top:'38px', width:'2px', bottom:0, background:'rgba(99,102,241,0.15)' }} />}
                  {/* Step indicator */}
                  <div style={{ width:'38px', height:'38px', borderRadius:'50%', background: sr.status==='signed' ? 'rgba(16,185,129,0.2)' : sr.status==='rejected' ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.2)', border:`2px solid ${sm.color}55`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', flexShrink:0, zIndex:1 }}>
                    {sm.icon}
                  </div>
                  {/* Content */}
                  <div style={{ flex:1, background:'rgba(15,23,42,0.3)', borderRadius:'0.75rem', padding:'0.875rem 1rem', ...(isMe && sr.status==='pending' ? { border:'1px solid rgba(99,102,241,0.3)', background:'rgba(99,102,241,0.07)' } : { border:'1px solid rgba(99,102,241,0.08)' }) }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.75rem', flexWrap:'wrap' }}>
                      <div>
                        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                          <span style={{ color:'#f1f5f9', fontWeight:600, fontSize:'0.95rem' }}>{sr.assigned_to_name}</span>
                          {isMe && <span style={{ background:'rgba(99,102,241,0.2)', color:'#818cf8', borderRadius:'999px', padding:'1px 8px', fontSize:'0.7rem', fontWeight:700 }}>You</span>}
                        </div>
                        <div style={{ color:'#64748b', fontSize:'0.8rem', marginTop:'2px' }}>
                          {sr.assigned_to_role && <span>{sr.assigned_to_role}</span>}
                          {sr.assigned_to_email && <span> · {sr.assigned_to_email}</span>}
                          {sr.sign_order && <span> · Step {sr.sign_order}</span>}
                        </div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                        <span style={{ background:`${sm.color}22`, color:sm.color, border:`1px solid ${sm.color}44`, borderRadius:'999px', padding:'3px 10px', fontSize:'0.75rem', fontWeight:700 }}>{sm.label}</span>
                        {isMe && sr.status === 'pending' && (
                          <button onClick={() => setActiveSR(sr)} style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff', border:'none', borderRadius:'0.5rem', padding:'5px 14px', fontWeight:700, cursor:'pointer', fontSize:'0.8rem' }}>Sign</button>
                        )}
                      </div>
                    </div>
                    {sr.notes && <div style={{ color:'#94a3b8', fontSize:'0.85rem', marginTop:'0.5rem', fontStyle:'italic' }}>"{sr.notes}"</div>}
                    {sr.rejection_reason && <div style={{ color:'#ef4444', fontSize:'0.85rem', marginTop:'0.5rem' }}>Rejection: {sr.rejection_reason}</div>}
                    {sr.signed_at && <div style={{ color:'#64748b', fontSize:'0.8rem', marginTop:'0.4rem' }}>{new Date(sr.signed_at).toLocaleString()}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
