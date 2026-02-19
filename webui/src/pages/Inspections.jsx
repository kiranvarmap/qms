import { useState, useEffect } from 'react'
import { getInspections } from '../api.js'

export default function Inspections({ onSelect }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  const load = () => {
    setLoading(true)
    setErr(null)
    getInspections()
      .then(setRows)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  return (
    <div className="page">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
        <h2>Inspections</h2>
        <button className="btn btn-primary btn-sm" onClick={load}>↻ Refresh</button>
      </div>

      {err && <div className="alert alert-error">{err}</div>}

      <div className="card" style={{padding:0}}>
        {loading ? (
          <p style={{padding:24}}>Loading...</p>
        ) : rows.length === 0 ? (
          <p style={{padding:24, color:'#6b7280'}}>No inspections yet. Create one using the form.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Batch</th>
                <th>Operator</th>
                <th>Status</th>
                <th>Defects</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{fontFamily:'monospace', fontSize:12}}>{r.id}</td>
                  <td>{r.batch_id}</td>
                  <td>{r.operator_id}</td>
                  <td><span className={`badge ${r.status}`}>{r.status}</span></td>
                  <td>{r.defect_count}</td>
                  <td style={{fontSize:12, color:'#6b7280'}}>{r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</td>
                  <td>
                    <button className="btn btn-sm" style={{background:'#e5e7eb'}} onClick={() => onSelect && onSelect(r.id)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
