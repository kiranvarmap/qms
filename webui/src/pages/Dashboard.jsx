import { useState, useEffect } from 'react'
import { getStats } from '../api'

function StatusBadge({ s }) {
  return <span className={`badge badge-${s}`}>{s?.replace(/_/g, ' ')}</span>
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStats().then(setStats).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="page"><span className="spinner" /></div>
  if (!stats) return <div className="page"><p>Could not load stats.</p></div>

  const maxTrend = Math.max(...(stats.trend || []).map(d => (d.pass || 0) + (d.fail || 0)), 1)

  return (
    <div className="page">
      <div className="page-header"><h2>Dashboard</h2></div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Inspections</div>
          <div className="kpi-value">{stats.total_inspections}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Pass Rate</div>
          <div className="kpi-value" style={{ color: '#16a34a' }}>{stats.pass_rate}%</div>
          <div className="kpi-sub">{stats.pass} passed</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Fail Rate</div>
          <div className="kpi-value" style={{ color: '#dc2626' }}>{stats.fail_rate}%</div>
          <div className="kpi-sub">{stats.fail} failed</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Pending</div>
          <div className="kpi-value" style={{ color: '#d97706' }}>{stats.pending}</div>
          <div className="kpi-sub">{stats.in_review} in review</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Avg Defects</div>
          <div className="kpi-value">{stats.avg_defects_per_inspection}</div>
          <div className="kpi-sub">per inspection</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="card">
          <div className="section-title">Pass / Fail Trend</div>
          {stats.trend?.length > 0 ? (
            <>
              <div className="chart-bar">
                {stats.trend.slice(-20).map((d, i) => {
                  const passH = Math.round(((d.pass || 0) / maxTrend) * 72)
                  const failH = Math.round(((d.fail || 0) / maxTrend) * 72)
                  return (
                    <div key={i} className="bar-item" title={`${d.day}: ${d.pass} pass, ${d.fail} fail`}>
                      <div className="bar-fail" style={{ height: failH }} />
                      <div className="bar-pass" style={{ height: passH }} />
                      <div className="bar-label">{d.day?.slice(5)}</div>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12 }}>
                <span style={{ color: '#16a34a' }}>■ Pass</span>
                <span style={{ color: '#dc2626' }}>■ Fail</span>
              </div>
            </>
          ) : <div className="empty">No trend data yet</div>}
        </div>

        <div className="card">
          <div className="section-title">Top Defect Types</div>
          {stats.top_defects?.length > 0 ? (
            <table>
              <thead><tr><th>Defect</th><th>Severity</th><th>#</th></tr></thead>
              <tbody>
                {stats.top_defects.map((d, i) => (
                  <tr key={i}>
                    <td>{d.name}</td>
                    <td><span className={`badge badge-${d.severity}`}>{d.severity}</span></td>
                    <td><strong>{d.total}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="empty">No defects recorded yet</div>}
        </div>
      </div>

      <div className="card">
        <div className="section-title">Recent Activity</div>
        {stats.recent_activity?.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Batch</th><th>Status</th><th>Defects</th><th>Created</th></tr></thead>
              <tbody>
                {stats.recent_activity.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.id}</td>
                    <td>{r.batch_id}</td>
                    <td><StatusBadge s={r.status} /></td>
                    <td>{r.defect_count}</td>
                    <td style={{ color: 'var(--muted)' }}>{r.created_at?.slice(0, 16).replace('T', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">No inspections yet. <a href="#/inspections/new">Create one →</a></div>}
      </div>
    </div>
  )
}
