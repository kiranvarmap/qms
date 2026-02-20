import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'

const BASE = '/api/v1'
const STATUS_META = {
  draft:       { badge:'badge-gray',   label:'Draft' },
  in_progress: { badge:'badge-yellow', label:'In Progress' },
  complete:    { badge:'badge-green',  label:'Complete' },
  rejected:    { badge:'badge-red',    label:'Rejected' },
}

/* ── Toast helper ── */
function Toast({ msg, type }) {
  return <div className={`toast toast-${type==='error' ? 'error' : 'success'}`}>{msg}</div>
}

/* ══════════════════════════════════════════════════════
   PDF PAGE VIEWER + PLACEHOLDER DRAWER
   ══════════════════════════════════════════════════════ */
function PdfPlacementEditor({ docId, signers, onPlaceholdersSaved, onBack }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [pdfDoc, setPdfDoc] = useState(null)
  const [pageNum, setPageNum] = useState(1)
  const [numPages, setNumPages] = useState(1)
  const [scale, setScale] = useState(1.2)
  const [drawing, setDrawing] = useState(null)   // { x0, y0, x1, y1 } in canvas px
  const [boxes, setBoxes] = useState([])         // { signerIdx, page, xPct, yPct, wPct, hPct, id }
  const [selectedSigner, setSelectedSigner] = useState(0)
  const [pdfLoaded, setPdfLoaded] = useState(false)
  const [pdfError, setPdfError] = useState('')
  const [saving, setSaving] = useState(false)
  const TOKEN = localStorage.getItem('qms_token')

  useEffect(() => {
    async function loadPdf() {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
        const loadingTask = pdfjsLib.getDocument({
          url: `${BASE}/documents/${docId}/pdf`,
          httpHeaders: { Authorization: `Bearer ${TOKEN}` }
        })
        const pdf = await loadingTask.promise
        setPdfDoc(pdf)
        setNumPages(pdf.numPages)
        setPdfLoaded(true)
      } catch (e) {
        setPdfError('Could not load PDF: ' + (e.message || e))
      }
    }
    loadPdf()
  }, [docId])

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return
    renderPage(pdfDoc, pageNum, scale)
  }, [pdfDoc, pageNum, scale])

  async function renderPage(pdf, num, sc) {
    const page = await pdf.getPage(num)
    const vp = page.getViewport({ scale: sc })
    const canvas = canvasRef.current
    canvas.width = vp.width
    canvas.height = vp.height
    const ctx = canvas.getContext('2d')
    await page.render({ canvasContext: ctx, viewport: vp }).promise
    // redraw boxes on top
    redrawBoxes(ctx, canvas.width, canvas.height)
  }

  function redrawBoxes(ctx, w, h) {
    boxes.filter(b => b.page === pageNum).forEach(b => {
      const x = b.xPct / 100 * w
      const y = b.yPct / 100 * h
      const bw = b.wPct / 100 * w
      const bh = b.hPct / 100 * h
      const colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#06b6d4','#8b5cf6']
      const color = colors[b.signerIdx % colors.length]
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.setLineDash([6, 3])
      ctx.strokeRect(x, y, bw, bh)
      ctx.fillStyle = color + '22'
      ctx.fillRect(x, y, bw, bh)
      ctx.setLineDash([])
      ctx.fillStyle = color
      ctx.font = 'bold 11px Inter, sans-serif'
      ctx.fillText(signers[b.signerIdx]?.name || `Signer ${b.signerIdx+1}`, x + 4, y + 14)
    })
  }

  function getCanvasPos(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvasRef.current.width / rect.width),
      y: (e.clientY - rect.top) * (canvasRef.current.height / rect.height)
    }
  }

  function onMouseDown(e) {
    const pos = getCanvasPos(e)
    setDrawing({ x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y })
  }

  function onMouseMove(e) {
    if (!drawing) return
    const pos = getCanvasPos(e)
    setDrawing(d => ({ ...d, x1: pos.x, y1: pos.y }))
    // live preview
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!pdfDoc) return
    pdfDoc.getPage(pageNum).then(page => {
      const vp = page.getViewport({ scale })
      page.render({ canvasContext: ctx, viewport: vp }).promise.then(() => {
        redrawBoxes(ctx, canvas.width, canvas.height)
        const { x0, y0 } = drawing
        const x1 = pos.x, y1 = pos.y
        const colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#06b6d4','#8b5cf6']
        const color = colors[selectedSigner % colors.length]
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.setLineDash([6, 3])
        ctx.strokeRect(x0, y0, x1 - x0, y1 - y0)
        ctx.fillStyle = color + '22'
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
        ctx.setLineDash([])
      })
    })
  }

  function onMouseUp(e) {
    if (!drawing) return
    const pos = getCanvasPos(e)
    const x0 = Math.min(drawing.x0, pos.x)
    const y0 = Math.min(drawing.y0, pos.y)
    const x1 = Math.max(drawing.x0, pos.x)
    const y1 = Math.max(drawing.y0, pos.y)
    if (x1 - x0 < 20 || y1 - y0 < 10) { setDrawing(null); return }
    const w = canvasRef.current.width
    const h = canvasRef.current.height
    const newBox = {
      id: Date.now(),
      signerIdx: selectedSigner,
      page: pageNum,
      xPct: x0 / w * 100,
      yPct: y0 / h * 100,
      wPct: (x1 - x0) / w * 100,
      hPct: (y1 - y0) / h * 100,
    }
    setBoxes(prev => {
      const updated = [...prev.filter(b => b.signerIdx !== selectedSigner || b.page !== pageNum), newBox]
      return updated
    })
    setDrawing(null)
    // advance to next signer automatically
    if (selectedSigner < signers.length - 1) setSelectedSigner(s => s + 1)
    // re-render with new box
    if (pdfDoc) {
      pdfDoc.getPage(pageNum).then(page => {
        const vp = page.getViewport({ scale })
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        page.render({ canvasContext: ctx, viewport: vp }).promise.then(() => {
          const updatedBoxes = [...boxes.filter(b => b.signerIdx !== selectedSigner || b.page !== pageNum), newBox]
          updatedBoxes.filter(b => b.page === pageNum).forEach(b => {
            const bx = b.xPct / 100 * canvas.width
            const by = b.yPct / 100 * canvas.height
            const bw = b.wPct / 100 * canvas.width
            const bh = b.hPct / 100 * canvas.height
            const colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#06b6d4','#8b5cf6']
            const c = colors[b.signerIdx % colors.length]
            ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.setLineDash([6,3])
            ctx.strokeRect(bx, by, bw, bh)
            ctx.fillStyle = c + '22'; ctx.fillRect(bx, by, bw, bh)
            ctx.setLineDash([])
            ctx.fillStyle = c; ctx.font = 'bold 11px Inter, sans-serif'
            ctx.fillText(signers[b.signerIdx]?.name || `Signer ${b.signerIdx+1}`, bx + 4, by + 14)
          })
        })
      })
    }
  }

  async function savePlaceholders() {
    setSaving(true)
    try {
      for (const b of boxes) {
        const sr = signers[b.signerIdx]
        if (!sr?.sign_request_id) continue
        await fetch(`${BASE}/documents/${docId}/sign-requests/${sr.sign_request_id}/placeholder`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
          body: JSON.stringify({
            placeholder_page: b.page,
            placeholder_x: b.xPct,
            placeholder_y: b.yPct,
            placeholder_w: b.wPct,
            placeholder_h: b.hPct,
          })
        })
      }
      onPlaceholdersSaved()
    } catch (e) {
      alert('Failed to save placeholders: ' + e.message)
    }
    setSaving(false)
  }

  const colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#06b6d4','#8b5cf6']

  return (
    <div>
      <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:16 }}>
        Draw a signature box on the PDF for each signer. Click and drag to place the box. The selected signer changes automatically.
      </p>

      {/* Signer selector */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
        {signers.map((s, i) => {
          const hasBox = boxes.find(b => b.signerIdx === i)
          return (
            <button key={i} onClick={() => setSelectedSigner(i)}
              style={{ padding:'6px 14px', borderRadius:8, border:`2px solid ${i===selectedSigner ? colors[i%colors.length] : 'var(--border)'}`, background: i===selectedSigner ? colors[i%colors.length]+'22' : '#fff', color: i===selectedSigner ? colors[i%colors.length] : 'var(--text-muted)', fontWeight:600, fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
              {hasBox ? '✓' : '○'} {s.name || `Signer ${i+1}`}
            </button>
          )
        })}
      </div>

      {/* Page controls */}
      {numPages > 1 && (
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setPageNum(p => Math.max(1,p-1))} disabled={pageNum===1}>‹</button>
          <span style={{ fontSize:12, color:'var(--text-muted)' }}>Page {pageNum} / {numPages}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setPageNum(p => Math.min(numPages,p+1))} disabled={pageNum===numPages}>›</button>
        </div>
      )}

      {/* PDF canvas */}
      <div ref={containerRef} style={{ background:'#525659', borderRadius:8, padding:16, overflowX:'auto', marginBottom:16 }}>
        {pdfError ? (
          <div style={{ color:'#fca5a5', padding:32, textAlign:'center' }}>{pdfError}</div>
        ) : !pdfLoaded ? (
          <div style={{ color:'#fff', padding:32, textAlign:'center', opacity:.6 }}>Loading PDF…</div>
        ) : (
          <canvas
            ref={canvasRef}
            style={{ display:'block', cursor:'crosshair', maxWidth:'100%', boxShadow:'0 4px 20px rgba(0,0,0,.4)', userSelect:'none' }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={() => setDrawing(null)}
          />
        )}
      </div>

      {/* Placed boxes list */}
      {boxes.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div className="section-header">Placed Signature Boxes</div>
          {boxes.map(b => (
            <div key={b.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ width:10, height:10, borderRadius:3, background:colors[b.signerIdx%colors.length], flexShrink:0 }} />
              <span style={{ fontSize:13, flex:1 }}>{signers[b.signerIdx]?.name} — Page {b.page}</span>
              <button onClick={() => setBoxes(prev => prev.filter(x => x.id !== b.id))} className="btn btn-ghost btn-xs">Remove</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between' }}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <button className="btn btn-primary" onClick={savePlaceholders} disabled={saving || boxes.length === 0}>
          {saving ? 'Saving…' : `Save ${boxes.length} Placement${boxes.length !== 1 ? 's' : ''} →`}
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   CREATE DOCUMENT MODAL  (4 steps)
   ══════════════════════════════════════════════════════ */
function CreateDocModal({ onClose, onCreated }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ title:'', description:'', batch_id:'', batch_number:'' })
  const [signers, setSigners] = useState([{ name:'', role:'', email:'', order:1 }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [batches, setBatches] = useState([])
  const [createdDoc, setCreatedDoc] = useState(null)  // doc after step-2 creation
  const [pdfFile, setPdfFile] = useState(null)
  const [pdfUploading, setPdfUploading] = useState(false)
  const [pdfUploaded, setPdfUploaded] = useState(false)
  const fileRef = useRef()
  const TOKEN = localStorage.getItem('qms_token')

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

  // Step 1→2: create document record
  async function createDoc() {
    setError('')
    if (!form.title.trim()) { setError('Title is required'); return }
    if (signers.some(s => !s.name.trim())) { setError('All signer names are required'); return }
    setLoading(true)
    try {
      const payload = {
        ...form,
        signers: signers.map((s,i) => ({
          ...s, sign_order: i+1,
          assigned_to_name: s.name,
          assigned_to_role: s.role,
          assigned_to_email: s.email
        }))
      }
      const doc = await api('/documents', { method:'POST', body: JSON.stringify(payload) })
      setCreatedDoc(doc)
      setStep(2)
    } catch (err) {
      setError(err?.message || 'Failed to create document')
    }
    setLoading(false)
  }

  async function uploadPdf() {
    if (!pdfFile) { setStep(3); return }
    setPdfUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', pdfFile)
      const res = await fetch(`${BASE}/documents/${createdDoc.id}/upload-pdf`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}` },
        body: fd
      })
      if (!res.ok) throw new Error(await res.text())
      setPdfUploaded(true)
      // Reload doc to get sign_request ids
      const updated = await api(`/documents/${createdDoc.id}`)
      setCreatedDoc(updated)
      setStep(3)
    } catch (e) {
      setError('PDF upload failed: ' + e.message)
    }
    setPdfUploading(false)
  }

  function skipPdf() {
    setStep(4)
    onCreated(createdDoc)
  }

  // signers with their sign_request_id filled from createdDoc
  const signersWithIds = signers.map((s, i) => ({
    ...s,
    sign_request_id: createdDoc?.sign_requests?.[i]?.id
  }))

  const STEP_LABELS = ['Details & Signers', 'Upload PDF', 'Place Signatures', 'Done']

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth:680 }}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-title">New Sign-off Document</div>
            {/* Steps */}
            <div className="steps" style={{ marginTop:10, marginBottom:0 }}>
              {STEP_LABELS.map((label, i) => {
                const s = i + 1
                const cls = step > s ? 'step-done' : step === s ? 'step-active' : 'step-pending'
                return (
                  <div key={s} className={`step ${cls}`}>
                    <div className="step-circle">{step > s ? '✓' : s}</div>
                    <span className="step-label">{label}</span>
                    {i < STEP_LABELS.length - 1 && <div className="step-line" />}
                  </div>
                )
              })}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {error && (
            <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:8, padding:'10px 14px', marginBottom:16, color:'#b91c1c', fontSize:13 }}>
              {error}
            </div>
          )}

          {/* ─── STEP 1: Details + Signers ─── */}
          {step === 1 && (
            <div>
              <div className="form-group">
                <label>Document Title *</label>
                <input value={form.title} onChange={setF('title')} placeholder="e.g. Batch B2024-001 Quality Sign-off" />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={form.description} onChange={setF('description')} rows={2} placeholder="Purpose of this sign-off document…" />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label>Batch</label>
                  <select value={form.batch_id} onChange={e => {
                    const b = batches.find(x => String(x.id) === e.target.value)
                    setForm(f => ({ ...f, batch_id: e.target.value, batch_number: b?.batch_number||'' }))
                  }}>
                    <option value="">Select batch (optional)</option>
                    {batches.map(b => <option key={b.id} value={b.id}>{b.batch_number} — {b.product_name||''}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label>Batch Number (manual)</label>
                  <input value={form.batch_number} onChange={setF('batch_number')} placeholder="B2024-001" />
                </div>
              </div>

              <div className="section-header" style={{ marginTop:8 }}>Signers (in signing order)</div>
              {signers.map((s, i) => (
                <div key={i} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:12, marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:'var(--brand)' }}>Signer #{i+1}</span>
                    {signers.length > 1 && (
                      <button onClick={() => removeSigner(i)} className="btn btn-ghost btn-xs" style={{ color:'#ef4444', borderColor:'#fca5a5' }}>Remove</button>
                    )}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    <div className="form-group" style={{ marginBottom:0 }}>
                      <label>Full Name *</label>
                      <input value={s.name} onChange={e => setSigner(i,'name',e.target.value)} placeholder="Jane Smith" />
                    </div>
                    <div className="form-group" style={{ marginBottom:0 }}>
                      <label>Role</label>
                      <select value={s.role} onChange={e => setSigner(i,'role',e.target.value)}>
                        <option value="">Select role</option>
                        {['operator','inspector','supervisor','qa','manager','admin'].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ gridColumn:'1/-1', marginBottom:0 }}>
                      <label>Email</label>
                      <input value={s.email} onChange={e => setSigner(i,'email',e.target.value)} placeholder="jane@company.com" />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addSigner} className="btn btn-ghost" style={{ width:'100%', borderStyle:'dashed' }}>
                + Add Signer
              </button>
            </div>
          )}

          {/* ─── STEP 2: Upload PDF ─── */}
          {step === 2 && (
            <div>
              <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:20 }}>
                Upload a PDF for this document. Signers will be able to see the PDF and you can place signature boxes on it. You can also skip this step.
              </p>
              <div
                onClick={() => fileRef.current.click()}
                style={{ border:`2px dashed ${pdfFile ? 'var(--brand)' : 'var(--border)'}`, borderRadius:12, padding:32, textAlign:'center', cursor:'pointer', background: pdfFile ? 'rgba(99,102,241,.04)' : 'var(--bg)', transition:'all .15s' }}>
                <div style={{ fontSize:36, marginBottom:8 }}>📄</div>
                {pdfFile ? (
                  <>
                    <div style={{ fontWeight:600, color:'var(--text)', marginBottom:4 }}>{pdfFile.name}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)' }}>{(pdfFile.size / 1024).toFixed(0)} KB — click to change</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight:600, color:'var(--text-secondary)', marginBottom:4 }}>Click to select PDF</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)' }}>or drag & drop</div>
                  </>
                )}
                <input ref={fileRef} type="file" accept="application/pdf" style={{ display:'none' }}
                  onChange={e => { if (e.target.files[0]) setPdfFile(e.target.files[0]) }} />
              </div>
              {pdfUploaded && (
                <div style={{ marginTop:12, padding:'10px 14px', background:'#dcfce7', border:'1px solid #86efac', borderRadius:8, color:'#15803d', fontSize:13 }}>
                  ✓ PDF uploaded successfully
                </div>
              )}
            </div>
          )}

          {/* ─── STEP 3: Place Placeholders ─── */}
          {step === 3 && createdDoc && (
            <PdfPlacementEditor
              docId={createdDoc.id}
              signers={signersWithIds}
              onPlaceholdersSaved={() => { onCreated(createdDoc) }}
              onBack={() => setStep(2)}
            />
          )}
        </div>

        {/* Footer */}
        {step <= 2 && (
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={step > 1 ? () => setStep(s => s-1) : onClose}>
              {step > 1 ? '← Back' : 'Cancel'}
            </button>
            {step === 1 && (
              <button className="btn btn-primary" onClick={createDoc} disabled={loading}>
                {loading ? 'Creating…' : 'Create & Continue →'}
              </button>
            )}
            {step === 2 && (
              <>
                <button className="btn btn-ghost" onClick={skipPdf}>Skip PDF</button>
                <button className="btn btn-primary" onClick={uploadPdf} disabled={pdfUploading || !pdfFile}>
                  {pdfUploading ? 'Uploading…' : 'Upload & Place Signatures →'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   MAIN DOCUMENTS PAGE
   ══════════════════════════════════════════════════════ */
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
    showToast('Document created!')
    load()
    if (doc?.id) nav(`/documents/${doc.id}`)
  }

  const filtered = filter === 'all' ? docs : docs.filter(d => d.status === filter)

  return (
    <div>
      {toast && <Toast msg={toast.msg} type={toast.type} />}
      {showCreate && <CreateDocModal onClose={() => setShowCreate(false)} onCreated={onCreated} />}

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Sign-off Documents</div>
          <div className="page-sub">Manage batch approval and e-signature workflows</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Document</button>
      </div>

      {/* KPI cards */}
      <div className="kpi-grid" style={{ marginBottom:20 }}>
        {Object.entries(STATUS_META).map(([k,v]) => {
          const count = docs.filter(d => d.status === k).length
          const accentMap = { draft:'#64748b', in_progress:'#f59e0b', complete:'#10b981', rejected:'#ef4444' }
          return (
            <div key={k} className="kpi-card" style={{ '--accent': accentMap[k], cursor:'pointer' }}
              onClick={() => setFilter(filter === k ? 'all' : k)}>
              <div className="kpi-value" style={{ color: accentMap[k] }}>{count}</div>
              <div className="kpi-label">{v.label}</div>
            </div>
          )
        })}
      </div>

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:16 }}>
        {['all', ...Object.keys(STATUS_META)].map(k => (
          <button key={k} onClick={() => setFilter(k)}
            className={`btn btn-sm ${filter === k ? 'btn-primary' : 'btn-ghost'}`}>
            {k === 'all' ? 'All' : STATUS_META[k].label}
            <span style={{ marginLeft:4, background: filter===k ? 'rgba(255,255,255,.25)' : 'var(--bg-secondary)', borderRadius:99, padding:'1px 7px', fontSize:11 }}>
              {k === 'all' ? docs.length : docs.filter(d => d.status === k).length}
            </span>
          </button>
        ))}
      </div>

      {/* Document list */}
      {loading ? (
        <div className="empty-state"><div className="empty-state-icon">⏳</div><div className="empty-state-title">Loading…</div></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <div className="empty-state-title">No documents yet</div>
          <div className="empty-state-sub">Create your first sign-off document to get started</div>
          <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => setShowCreate(true)}>+ New Document</button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtered.map(doc => {
            const total = doc.sign_requests?.length || 0
            const signed = doc.sign_requests?.filter(r => r.status==='signed').length || 0
            const progress = total > 0 ? (signed / total) * 100 : 0
            const meta = STATUS_META[doc.status] || STATUS_META.draft
            return (
              <div key={doc.id} className="card" style={{ cursor:'pointer' }} onClick={() => nav(`/documents/${doc.id}`)}>
                <div className="card-body" style={{ padding:'16px 20px' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4, flexWrap:'wrap' }}>
                        <span style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{doc.title}</span>
                        <span className={`badge ${meta.badge}`}>{meta.label}</span>
                        {doc.pdf_filename && <span className="badge badge-blue">�� PDF</span>}
                      </div>
                      {doc.description && (
                        <p style={{ fontSize:12.5, color:'var(--text-muted)', margin:'0 0 6px' }}>{doc.description}</p>
                      )}
                      <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                        {doc.batch_number && <span style={{ fontSize:12, color:'var(--text-muted)' }}>📦 {doc.batch_number}</span>}
                        <span style={{ fontSize:12, color:'var(--text-muted)' }}>✍️ {signed}/{total} signed</span>
                        {doc.created_by_name && <span style={{ fontSize:12, color:'var(--text-muted)' }}>👤 {doc.created_by_name}</span>}
                        {doc.created_at && <span style={{ fontSize:12, color:'var(--text-muted)' }}>{new Date(doc.created_at).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <span style={{ color:'var(--brand)', fontSize:18, marginTop:2 }}>›</span>
                  </div>
                  {total > 0 && (
                    <div style={{ marginTop:12 }}>
                      <div style={{ height:4, background:'var(--bg-secondary)', borderRadius:99, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${progress}%`, background:'linear-gradient(90deg,var(--brand),#10b981)', borderRadius:99, transition:'width .5s' }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
