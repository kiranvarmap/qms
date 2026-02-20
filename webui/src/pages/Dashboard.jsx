import { useEffect, useState } from 'react'
import { api } from '../api'

const KPI_DEFS = [
  { key: 'total_inspections',   label: 'Total Inspections', icon: '🔍', accent: '#6366f1' },
  { key: 'pass_count',          label: 'Passed',            icon: '✅', accent: '#22c55e' },
  { key: 'fail_count',          label: 'Failed',            icon: '❌', accent: '#ef4444' },
  { key: 'pending_count',       label: 'Pending',           icon: '⏳', accent: '#f59e0b' },
  { key: 'total_defects',       label: 'Total Defects',     icon: '⚠️', accent: '#f97316' },
  { key: 'total_products',      label: 'Products',          icon: '📦', accent: '#8b5cf6' },
  { key: 'total_operators',     label: 'Operators',         icon: '👷', accent: '#06b6d4' },
  { key: 'avg_defects_per_ins', label: 'Avg Defects/Insp',  icon: '📊', accent: '#ec4899' },
]

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api('/stats/summary').catch(() => ({})),
      api('/inspections?limit=6').catch(() => [])
    ]).then(([s, r]) => {
      setStats(s)
      setRecent(Array.isArray(r) ? r : [])
      setLoading(false)
    })
  }, [])

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}>
      <div className="spinner" />
    </div>
  )

  const passRate = stats?.total_inspections ? Math.round((stats.pass_count / stats.total_inspections) * 100) : 0

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Quality operations overview</p>
        </div>
        <span className="badge badge-green">Live</span>
      </div>

      <div className="kpi-grid">
        {KPI_DEFS.map(k => (
          <div className="kpi-card" key={k.key} style={{'--accent': k.accent}}>
            <div className="kpi-icon">{k.icon}</div>
            <div className="kpi-value">{stats?.[k.key] ?? 0}</div>
            <div className="kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:20,marginTop:24}}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Inspections</h2>
          </div>
          <div className="card-body" style={{padding:0}}>
            {recent.length === 0 ? (
              <div className="empty-state" style={{padding:'40px 0'}}>
                <div className="empty-state-icon">🔍</div>
                <div>No inspections yet</div>
              </div>
            ) : (
              <table className="table">
                <thead><tr>
                  <th>Batch</th><th>Operator</th><th>Status</th><th>Defects</th><th>Date</th>
                </tr></thead>
                <tbody>
                  {recent.map(ins => (
                    <tr key={ins.id}>
                      <td>{ins.batch_number || ins.batch_id || '—'}</td>
                      <td>{ins.operator_name || ins.operator_id || '—'}</td>
                      <td><span className={`badge badge-${ins.status === 'pass' ? 'green' : ins.status === 'fail' ? 'red' : 'yellow'}`}>{ins.status}</span></td>
                      <td>{ins.defect_count ?? 0}</td>
                      <td style={{color:'var(--text-muted)',fontSize:12}}>{ins.created_at ? new Date(ins.created_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Pass Rate</h2>
          </div>
          <div className="card-body">
            <div style={{textAlign:'center',padding:'10px 0 20px'}}>
              <div style={{fontSize:52,fontWeight:800,color:passRate>=80?'#22c55e':passRate>=50?'#f59e0b':'#ef4444',lineHeight:1}}>
                {passRate}<span style={{fontSize:24}}>%</span>
              </div>
              <div style={{color:'var(--text-muted)',marginTop:6,fontSize:13}}>of all inspections passed</div>
            </div>
            <div style={{marginTop:8}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--text-muted)',marginBottom:6}}>
                <span>Pass rate</span><span>{passRate}%</span>
              </div>
              <div className="progress"><div className="progress-bar" style={{width:`${passRate}%`,background:passRate>=80?'#22c55e':passRate>=50?'#f59e0b':'#ef4444'}} /></div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:20}}>
              {[
                { label:'Passed', val: stats?.pass_count ?? 0, color:'#22c55e' },
                { label:'Failed', val: stats?.fail_count ?? 0, color:'#ef4444' },
                { label:'Pending', val: stats?.pending_count ?? 0, color:'#f59e0b' },
              ].map(r => (
                <div key={r.label} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{width:10,height:10,borderRadius:'50%',background:r.color,display:'inline-block'}} />
                    <span style={{fontSize:13}}>{r.label}</span>
                  </div>
                  <span style={{fontWeight:600,fontSize:13}}>{r.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
