import { useState, useEffect, useRef } from 'react'
import { getAuditRows } from '../api'

export default function AuditLog() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const timerRef = useRef(null)

  const load = () => {
    getAuditRows().then(d => setRows(Array.isArray(d) ? d : d.items || [])).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    timerRef.current = setInterval(load, 5000)
    return () => clearInterval(timerRef.current)
  }, [])

  return (
    <div className="page">
      <div className="page-header">
        <h2>Audit Log</h2>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>Auto-refresh every 5s</span>
      </div>
      {loading ? <span className="spinner" /> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Event</th><th>Inspection</th><th>Worker</th><th>Status</th><th>Message</th><th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6}><div className="empty">No audit entries yet</div></td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={r.id || i}>
                  <td><span className="badge" style={{ background: '#e0e7ff', color: '#3730a3' }}>{r.event_type || 'event'}</span></td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.inspection_id || '—'}</td>
                  <td>{r.worker_id || '—'}</td>
                  <td>
                    {r.status === 'ok'
                      ? <span className="badge badge-pass">ok</span>
                      : r.status === 'error'
                        ? <span className="badge badge-fail">error</span>
                        : <span className="badge">{r.status || '—'}</span>}
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: 12, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.message || r.payload || '—'}
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>
                    {r.created_at?.slice(0, 19).replace('T', ' ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
