import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api.js'

const BASE = '/api/v1'

const SR_STATUS = {
  pending:  { badge:'badge-yellow', label:'Pending',  icon:'⏳' },
  signed:   { badge:'badge-green',  label:'Signed',   icon:'✅' },
  rejected: { badge:'badge-red',    label:'Rejected', icon:'❌' },
  skipped:  { badge:'badge-gray',   label:'Skipped',  icon:'⏭' },
}
const DOC_STATUS = {
  draft:       { badge:'badge-gray',   label:'Draft' },
  in_progress: { badge:'badge-yellow', label:'In Progress' },
  complete:    { badge:'badge-green',  label:'Complete' },
  rejected:    { badge:'badge-red',    label:'Rejected' },
}

/* ─── PDF Viewer with signature overlays ─────────────── */
function PdfViewer({ docId, signRequests, currentUserId, currentUserName, currentUserEmail, onSign }) {
  const canvasRef = useRef(null)
  const [pdfDoc, setPdfDoc] = useState(null)
  const [pageNum, setPageNum] = useState(1)
  const [numPages, setNumPages] = useState(1)
  const [scale] = useState(1.4)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const TOKEN = localStorage.getItem('qms_token')
  const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#06b6d4','#8b5cf6']

  useEffect(() => {
    async function load() {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
        const task = pdfjsLib.getDocument({
          url: `${BASE}/documents/${docId}/pdf`,
          httpHeaders: { Authorization: `Bearer ${TOKEN}` }
        })
        const pdf = await task.promise
        setPdfDoc(pdf)
        setNumPages(pdf.numPages)
        setLoaded(true)
      } catch (e) {
        setError('Could not load PDF: ' + (e.message || e))
      }
    }
    load()
  }, [docId])

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return
    renderPage()
  }, [pdfDoc, pageNum, signRequests])

  async function renderPage() {
    const page = await pdfDoc.getPage(pageNum)
    const vp = page.getViewport({ scale })
    const canvas = canvasRef.current
    canvas.width = vp.width
    canvas.height = vp.height
    const ctx = canvas.getContext('2d')
    await page.render({ canvasContext: ctx, viewport: vp }).promise
    // Draw placeholder boxes
    signRequests
      .filter(sr => (sr.placeholder_page || 1) === pageNum && sr.placeholder_x != null)
      .forEach((sr, idx) => {
        const x = sr.placeholder_x / 100 * canvas.width
        const y = sr.placeholder_y / 100 * canvas.height
        const w = sr.placeholder_w / 100 * canvas.width
        const h = sr.placeholder_h / 100 * canvas.height
        const color = COLORS[idx % COLORS.length]
        const isSigned = sr.status === 'signed'
        const isRejected = sr.status === 'rejected'
        ctx.strokeStyle = isSigned ? '#16a34a' : isRejected ? '#ef4444' : color
        ctx.lineWidth = 2
        ctx.setLineDash(isSigned ? [] : [6,3])
        ctx.strokeRect(x, y, w, h)
        ctx.fillStyle = (isSigned ? '#16a34a' : isRejected ? '#ef4444' : color) + '15'
        ctx.fillRect(x, y, w, h)
        ctx.setLineDash([])
        ctx.fillStyle = isSigned ? '#16a34a' : isRejected ? '#ef4444' : color
        ctx.font = 'bold 11px Inter, sans-serif'
        const icon = isSigned ? '✓ ' : isRejected ? '✕ ' : '✍ '
        ctx.fillText(icon + (sr.assigned_to_name || ''), x + 4, y + 14)
        if (isSigned && sr.signed_at) {
          ctx.font = '10px Inter, sans-serif'
          ctx.fillStyle = '#15803d'
          ctx.fillText(new Date(sr.signed_at).toLocaleDateString(), x + 4, y + 26)
        }
      })
  }

  // clickable areas
  function handleCanvasClick(e) {
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const cx = (e.clientX - rect.left) * (canvasRef.current.width / rect.width)
    const cy = (e.clientY - rect.top) * (canvasRef.current.height / rect.height)
    const cw = canvasRef.current.width
    const ch = canvasRef.current.height
    const hit = signRequests.find(sr =>
      (sr.placeholder_page || 1) === pageNum &&
      sr.placeholder_x != null &&
      sr.status === 'pending' && (
        sr.assigned_to_id === currentUserId ||
        sr.assigned_to_name?.toLowerCase() === (currentUserName||'').toLowerCase() ||
        sr.assigned_to_email === currentUserEmail
      ) &&
      cx >= sr.placeholder_x/100*cw &&
      cx <= (sr.placeholder_x + sr.placeholder_w)/100*cw &&
      cy >= sr.placeholder_y/100*ch &&
      cy <= (sr.placeholder_y + sr.placeholder_h)/100*ch
    )
    if (hit) onSign(hit)
  }

  if (error) return <div style={{ padding:20, color:'#b91c1c', background:'#fee2e2', borderRadius:8 }}>{error}</div>

  return (
    <div>
      {numPages > 1 && (
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setPageNum(p=>Math.max(1,p-1))} disabled={pageNum===1}>‹ Prev</button>
          <span style={{ fontSize:12, color:'var(--text-muted)' }}>Page {pageNum} / {numPages}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setPageNum(p=>Math.min(numPages,p+1))} disabled={pageNum===numPages}>Next ›</button>
        </div>
      )}
      <div style={{ background:'#525659', borderRadius:8, padding:12, overflowX:'auto' }}>
        {!loaded ? (
          <div style={{ color:'#fff', padding:32, textAlign:'center', opacity:.6 }}>Loading PDF…</div>
        ) : (
          <canvas ref={canvasRef}
            style={{ display:'block', maxWidth:'100%', boxShadow:'0 4px 20px rgba(0,0,0,.4)', cursor:'pointer' }}
            onClick={handleCanvasClick}
            title="Click your signature box to sign"
          />
        )}
      </div>
      <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:6 }}>
        💡 Click on your signature box to sign
      </p>
    </div>
  )
}

