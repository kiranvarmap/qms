import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { api } from './api.js'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Inspections from './pages/Inspections'
import CreateInspection from './pages/CreateInspection'
import Products from './pages/Products'
import Operators from './pages/Operators'
import Defects from './pages/Defects'
import AuditLog from './pages/AuditLog'
import Documents from './pages/Documents'
import DocumentDetail from './pages/DocumentDetail'
import MyTasks from './pages/MyTasks'
import UsersAdmin from './pages/UsersAdmin'

/* ── SVG icon set (Asana-style clean strokes) ── */
const Icon = ({ d, size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

const ICONS = {
  dashboard:   'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  inspections: 'M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z',
  products:    'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10',
  operators:   'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm7 2v.01M21 12a2 2 0 00-2 2v.01',
  defects:     'M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  audit:       'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  tasks:       'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  documents:   'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  users:       'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  logout:      'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
}

const NAV_MAIN = [
  { to: '/dashboard',   label: 'Dashboard',    icon: 'dashboard'   },
  { to: '/inspections', label: 'Inspections',  icon: 'inspections' },
  { to: '/products',    label: 'Products',     icon: 'products'    },
  { to: '/operators',   label: 'Operators',    icon: 'operators'   },
  { to: '/defects',     label: 'Defect Types', icon: 'defects'     },
  { to: '/audit',       label: 'Audit Log',    icon: 'audit'       },
]

function Shell({ user, onLogout }) {
  const nav = useNavigate()
  const [taskCount, setTaskCount] = useState(0)
  const isAdmin = user?.role === 'admin' || user?.role === 'manager'
  const initials = (user?.full_name || user?.username || 'U')
    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  useEffect(() => {
    api('/documents/my-tasks').then(data => {
      const pending = Array.isArray(data) ? data.filter(t => t.status === 'pending').length : 0
      setTaskCount(pending)
    }).catch(() => {})
  }, [])

  const logout = () => {
    localStorage.removeItem('qms_token')
    localStorage.removeItem('qms_user')
    onLogout()
    nav('/login')
  }

  return (
    <div className="app-shell">
      {/* ── WHITE SIDEBAR ── */}
      <aside className="sidebar">
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            {/* Asana-style three-dot mark in white */}
            <svg width="18" height="12" viewBox="0 0 18 12" fill="white">
              <circle cx="3"  cy="9" r="3"/>
              <circle cx="9"  cy="3" r="3"/>
              <circle cx="15" cy="9" r="3"/>
            </svg>
          </div>
          <div>
            <div className="sidebar-brand-name">QualityOS</div>
            <div className="sidebar-brand-sub">Quality Management</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Main</div>

          {NAV_MAIN.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
            >
              <span className="sidebar-icon"><Icon d={ICONS[n.icon]} /></span>
              {n.label}
            </NavLink>
          ))}

          <div className="sidebar-section-label" style={{ marginTop: 12 }}>Workflows</div>

          <NavLink to="/my-tasks" className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
            <span className="sidebar-icon"><Icon d={ICONS.tasks} /></span>
            My Tasks
            {taskCount > 0 && (
              <span className="sidebar-badge">{taskCount}</span>
            )}
          </NavLink>

          <NavLink to="/documents" className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
            <span className="sidebar-icon"><Icon d={ICONS.documents} /></span>
            Documents
          </NavLink>

          {isAdmin && (
            <>
              <div className="sidebar-section-label" style={{ marginTop: 12 }}>Admin</div>
              <NavLink to="/users-admin" className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
                <span className="sidebar-icon"><Icon d={ICONS.users} /></span>
                User Management
              </NavLink>
            </>
          )}
        </nav>

        {/* Footer — user row */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sidebar-user-name">{user?.full_name || user?.username}</div>
              <div className="sidebar-user-role">{user?.role || 'operator'}</div>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: '4px 6px', borderRadius: 5,
                display: 'flex', alignItems: 'center', transition: 'color .15s, background .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.background = 'var(--bg-secondary)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none' }}
            >
              <Icon d={ICONS.logout} size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="main-content">
        <Routes>
          <Route path="/dashboard"        element={<Dashboard />} />
          <Route path="/inspections"      element={<Inspections />} />
          <Route path="/create-inspection" element={<CreateInspection />} />
          <Route path="/products"         element={<Products />} />
          <Route path="/operators"        element={<Operators />} />
          <Route path="/defects"          element={<Defects />} />
          <Route path="/audit"            element={<AuditLog />} />
          <Route path="/documents"        element={<Documents />} />
          <Route path="/documents/:id"    element={<DocumentDetail />} />
          <Route path="/my-tasks"         element={<MyTasks />} />
          {isAdmin && <Route path="/users-admin" element={<UsersAdmin />} />}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('qms_user')) } catch { return null }
  })

  return (
    <BrowserRouter basename="/app">
      <Routes>
        <Route path="/login" element={
          user ? <Navigate to="/dashboard" replace /> : <Login onLogin={u => setUser(u)} />
        } />
        <Route path="/signup" element={<Signup />} />
        <Route path="/*" element={
          user ? <Shell user={user} onLogout={() => setUser(null)} /> : <Navigate to="/login" replace />
        } />
      </Routes>
    </BrowserRouter>
  )
}
