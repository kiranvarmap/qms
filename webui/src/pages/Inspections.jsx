import { useEffect, useState } from 'react'
import { api } from '../api'
import { useNavigate } from 'react-router-dom'

const STATUS_OPTS = ['all','pass','fail','pending']

export default function Inspections() {
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()

  useEffect(() => {
    api('/inspections?limit=100')
      .then(d => setRows(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? rows : rows.filter(r => r.status === filter)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inspections</h1>
          <p className="page-sub">{rows.length} total records</p>
        </div>
        <button className="btn btn-primary" onClick={() => nav('/create-inspection')}>+ New Inspection</button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="tabs">
            {STATUS_OPTS.map(s => (
              <button key={s} className={`tab${filter === s ? ' active' : ''}`} onClick={() => setFilter(s)}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
                {s !== 'all' && <span className="tab-count">{rows.filter(r => r.status === s).length}</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="card-body" style={{padding:0}}>
          {loading ? (
            <div style={{padding:40,textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}} /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <div>No inspections found</div>
              <button className="btn btn-primary" style={{marginTop:16}} onClick={() => nav('/create-inspection')}>Create First Inspection</button>
            </div>
          ) : (
            <table className="table">
              <thead><tr>
                <th>#</th><th>Batch</th><th>Operator</th><th>Status</th><th>Severity</th><th>Defects</th><th>Date</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map((ins, i) => (
                  <tr key={ins.id}>
                    <td style={{color:'var(--text-muted)',fontSize:12}}>{i+1}</td>
                    <td style={{fontWeight:500}}>{ins.batch_number || ins.batch_id || '—'}</td>
                    <td>{ins.operator_name || ins.operator_id || '—'}</td>
                    <td><span className={`badge badge-${ins.status==='pass'?'green':ins.status==='fail'?'red':'yellow'}`}>{ins.status}</span></td>
                    <td>{ins.severity ? <span className={`badge badge-${ins.severity==='critical'?'red':ins.severity==='major'?'orange':ins.severity==='minor'?'yellow':'blue'}`}>{ins.severity}</span> : '—'}</td>
                    <td>{ins.defect_count ?? 0}</td>
                    <td style={{color:'var(--text-muted)',fontSize:12}}>{ins.created_at ? new Date(ins.created_at).toLocaleDateString() : '—'}</td>
                    <td>
                      <button className="btn btn-ghost btn-xs" onClick={() => nav(`/inspections/${ins.id}`)}>View</button>
                    </td>
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
