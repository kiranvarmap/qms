import { useState, useEffect } from 'react'
import { getHealth } from '../api.js'

export default function Dashboard() {
  const [health, setHealth] = useState(null)

  useEffect(() => {
    getHealth().then(setHealth).catch(e => setHealth('error: ' + e.message))
  }, [])

  const dotClass = health && health.includes("'ok'") ? 'dot-ok' : health ? 'dot-err' : 'dot-unk'

  return (
    <div className="page">
      <h2>Dashboard</h2>

      <div className="stat-grid">
        <div className="stat">
          <div className="num">🟢</div>
          <div className="lbl">Web Service Live</div>
        </div>
        <div className="stat">
          <div className="num">🟢</div>
          <div className="lbl">Worker Running</div>
        </div>
        <div className="stat">
          <div className="num">⚡</div>
          <div className="lbl">Render + Postgres + Redis</div>
        </div>
      </div>

      <div className="card">
        <h3 style={{marginBottom:12}}>System Health</h3>
        <p>
          <span className={`health-dot ${dotClass}`} />
          {health ?? 'Checking...'}
        </p>
      </div>

      <div className="card">
        <h3 style={{marginBottom:12}}>Quick Links</h3>
        <ul style={{lineHeight:'2em', paddingLeft:20}}>
          <li><a href="/docs" target="_blank" rel="noreferrer">API Docs (Swagger UI)</a></li>
          <li><a href="/metrics" target="_blank" rel="noreferrer">Prometheus Metrics</a></li>
          <li><a href="/healthz" target="_blank" rel="noreferrer">Health Endpoint</a></li>
        </ul>
      </div>
    </div>
  )
}