/* ─── Sign / Reject modal ─────────────────────────────── */
function SignModal({ sr, docId, onDone, onClose }) {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function act(action) {
    setLoading(true); setError('')
    try {
      await api(`/documents/${docId}/sign-requests/${sr.id}/${action}`, {
        method:'POST', body: JSON.stringify({ notes })
      })
      onDone()
    } catch (err) {
      setError(err?.message || 'Action failed')
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth:460 }}>
        <div className="modal-header">
          <div className="modal-title">Sign Document</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:12, marginBottom:14 }}>
            <div style={{ fontWeight:600, color:'var(--text)' }}>Assigned to: {sr.assigned_to_name}</div>
            {sr.assigned_to_role && <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{sr.assigned_to_role}</div>}
          </div>
          {error && (
            <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:8, padding:'10px 14px', marginBottom:12, color:'#b91c1c', fontSize:13 }}>
              {error}
            </div>
          )}
          <div className="form-group">
            <label>Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Add a note or comment…" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={() => act('reject')} disabled={loading}>❌ Reject</button>
          <button className="btn btn-success" onClick={() => act('sign')} disabled={loading}>
            {loading ? 'Processing…' : '✅ Sign'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Main DocumentDetail page ────────────────────────── */
export default function DocumentDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [doc, setDoc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeSR, setActiveSR] = useState(null)
  const [toast, setToast] = useState(null)
  const [tab, setTab] = useState('workflow') // 'workflow' | 'pdf'

  const user = (() => { try { return JSON.parse(localStorage.getItem('qms_user')||'{}') } catch { return {} } })()

  // Robust "is this sign-request mine?" helper
  function isMyRequest(r) {
    if (!r) return false
    const uid = user.user_id || user.id || user.sub
    const myName = (user.full_name || user.username || '').toLowerCase().trim()
    const myEmail = (user.email || '').toLowerCase().trim()
    if (uid && r.assigned_to_id && r.assigned_to_id === uid) return true
    if (myEmail && r.assigned_to_email && r.assigned_to_email.toLowerCase() === myEmail) return true
    if (myName && r.assigned_to_name && r.assigned_to_name.toLowerCase().trim() === myName) return true
    // username match fallback
    const myUsername = (user.username || '').toLowerCase().trim()
    if (myUsername && r.assigned_to_name && r.assigned_to_name.toLowerCase().trim() === myUsername) return true
    return false
  }

  function showToast(msg, type='success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function load() {
    setLoading(true)
    try { setDoc(await api(`/documents/${id}`)) }
    catch { showToast('Failed to load document', 'error') }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  function onSigned() {
    setActiveSR(null)
    showToast('Action recorded!')
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

  if (loading) return (
    <div className="empty-state">
      <div className="empty-state-icon">⏳</div>
      <div className="empty-state-title">Loading document…</div>
    </div>
  )
  if (!doc) return (
    <div className="empty-state">
      <div className="empty-state-icon">⚠️</div>
      <div className="empty-state-title">Document not found</div>
    </div>
  )

  const ds = DOC_STATUS[doc.status] || DOC_STATUS.draft
  const requests = doc.sign_requests || []
  const signed = requests.filter(r => r.status === 'signed').length
  const progress = requests.length > 0 ? (signed / requests.length) * 100 : 0

  const myPending = requests.find(r =>
    r.status === 'pending' && isMyRequest(r)
  )

  const hasPdf = !!doc.pdf_filename
  const hasPlaceholders = requests.some(r => r.placeholder_x != null)

  return (
    <div style={{ maxWidth:900, margin:'0 auto' }}>
      {toast && <div className={`toast toast-${toast.type==='error' ? 'error' : 'success'}`}>{toast.msg}</div>}
      {activeSR && <SignModal sr={activeSR} docId={doc.id} onDone={onSigned} onClose={() => setActiveSR(null)} />}

      {/* Back */}
      <button className="btn btn-ghost btn-sm" style={{ marginBottom:16 }} onClick={() => nav('/documents')}>
        ← Back to Documents
      </button>

      {/* Doc header card */}
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-body" style={{ padding:'20px 24px' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:6 }}>
                <h1 style={{ fontSize:18, fontWeight:800, color:'var(--text)', margin:0 }}>{doc.title}</h1>
                <span className={`badge ${ds.badge}`}>{ds.label}</span>
                {hasPdf && <span className="badge badge-blue">📄 PDF</span>}
              </div>
              {doc.description && <p style={{ fontSize:13, color:'var(--text-muted)', margin:'0 0 8px' }}>{doc.description}</p>}
              <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                {doc.batch_number && <span style={{ fontSize:12, color:'var(--text-muted)' }}>📦 {doc.batch_number}</span>}
                {doc.created_by_name && <span style={{ fontSize:12, color:'var(--text-muted)' }}>👤 {doc.created_by_name}</span>}
                {doc.created_at && <span style={{ fontSize:12, color:'var(--text-muted)' }}>📅 {new Date(doc.created_at).toLocaleDateString()}</span>}
              </div>
            </div>
            {(user.role === 'admin' || user.role === 'manager') && (
              <button className="btn btn-danger btn-sm" onClick={deleteDoc}>🗑 Delete</button>
            )}
          </div>

          {/* Progress bar */}
          {requests.length > 0 && (
            <div style={{ marginTop:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>
                <span>Signing progress</span>
                <span>{signed}/{requests.length} signed</span>
              </div>
              <div style={{ height:6, background:'var(--bg-secondary)', borderRadius:99, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${progress}%`, background:'linear-gradient(90deg,var(--brand),#10b981)', borderRadius:99, transition:'width .5s' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* My action banner */}
      {myPending && (
        <div style={{ background:'#ede9fe', border:'1px solid #c4b5fd', borderRadius:12, padding:'14px 18px', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div>
            <div style={{ fontWeight:700, color:'#4c1d95', marginBottom:2 }}>✍️ Your signature is required</div>
            <div style={{ fontSize:12, color:'#7c3aed' }}>
              {hasPdf && hasPlaceholders ? 'Click your signature box on the PDF, or use the button →' : 'Click Sign Now to complete your signature'}
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => {
            if (hasPdf && hasPlaceholders) setTab('pdf')
            else setActiveSR(myPending)
          }}>
            {hasPdf && hasPlaceholders ? 'Go to PDF →' : 'Sign Now →'}
          </button>
        </div>
      )}

      {/* Tabs — only show PDF tab if PDF exists */}
      <div style={{ display:'flex', gap:4, marginBottom:16, background:'var(--bg-secondary)', padding:4, borderRadius:10, width:'fit-content' }}>
        <button className={`btn btn-sm ${tab==='workflow' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('workflow')}>
          📋 Workflow
        </button>
        {hasPdf && (
          <button className={`btn btn-sm ${tab==='pdf' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('pdf')}>
            📄 PDF {hasPlaceholders && '(Sign here)'}
          </button>
        )}
      </div>

      {/* ── Workflow tab ── */}
      {tab === 'workflow' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Signing Workflow</div>
          </div>
          {requests.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👤</div>
              <div className="empty-state-title">No signers assigned</div>
            </div>
          ) : (
            <div style={{ padding:'12px 18px' }}>
              {requests
                .slice()
                .sort((a,b) => (a.sign_order||0) - (b.sign_order||0))
                .map((sr, idx) => {
                  const sm = SR_STATUS[sr.status] || SR_STATUS.pending
                  const isMe = isMyRequest(sr)
                  return (
                    <div key={sr.id} style={{ display:'flex', gap:12, paddingBottom: idx < requests.length-1 ? 20 : 0, position:'relative' }}>
                      {idx < requests.length-1 && (
                        <div style={{ position:'absolute', left:17, top:38, width:2, bottom:0, background:'var(--border)' }} />
                      )}
                      {/* Circle */}
                      <div style={{ width:36, height:36, borderRadius:'50%', background: sr.status==='signed' ? '#dcfce7' : sr.status==='rejected' ? '#fee2e2' : 'var(--bg-secondary)', border:`2px solid ${sr.status==='signed' ? '#86efac' : sr.status==='rejected' ? '#fca5a5' : 'var(--border)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0, zIndex:1 }}>
                        {sm.icon}
                      </div>
                      {/* Content */}
                      <div style={{ flex:1, background: isMe && sr.status==='pending' ? '#f5f3ff' : 'var(--bg)', border:`1px solid ${isMe && sr.status==='pending' ? '#c4b5fd' : 'var(--border)'}`, borderRadius:10, padding:'10px 14px', marginBottom:4 }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
                          <div>
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <span style={{ fontWeight:600, fontSize:13, color:'var(--text)' }}>{sr.assigned_to_name}</span>
                              {isMe && <span className="badge badge-purple">You</span>}
                            </div>
                            <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:1 }}>
                              {[sr.assigned_to_role, sr.assigned_to_email, `Step ${sr.sign_order}`].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span className={`badge ${sm.badge}`}>{sm.label}</span>
                            {isMe && sr.status === 'pending' && (
                              <button className="btn btn-primary btn-sm" onClick={() => setActiveSR(sr)}>Sign</button>
                            )}
                          </div>
                        </div>
                        {sr.notes && <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:6, fontStyle:'italic' }}>"{sr.notes}"</div>}
                        {sr.rejection_reason && <div style={{ fontSize:12, color:'#b91c1c', marginTop:6 }}>Rejection: {sr.rejection_reason}</div>}
                        {sr.signed_at && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>{new Date(sr.signed_at).toLocaleString()}</div>}
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {/* ── PDF tab ── */}
      {tab === 'pdf' && hasPdf && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              Document PDF
              {hasPlaceholders && myPending && (
                <span style={{ marginLeft:8, fontSize:12, fontWeight:500, color:'var(--brand)' }}>— click your signature box to sign</span>
              )}
            </div>
          </div>
          <div className="card-body">
            <PdfViewer
              docId={doc.id}
              signRequests={requests}
              currentUserId={user.user_id || user.id}
              currentUserName={user.full_name || user.username}
              currentUserEmail={user.email || ''}
              onSign={sr => setActiveSR(sr)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
