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
    try { setTasks(await api('/documents/my-tasks').then(d => Array.isArray(d) ? d : [])) }
    catch { setTasks([]) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function act(sr, docId, action, notes) {
    try {
      await api(`/documents/${docId}/sign-requests/${sr.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ notes: notes || '' })
      })
      showToast(action === 'sign' ? '✅ Document signed!' : 'Rejected successfully')
      setSigning(null)
      load()
    } catch (err) {
      showToast(err?.message || 'Action failed', 'error')
    }
  }

  const pending = tasks.filter(t => t.status === 'pending')
  const done = tasks.filter(t => t.status !== 'pending')

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type==='error' ? 'error' : 'success'}`}>{toast.msg}</div>}

      {/* Sign Modal */}
      {signing && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth:460 }}>
            <div className="modal-header">
              <div className="modal-title">Sign Document</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSigning(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:12, marginBottom:14 }}>
                <div style={{ fontWeight:600 }}>{signing.sr.document?.title || 'Document'}</div>
                {signing.sr.document?.batch_number && (
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>📦 {signing.sr.document.batch_number}</div>
                )}
              </div>
              <div className="form-group">
                <label>Notes (optional)</label>
                <textarea
                  value={signing.notes}
                  onChange={e => setSigning(s => ({ ...s, notes: e.target.value }))}
                  rows={3}
                  placeholder="Add a comment…"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setSigning(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => act(signing.sr, signing.sr.document_id, 'reject', signing.notes)}>❌ Reject</button>
              <button className="btn btn-success" onClick={() => act(signing.sr, signing.sr.document_id, 'sign', signing.notes)}>✅ Sign</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">My Tasks</div>
          <div className="page-sub">Documents requiring your signature</div>
        </div>
        {pending.length > 0 && <span className="badge badge-yellow" style={{ fontSize:13, padding:'6px 14px' }}>{pending.length} pending</span>}
      </div>

      {loading ? (
        <div className="empty-state"><div className="empty-state-icon">⏳</div><div className="empty-state-title">Loading…</div></div>
      ) : (
        <>
          {/* Pending */}
          <div style={{ marginBottom:24 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <div className="section-header" style={{ margin:0 }}>Pending Signatures</div>
              {pending.length > 0 && <span className="badge badge-yellow">{pending.length}</span>}
            </div>
            {pending.length === 0 ? (
              <div className="empty-state" style={{ padding:28 }}>
                <div className="empty-state-icon">🎉</div>
                <div className="empty-state-title">All caught up!</div>
                <div className="empty-state-sub">No pending signatures</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {pending.map(sr => (
                  <div key={sr.id} className="card">
                    <div className="card-body" style={{ padding:'14px 18px' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div
                            style={{ fontWeight:700, fontSize:14, color:'var(--text)', marginBottom:4, cursor:'pointer' }}
                            onClick={() => nav(`/documents/${sr.document_id}`)}>
                            {sr.document?.title || `Document #${sr.document_id}`}
                          </div>
                          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                            {sr.document?.batch_number && <span style={{ fontSize:12, color:'var(--text-muted)' }}>📦 {sr.document.batch_number}</span>}
                            <span style={{ fontSize:12, color:'var(--text-muted)' }}>Step {sr.sign_order}</span>
                            {sr.document?.created_at && (
                              <span style={{ fontSize:12, color:'var(--text-muted)' }}>{new Date(sr.document.created_at).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => nav(`/documents/${sr.document_id}`)}>View</button>
                          <button className="btn btn-primary btn-sm" onClick={() => setSigning({ sr, notes:'' })}>✍️ Sign</button>
                        </div>
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
              <div className="section-header">Completed ({done.length})</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {done.map(sr => {
                  const isSigned = sr.status === 'signed'
                  return (
                    <div key={sr.id} className="card" style={{ cursor:'pointer' }} onClick={() => nav(`/documents/${sr.document_id}`)}>
                      <div className="card-body" style={{ padding:'12px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <span style={{ fontSize:13, color:'var(--text-secondary)', fontWeight:500 }}>{sr.document?.title || `Document #${sr.document_id}`}</span>
                          {sr.document?.batch_number && (
                            <span style={{ fontSize:12, color:'var(--text-muted)', marginLeft:10 }}>📦 {sr.document.batch_number}</span>
                          )}
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          {sr.signed_at && <span style={{ fontSize:11, color:'var(--text-muted)' }}>{new Date(sr.signed_at).toLocaleDateString()}</span>}
                          <span className={`badge ${isSigned ? 'badge-green' : 'badge-red'}`}>
                            {isSigned ? '✅ Signed' : '❌ Rejected'}
                          </span>
                        </div>
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
