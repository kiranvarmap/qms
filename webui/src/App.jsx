import { useState } from 'react'
import Dashboard from './pages/Dashboard.jsx'
import Inspections from './pages/Inspections.jsx'
import CreateInspection from './pages/CreateInspection.jsx'
import AuditLog from './pages/AuditLog.jsx'

export default function App() {
  const [page, setPage] = useState('dashboard')

  const nav = (p) => (e) => { e.preventDefault(); setPage(p) }

  return (
    <>
      <nav>
        <h1>QMS</h1>
        <a href="#" className={page === 'dashboard' ? 'active' : ''} onClick={nav('dashboard')}>Dashboard</a>
        <a href="#" className={page === 'inspections' ? 'active' : ''} onClick={nav('inspections')}>Inspections</a>
        <a href="#" className={page === 'create' ? 'active' : ''} onClick={nav('create')}>+ Create</a>
        <a href="#" className={page === 'audit' ? 'active' : ''} onClick={nav('audit')}>Audit Log</a>
      </nav>

      {page === 'dashboard' && <Dashboard />}
      {page === 'inspections' && <Inspections onSelect={() => {}} />}
      {page === 'create' && <CreateInspection onCreated={() => setPage('inspections')} />}
      {page === 'audit' && <AuditLog />}
    </>
  )
}
