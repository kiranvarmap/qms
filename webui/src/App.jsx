import { useState, useEffect, useCallback } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Inspections from './pages/Inspections'
import CreateInspection from './pages/CreateInspection'
import Products from './pages/Products'
import Operators from './pages/Operators'
import Defects from './pages/Defects'
import AuditLog from './pages/AuditLog'

const NAV = [
  { section: 'Core', items: [
    { key: 'dashboard', label: 'Dashboard', icon: '▦' },
    { key: 'inspections', label: 'Inspections', icon: '✓' },
    { key: 'new-inspection', label: 'New Inspection', icon: '+' },
  ]},
  { section: 'Management', items: [
    { key: 'products', label: 'Products & Batches', icon: '◉' },
    { key: 'operators', label: 'Operators', icon: '👤' },
    { key: 'defects', label: 'Defect Catalogue', icon: '⚠' },
  ]},
  { section: 'System', items: [
    { key: 'audit', label: 'Audit Log', icon: '📋' },
  ]},
]

let _toastId = 0
function Toast({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
      ))}
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('qms_user')) } catch { return null }
  })
  const [page, setPage] = useState('dashboard')
  const [toasts, setToasts] = useState([])

  const toast = useCallback((msg, type = 'info') => {
    const id = ++_toastId
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const logout = () => {
    localStorage.removeItem('qms_token')
    localStorage.removeItem('qms_user')
    setUser(null)
  }

  if (!user) return (
    <>
      <Login onLogin={u => setUser(u)} />
      <Toast toasts={toasts} />
    </>
  )

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard toast={toast} />
      case 'inspections': return <Inspections toast={toast} />
      case 'new-inspection': return <CreateInspection toast={toast} onCreated={() => setPage('inspections')} />
      case 'products': return <Products toast={toast} />
      case 'operators': return <Operators toast={toast} />
      case 'defects': return <Defects toast={toast} />
      case 'audit': return <AuditLog />
      default: return <Dashboard toast={toast} />
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <svg width="22" height="22" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="8" fill="#2563eb" />
            <path d="M10 20l7 7 13-13" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>QMS</span>
        </div>
        {NAV.map(section => (
          <div key={section.section}>
            <div className="sidebar-section">{section.section}</div>
            {section.items.map(item => (
              <button
                key={item.key}
                className={`sidebar-item${page === item.key ? ' active' : ''}`}
                onClick={() => setPage(item.key)}
              >
                <span className="sidebar-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        ))}
        <div style={{ marginTop: 'auto', padding: '16px' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
            {user?.username || 'user'}
            {user?.is_admin && <span style={{ marginLeft: 6, background: '#2563eb', borderRadius: 4, padding: '1px 6px', fontSize: 10 }}>admin</span>}
          </div>
          <button className="btn btn-ghost btn-sm" style={{ width: '100%', color: 'rgba(255,255,255,0.6)' }} onClick={logout}>
            Sign Out
          </button>
        </div>
      </aside>
      <main className="main-content">
        <div className="topbar">
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>
            {NAV.flatMap(s => s.items).find(i => i.key === page)?.label || 'Dashboard'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Quality Management System</div>
        </div>
        {renderPage()}
      </main>
      <Toast toasts={toasts} />
    </div>
  )
}
