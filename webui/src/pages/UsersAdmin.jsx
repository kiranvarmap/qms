import { useEffect, useState } from 'react'
import { api } from '../api.js'

const ROLE_BADGE = {
  admin:      'badge-red',
  manager:    'badge-purple',
  supervisor: 'badge-blue',
  qa:         'badge-cyan',
  inspector:  'badge-green',
  operator:   'badge-gray',
}
const STATUS_BADGE = {
  approved: 'badge-green',
  pending:  'badge-yellow',
  rejected: 'badge-red',
}
const TAB_LABELS = { pending:'Pending', approved:'Active', all:'All' }

export default function UsersAdmin() {
  const [users, setUsers] = useState([])
  const [tab, setTab] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  function showToast(msg, type='success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function load() {
    setLoading(true)
    try { setUsers(await api('/auth/users').then(d => Array.isArray(d) ? d : [])) }
    catch { setUsers([]) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function setApproval(id, status) {
    try {
      await api(`/auth/users/${id}/approval`, { method:'PATCH', body: JSON.stringify({ approval_status: status }) })
      showToast(`User ${status === 'approved' ? 'approved' : 'rejected'}`)
      load()
    } catch (err) { showToast(err?.message || 'Action failed', 'error') }
  }

  async function setRole(id, role) {
    try {
      await api(`/auth/users/${id}`, { method:'PATCH', body: JSON.stringify({ role }) })
      showToast('Role updated')
      load()
    } catch (err) { showToast(err?.message || 'Failed', 'error') }
  }

  const filtered = users.filter(u => tab === 'all' ? true : u.approval_status === tab)

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type==='error' ? 'error' : 'success'}`}>{toast.msg}</div>}

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">User Management</div>
          <div className="page-sub">Approve access requests and manage team roles</div>
        </div>
      </div>

      {/* Stats */}
      <div className="kpi-grid" style={{ marginBottom:20 }}>
        {[
          { key:'pending',  label:'Pending',  accent:'#f59e0b' },
          { key:'approved', label:'Active',   accent:'#10b981' },
          { key:'rejected', label:'Rejected', accent:'#ef4444' },
        ].map(({ key, label, accent }) => (
          <div key={key} className="kpi-card" style={{ '--accent': accent }}>
            <div className="kpi-value" style={{ color: accent }}>{users.filter(u => u.approval_status === key).length}</div>
            <div className="kpi-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:16, background:'var(--bg-secondary)', padding:4, borderRadius:10, width:'fit-content' }}>
        {Object.entries(TAB_LABELS).map(([k,v]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`btn btn-sm ${tab===k ? 'btn-primary' : 'btn-ghost'}`}>
            {v}
            <span style={{ marginLeft:4, background: tab===k ? 'rgba(255,255,255,.25)' : 'var(--bg-secondary)', borderRadius:99, padding:'1px 7px', fontSize:11 }}>
              {users.filter(u => k==='all' ? true : u.approval_status===k).length}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="empty-state"><div className="empty-state-icon">⏳</div><div className="empty-state-title">Loading…</div></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👤</div>
            <div className="empty-state-title">No {TAB_LABELS[tab].toLowerCase()} users</div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                {['User','Email','Role','Status','Actions'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,var(--brand),#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:14, flexShrink:0 }}>
                        {(u.full_name||u.username||'?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight:600, fontSize:13 }}>{u.full_name || u.username}</div>
                        <div style={{ fontSize:11.5, color:'var(--text-muted)' }}>@{u.username}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ color:'var(--text-muted)', fontSize:13 }}>{u.email || '—'}</td>
                  <td>
                    <select value={u.role||'operator'} onChange={e => setRole(u.id, e.target.value)}
                      style={{ padding:'4px 8px', border:'1.5px solid var(--border)', borderRadius:6, fontSize:12, fontWeight:600, background:'#fff', color:'var(--text)', outline:'none', cursor:'pointer' }}>
                      {['operator','inspector','supervisor','qa','manager','admin'].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[u.approval_status] || 'badge-gray'}`}>
                      {u.approval_status || 'approved'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display:'flex', gap:6 }}>
                      {u.approval_status === 'pending' && (
                        <>
                          <button className="btn btn-success btn-xs" onClick={() => setApproval(u.id, 'approved')}>Approve</button>
                          <button className="btn btn-danger btn-xs" onClick={() => setApproval(u.id, 'rejected')}>Reject</button>
                        </>
                      )}
                      {u.approval_status === 'approved' && (
                        <button className="btn btn-danger btn-xs" onClick={() => setApproval(u.id, 'rejected')}>Revoke</button>
                      )}
                      {u.approval_status === 'rejected' && (
                        <button className="btn btn-success btn-xs" onClick={() => setApproval(u.id, 'approved')}>Re-approve</button>
                      )}
                    </div>
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
