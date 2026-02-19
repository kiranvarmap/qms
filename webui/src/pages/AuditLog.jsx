import { useState, useEffect } from 'react'
import { getAuditRows } from '../api.js'

export default function AuditLog() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  const load = () => {
    setLoading(true)
    setErr(null)
    getAuditRows(50)
      .then(setRows)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 5000) // auto-refresh every 5s
    return () => clearInterval(t)
  }, [])

  return (
    <div className="page">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
        <h2>Worker Audit Log</h2>
        <button className="btn btn-primary btn-sm" onClick={load}>↻ Refresh</button>
      </div>
      <p style={{color:'#6b7280', marginBottom:16, fontSize:13}}>
        Auto-refreshes every 5 seconds. Shows items processed by the background worker.
      </p>

      {err && <div className="alert alert-error">{err}</div>}

      <div className="card" style={{padding:0}}>
        {loading && rows.length === 0 ? (
          <p style={{padding:24}}>Loading...</p>
        ) : rows.length === 0 ? (
          <p style={{padding:24, color:'#6b7280'}}>No audit rows yet. Create an inspection first.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Item (Inspection ID)</th>
                <th>Processed At</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td style={{fontFamily:'monospace', fontSize:12}}>{r.item}</td>
                  <td style={{fontSize:12, color:'#6b7280'}}>{r.processed_at ? new Date(r.processed_at).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
