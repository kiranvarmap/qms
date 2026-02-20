import { useEffect, useState } from 'react'
import { api } from '../api'

export default function AuditLog() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/stats/audit-log?limit=100').catch(() => []).then(d => {
      setRows(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }, [])

  const eventBadge = (type) => {
    if (!type) return 'badge-blue'
    const t = type.toLowerCase()
    if (t.includes('fail') || t.includes('error')) return 'badge-red'
    if (t.includes('pass') || t.includes('success') || t.includes('create')) return 'badge-green'
    if (t.includes('update') || t.includes('edit')) return 'badge-yellow'
    return 'badge-blue'
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-sub">System activity and event history</p>
        </div>
        <span className="badge badge-blue">{rows.length} events</span>
      </div>

      <div className="card">
        <div className="card-body" style={{padding:0}}>
          {loading ? (
            <div style={{padding:40,textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}} /></div>
          ) : rows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div>No audit events yet</div>
              <p style={{color:'var(--text-muted)',fontSize:13,marginTop:6}}>Events are logged as you use the system</p>
            </div>
          ) : (
            <table className="table">
              <thead><tr><th>#</th><th>Event</th><th>Status</th><th>Worker / Source</th><th>Message</th><th>Timestamp</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    <td style={{color:'var(--text-muted)',fontSize:12}}>{i+1}</td>
                    <td style={{fontWeight:500}}>{r.event_type || r.item || '—'}</td>
                    <td>{r.status ? <span className={`badge ${eventBadge(r.status)}`}>{r.status}</span> : '—'}</td>
                    <td style={{fontSize:13,color:'var(--text-muted)'}}>{r.worker_id || '—'}</td>
                    <td style={{fontSize:13,maxWidth:300,color:'var(--text-secondary)'}}>{r.message || '—'}</td>
                    <td style={{color:'var(--text-muted)',fontSize:12,whiteSpace:'nowrap'}}>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
