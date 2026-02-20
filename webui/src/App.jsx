import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Inspections from './pages/Inspections'
import CreateInspection from './pages/CreateInspection'
import Products from './pages/Products'
import Operators from './pages/Operators'
import Defects from './pages/Defects'
import AuditLog from './pages/AuditLog'

const NAV = [
  { to:'/dashboard',  label:'Dashboard',    icon:'⬛' },
  { to:'/inspections',label:'Inspections',  icon:'🔍' },
  { to:'/products',   label:'Products',     icon:'📦' },
  { to:'/operators',  label:'Operators',    icon:'👷' },
  { to:'/defects',    label:'Defect Types', icon:'⚠' },
  { to:'/audit',      label:'Audit Log',    icon:'📋' },
]

function Shell({ user, onLogout }) {
  const nav = useNavigate()
  const logout = () => {
    localStorage.removeItem('qms_token')
    localStorage.removeItem('qms_user')
    onLogout()
    nav('/login')
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <svg width="16" height="16" viewBox="0 0 40 40" fill="none">
              <path d="M8 20l8 8 16-16" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:'#fff',lineHeight:1.2}}>QualityOS</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,.35)',marginTop:1}}>Quality Management</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Navigation</div>
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} className={({isActive}) => `sidebar-item${isActive?' active':''}`}>
              <span className="sidebar-icon">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderTop:'1px solid rgba(255,255,255,.06)'}}>
            <div style={{width:32,height:32,borderRadius:'50%',background:'var(--brand)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#fff',flexShrink:0}}>
              {user?.username?.charAt(0)?.toUpperCase()}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:500,color:'rgba(255,255,255,.85)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.full_name || user?.username}</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,.35)'}}>{user?.role || 'operator'}</div>
            </div>
            <button onClick={logout} title="Sign out" style={{background:'none',border:'none',color:'rgba(255,255,255,.35)',cursor:'pointer',fontSize:16,padding:'4px',borderRadius:6,transition:'color .15s'}} onMouseEnter={e=>e.target.style.color='#ef4444'} onMouseLeave={e=>e.target.style.color='rgba(255,255,255,.35)'}>⏻</button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/inspections" element={<Inspections />} />
          <Route path="/create-inspection" element={<CreateInspection />} />
          <Route path="/products" element={<Products />} />
          <Route path="/operators" element={<Operators />} />
          <Route path="/defects" element={<Defects />} />
          <Route path="/audit" element={<AuditLog />} />
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
        <Route path="/*" element={
          user ? <Shell user={user} onLogout={() => setUser(null)} /> : <Navigate to="/login" replace />
        } />
      </Routes>
    </BrowserRouter>
  )
}
