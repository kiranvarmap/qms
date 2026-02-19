import { useState, useEffect, useCallback } from 'react'
import {
  listInspections, updateStatus, deleteInspection,
  listInspectionDefects, listDefectTypes, attachDefect, removeDefect,
  listSignatures, addSignature, revokeSignature
} from '../api'

const STATUSES = ['pending', 'in_review', 'pass', 'fail', 'conditional_pass']

function Badge({ s }) {
  return <span className={`badge badge-${s}`}>{s?.replace(/_/g, ' ')}</span>
}

function SeverityBadge({ s }) {
  return <span className={`badge badge-${s || 'minor'}`}>{s || 'N/A'}</span>
}

function RoleBadge({ r }) {
  return <span className={`badge badge-${r}`}>{r}</span>
}

export default function Inspections({ toast }) {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const limit = 15

  const [selected, setSelected] = useState(null)
  const [detailTab, setDetailTab] = useState('defects')
  const [defects, setDefects] = useState([])
  const [defectTypes, setDefectTypes] = useState([])
  const [signatures, setSignatures] = useState([])
  const [attachId, setAttachId] = useState('')
  const [sigRole, setSigRole] = useState('inspector')
  const [sigName, setSigName] = useState('')
  const [sigNote, setSigNote] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    listInspections({ status: statusFilter, search, limit, offset: page * limit })
      .then(d => { setRows(d.items || d); setTotal(d.total || (d.items || d).length) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [statusFilter, search, page, limit])

  useEffect(() => { load() }, [load])

  const openDetail = async (row) => {
    setSelected(row)
    setDetailTab('defects')
    const [d, s, dt] = await Promise.all([
      listInspectionDefects(row.id),
      listSignatures(row.id),
      listDefectTypes()
    ])
    setDefects(d)
    setSignatures(s)
    setDefectTypes(dt)
    setAttachId(dt[0]?.id || '')
  }

  const handleStatusChange = async (id, status) => {
    try {
      await updateStatus(id, status)
      toast('Status updated', 'success')
      load()
      if (selected?.id === id) setSelected(prev => ({ ...prev, status }))
    } catch { toast('Failed to update status', 'error') }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this inspection?')) return
    try {
      await deleteInspection(id)
      toast('Deleted', 'success')
      setSelected(null)
      load()
    } catch { toast('Cannot delete', 'error') }
  }

  const handleAttachDefect = async () => {
    if (!attachId) return
    try {
      await attachDefect(selected.id, attachId)
      const d = await listInspectionDefects(selected.id)
      setDefects(d)
      toast('Defect attached', 'success')
    } catch { toast('Failed to attach defect', 'error') }
  }

  const handleRemoveDefect = async (defectId) => {
    try {
      await removeDefect(selected.id, defectId)
      setDefects(prev => prev.filter(d => d.defect_type_id !== defectId))
      toast('Defect removed', 'success')
    } catch { toast('Failed to remove defect', 'error') }
  }

  const handleSign = async () => {
    if (!sigName.trim()) return
    try {
      await addSignature(selected.id, { role: sigRole, signer_name: sigName, notes: sigNote })
      const s = await listSignatures(selected.id)
      setSignatures(s)
      setSigName('')
      setSigNote('')
      toast('Signed successfully', 'success')
    } catch { toast('Failed to sign — maybe this role already signed', 'error') }
  }

  const handleRevoke = async (sigId) => {
    if (!confirm('Revoke this signature?')) return
    try {
      await revokeSignature(selected.id, sigId)
      setSignatures(prev => prev.filter(s => s.id !== sigId))
      toast('Signature revoked', 'success')
    } catch { toast('Failed to revoke', 'error') }
  }

  const pages = Math.ceil(total / limit)

  return (
    <div className="page">
      <div className="page-header">
        <h2>Inspections</h2>
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>{total} total</span>
      </div>

      <div className="toolbar">
        <input className="search" placeholder="Search batch / operator…" value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }} />
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0) }}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {loading ? <span className="spinner" /> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Batch</th><th>Operator</th><th>Status</th><th>Defects</th>
                <th>Severity</th><th>Created</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={7}><div className="empty">No inspections found</div></td></tr>}
              {rows.map(r => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(r)}>
                  <td>{r.batch_id}</td>
                  <td>{r.operator_id}</td>
                  <td><Badge s={r.status} /></td>
                  <td>{r.defect_count}</td>
                  <td><SeverityBadge s={r.severity} /></td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{r.created_at?.slice(0, 16).replace('T', ' ')}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <select value={r.status} onChange={e => handleStatusChange(r.id, e.target.value)}
                        onClick={e => e.stopPropagation()} style={{ fontSize: 12, padding: '2px 4px' }}>
                        {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                      </select>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>×</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ fontSize: 13 }}>Page {page + 1} / {pages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Inspection Detail</h3>
              <button className="modal-close" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div><strong>Batch</strong><p>{selected.batch_id}</p></div>
                <div><strong>Operator</strong><p>{selected.operator_id}</p></div>
                <div><strong>Status</strong><p><Badge s={selected.status} /></p></div>
                <div><strong>Severity</strong><p><SeverityBadge s={selected.severity} /></p></div>
                <div><strong>Defects</strong><p>{selected.defect_count}</p></div>
                <div><strong>Created</strong><p style={{ fontSize: 12 }}>{selected.created_at?.slice(0, 16).replace('T', ' ')}</p></div>
              </div>

              {selected.notes && <div style={{ marginBottom: 16 }}><strong>Notes</strong><p style={{ color: 'var(--muted)' }}>{selected.notes}</p></div>}

              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button className={`btn ${detailTab === 'defects' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                  onClick={() => setDetailTab('defects')}>Defects</button>
                <button className={`btn ${detailTab === 'signatures' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                  onClick={() => setDetailTab('signatures')}>Signatures</button>
                <button className={`btn ${detailTab === 'workflow' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                  onClick={() => setDetailTab('workflow')}>Workflow</button>
              </div>

              {detailTab === 'defects' && (
                <div>
                  {defects.length > 0 ? (
                    <table>
                      <thead><tr><th>Defect</th><th>Severity</th><th>Count</th><th></th></tr></thead>
                      <tbody>
                        {defects.map(d => (
                          <tr key={d.defect_type_id}>
                            <td>{d.name}</td>
                            <td><span className={`badge badge-${d.severity}`}>{d.severity}</span></td>
                            <td>{d.count}</td>
                            <td><button className="btn btn-danger btn-sm"
                              onClick={() => handleRemoveDefect(d.defect_type_id)}>Remove</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <div className="empty">No defects attached</div>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <select value={attachId} onChange={e => setAttachId(e.target.value)} style={{ flex: 1 }}>
                      {defectTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.name} ({dt.severity})</option>)}
                    </select>
                    <button className="btn btn-primary btn-sm" onClick={handleAttachDefect} disabled={!attachId}>Attach</button>
                  </div>
                </div>
              )}

              {detailTab === 'signatures' && (
                <div>
                  {signatures.length > 0 ? (
                    <table>
                      <thead><tr><th>Role</th><th>Signer</th><th>Date</th><th>Notes</th><th></th></tr></thead>
                      <tbody>
                        {signatures.map(s => (
                          <tr key={s.id}>
                            <td><RoleBadge r={s.role} /></td>
                            <td>{s.signer_name}</td>
                            <td style={{ fontSize: 12 }}>{s.signed_at?.slice(0, 16).replace('T', ' ')}</td>
                            <td style={{ color: 'var(--muted)', fontSize: 12 }}>{s.notes || '—'}</td>
                            <td><button className="btn btn-danger btn-sm" onClick={() => handleRevoke(s.id)}>Revoke</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <div className="empty">No signatures yet</div>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                    <select value={sigRole} onChange={e => setSigRole(e.target.value)}>
                      <option value="inspector">Inspector</option>
                      <option value="reviewer">Reviewer</option>
                      <option value="approver">Approver</option>
                    </select>
                    <input placeholder="Signer name" value={sigName} onChange={e => setSigName(e.target.value)} />
                    <input placeholder="Notes (optional)" value={sigNote} onChange={e => setSigNote(e.target.value)}
                      style={{ gridColumn: 'span 2' }} />
                    <button className="btn btn-primary btn-sm" style={{ gridColumn: 'span 2' }}
                      onClick={handleSign} disabled={!sigName.trim()}>Add Signature</button>
                  </div>
                </div>
              )}

              {detailTab === 'workflow' && (
                <div>
                  <p style={{ color: 'var(--muted)', marginBottom: 12 }}>Update inspection status:</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {STATUSES.map(s => (
                      <button key={s}
                        className={`btn btn-sm ${selected.status === s ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => handleStatusChange(selected.id, s)}>
                        {s.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                  <div style={{ marginTop: 20 }}>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(selected.id)}>Delete Inspection</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
