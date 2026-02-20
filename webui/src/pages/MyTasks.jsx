import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'

export default function MyTasks() {
  const nav = useNavigate()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [signing, setSigning] = useState(null) // { sr, notes }

  function showToast(msg, type='success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function load() {
    setLoading(true)
    try {
      const data = await api('/documents/my-tasks')
      setTasks(Array.isArray(data) ? data : [])
    } catch { setTasks([]) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function act(sr, docId, action, notes) {
    try {
      await api(`/documents/${docId}/sign-requests/${sr.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ notes: notes || '' })
      })
      showToast(action === 'sign' ? 'Document signed!' : 'Rejected successfully')
      setSigning(null)
      load()
    } catch (err) {
      showToast(err?.message || 'Action failed', 'error')
    }
  }

  const pending = tasks.filter(t => t.status === 'pending')
  const done = tasks.filter(t => t.status !== 'pending')

  return (
    <div style={{ padding:'2rem', maxWidth:'900px', margin:'0 auto' }}>
      {toast && <div style={{ position:'fixed', top:'1.5rem', right:'1.5rem', background: toast.type==='error' ? 'rgba(239,68,68,0.95)' : 'rgba(16,185,129,0.95)', color:'#fff', padding:'0.85rem 1.5rem', borderRadius:'0.75rem', fontWeight:600, zIndex:9999, boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}>{toast.msg}</div>}

      {/* Sign Modal */}
      {signing && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'1rem' }}>
          <div style={{ background:'#1e293b', border:'1px solid rgba(99,102,241,0.3)', borderRadius:'1.5rem', width:'100%', maxWidth:'460px', boxShadow:'0 25px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ padding:'1.5rem 2rem', borderBottom:'1px solid rgba(99,102,241,0.15)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <h2 style={{ color:'#f1f5f9', margin:0, fontSize:'1.15rem', fontWeight:700 }}>Sign Document</h2>
              <button onClick={() => setSigning(null)} style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'0.5rem', padding:'5px 12px', cursor:'pointer', fontWeight:600 }}>✕</button>
            </div>
            <div style={{ padding:'1.5rem 2rem' }}>
              <div style={{ background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:'0.75rem', padding:'1rem', marginBottom:'1.25rem' }}>
                <div style={{ color:'#f1f5f9', fontWeight:700 }}>{signing.sr.document?.title || 'Document'}</div>
                {signing.sr.document?.batch_number && <div style={{ color:'#64748b', fontSize:'0.85rem', marginTop:'2px' }}>📦 Batch: {signing.sr.document.batch_number}</div>}
              </div>
              <label style={{ display:'block', color:'#94a3b8', fontSize:'0.8rem', fontWeight:600, marginBottom:'0.4rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>Notes (optional)</label>
              <textarea value={signing.notes} onChange={e => setSigning(s => ({ ...s, notes: e.target.value }))} rows={3} placeholder="Add a comment..." style={{ width:'100%', background:'rgba(15,23,42,0.6)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:'0.75rem', padding:'0.75rem 1rem', color:'#f1f5f9', fontSize:'0.9rem', outline:'none', boxSizing:'border-box', resize:'vertical' }} />
            </div>
            <div style={{ padding:'1rem 2rem 1.5rem', display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
              <button onClick={() => setSigning(null)} style={{ background:'rgba(99,102,241,0.1)', color:'#818cf8', border:'1px solid rgba(99,102,241,0.3)', borderRadius:'0.75rem', padding:'0.7rem 1.25rem', fontWeight:600, cursor:'pointer' }}>Cancel</button>
              <button onClick={() => act(signing.sr, signing.sr.document_id, 'reject', signing.notes)} style={{ background:'rgba(239,68,68,0.15)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.4)', borderRadius:'0.75rem', padding:'0.7rem 1.25rem', fontWeight:700, cursor:'pointer' }}>❌ Reject</button>
              <button onClick={() => act(signing.sr, signing.sr.document_id, 'sign', signing.notes)} style={{ background:'linear-gradient(135deg,#10b981,#059669)', color:'#fff', border:'none', borderRadius:'0.75rem', padding:'0.7rem 1.25rem', fontWeight:700, cursor:'pointer' }}>✅ Sign</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom:'2rem' }}>
        <h1 style={{ color:'#f1f5f9', fontSize:'1.75rem', fontWeight:800, margin:'0 0 0.4rem' }}>My Tasks</h1>
        <p style={{ color:'#64748b', margin:0 }}>Documents requiring your signature</p>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'4rem', color:'#64748b' }}>Loading tasks...</div>
      ) : (
        <>
          {/* Pending Tasks */}
          <div style={{ marginBottom:'2rem' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1rem' }}>
              <h2 style={{ color:'#f1f5f9', margin:0, fontSize:'1.1rem', fontWeight:700 }}>Pending Signatures</h2>
              {pending.length > 0 && <span style={{ background:'rgba(245,158,11,0.2)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.4)', borderRadius:'999px', padding:'2px 10px', fontSize:'0.75rem', fontWeight:700 }}>{pending.length}</span>}
            </div>
            {pending.length === 0 ? (
              <div style={{ background:'rgba(30,41,59,0.4)', border:'1px dashed rgba(99,102,241,0.2)', borderRadius:'1rem', padding:'2.5rem', textAlign:'center' }}>
                <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>🎉</div>
                <div style={{ color:'#94a3b8', fontWeight:600 }}>All caught up!</div>
                <div style={{ color:'#64748b', fontSize:'0.875rem', marginTop:'0.25rem' }}>No pending signatures</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                {pending.map(sr => (
                  <div key={sr.id} style={{ background:'rgba(30,41,59,0.7)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'1rem', padding:'1.25rem 1.5rem' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap' }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ color:'#f1f5f9', fontWeight:700, fontSize:'1rem', marginBottom:'0.3rem', cursor:'pointer' }} onClick={() => nav(`/documents/${sr.document_id}`)}>
                          {sr.document?.title || `Document #${sr.document_id}`}
                        </div>
                        <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap' }}>
                          {sr.document?.batch_number && <span style={{ color:'#94a3b8', fontSize:'0.8rem' }}>📦 {sr.document.batch_number}</span>}
                          <span style={{ color:'#94a3b8', fontSize:'0.8rem' }}>Step {sr.sign_order}</span>
                          {sr.document?.created_at && <span style={{ color:'#64748b', fontSize:'0.8rem' }}>{new Date(sr.document.created_at).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:'0.5rem', flexShrink:0 }}>
                        <button onClick={() => nav(`/documents/${sr.document_id}`)} style={{ background:'rgba(99,102,241,0.15)', color:'#818cf8', border:'1px solid rgba(99,102,241,0.3)', borderRadius:'0.5rem', padding:'6px 12px', fontWeight:600, cursor:'pointer', fontSize:'0.8rem' }}>View</button>
                        <button onClick={() => setSigning({ sr, notes:'' })} style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff', border:'none', borderRadius:'0.5rem', padding:'6px 14px', fontWeight:700, cursor:'pointer', fontSize:'0.8rem' }}>✍️ Sign</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Completed */}
          {done.length > 0 && (
            <div>
              <h2 style={{ color:'#64748b', margin:'0 0 1rem', fontSize:'1rem', fontWeight:700 }}>Completed ({done.length})</h2>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                {done.map(sr => {
                  const isSign = sr.status === 'signed'
                  return (
                    <div key={sr.id} style={{ background:'rgba(30,41,59,0.4)', border:'1px solid rgba(99,102,241,0.1)', borderRadius:'0.75rem', padding:'0.875rem 1.25rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap', cursor:'pointer' }} onClick={() => nav(`/documents/${sr.document_id}`)}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <span style={{ color:'#94a3b8', fontSize:'0.9rem' }}>{sr.document?.title || `Document #${sr.document_id}`}</span>
                        {sr.document?.batch_number && <span style={{ color:'#64748b', fontSize:'0.8rem', marginLeft:'0.75rem' }}>📦 {sr.document.batch_number}</span>}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                        {sr.signed_at && <span style={{ color:'#64748b', fontSize:'0.8rem' }}>{new Date(sr.signed_at).toLocaleDateString()}</span>}
                        <span style={{ background: isSign ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.1)', color: isSign ? '#10b981' : '#ef4444', border:`1px solid ${isSign ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.3)'}`, borderRadius:'999px', padding:'2px 10px', fontSize:'0.75rem', fontWeight:700 }}>{isSign ? '✅ Signed' : '❌ Rejected'}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
