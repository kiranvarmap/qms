import { useEffect, useState } from 'react'
import { api } from '../api.js'

const TAB_LABELS = { pending:'Pending Approval', approved:'Active Users', all:'All Users' }
const ROLE_COLORS = { admin:'#f59e0b', manager:'#8b5cf6', supervisor:'#6366f1', qa:'#06b6d4', inspector:'#10b981', operator:'#64748b' }
const STATUS_COLORS = { approved:'#10b981', pending:'#f59e0b', rejected:'#ef4444' }

function Badge({ text, color }) {
  return <span style={{ background:`${color}22`, color, border:`1px solid ${color}55`, borderRadius:'999px', padding:'2px 10px', fontSize:'0.75rem', fontWeight:700, textTransform:'capitalize' }}>{text}</span>
}

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
    try {
      const data = await api('/auth/users')
      setUsers(Array.isArray(data) ? data : [])
    } catch { setUsers([]) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function setApproval(id, status) {
    try {
      await api(`/auth/users/${id}/approval`, { method:'PATCH', body: JSON.stringify({ approval_status: status }) })
      showToast(`User ${status === 'approved' ? 'approved' : 'rejected'} successfully`)
      load()
    } catch (err) {
      showToast(err?.message || 'Action failed', 'error')
    }
  }

  async function setRole(id, role) {
    try {
      await api(`/auth/users/${id}`, { method:'PATCH', body: JSON.stringify({ role }) })
      showToast('Role updated')
      load()
    } catch (err) {
      showToast(err?.message || 'Failed', 'error')
    }
  }

  const filtered = users.filter(u => tab === 'all' ? true : u.approval_status === tab)

  return (
    <div style={{ padding:'2rem', maxWidth:'1100px', margin:'0 auto' }}>
      {toast && (
        <div style={{ position:'fixed', top:'1.5rem', right:'1.5rem', background: toast.type==='error' ? 'rgba(239,68,68,0.95)' : 'rgba(16,185,129,0.95)', color:'#fff', padding:'0.85rem 1.5rem', borderRadius:'0.75rem', fontWeight:600, fontSize:'0.9rem', zIndex:9999, boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{ marginBottom:'2rem' }}>
        <h1 style={{ color:'#f1f5f9', fontSize:'1.75rem', fontWeight:800, margin:'0 0 0.4rem' }}>User Management</h1>
        <p style={{ color:'#64748b', margin:0 }}>Approve access requests and manage team roles</p>
      </div>

      {/* Stats Row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1rem', marginBottom:'2rem' }}>
        {['pending','approved','rejected'].map(s => {
          const count = users.filter(u => u.approval_status === s).length
          const colors = { pending:'#f59e0b', approved:'#10b981', rejected:'#ef4444' }
          return (
            <div key={s} style={{ background:'rgba(30,41,59,0.6)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:'1rem', padding:'1.25rem 1.5rem' }}>
              <div style={{ color:'#64748b', fontSize:'0.75rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'0.5rem' }}>{s}</div>
              <div style={{ color: colors[s], fontSize:'2rem', fontWeight:800 }}>{count}</div>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1.5rem', background:'rgba(15,23,42,0.4)', padding:'4px', borderRadius:'0.75rem', width:'fit-content' }}>
        {Object.entries(TAB_LABELS).map(([k,v]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding:'0.5rem 1.25rem', borderRadius:'0.5rem', border:'none', cursor:'pointer', fontWeight:600, fontSize:'0.875rem', background: tab===k ? 'rgba(99,102,241,0.8)' : 'transparent', color: tab===k ? '#fff' : '#64748b', transition:'all 0.2s' }}>
            {v} <span style={{ background: tab===k ? 'rgba(255,255,255,0.2)' : 'rgba(99,102,241,0.2)', borderRadius:'999px', padding:'1px 7px', marginLeft:'4px', fontSize:'0.75rem' }}>
              {users.filter(u => k==='all' ? true : u.approval_status===k).length}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background:'rgba(30,41,59,0.6)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:'1rem', overflow:'hidden' }}>
        {loading ? (
          <div style={{ padding:'3rem', textAlign:'center', color:'#64748b' }}>Loading users...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:'3rem', textAlign:'center', color:'#64748b' }}>No {TAB_LABELS[tab].toLowerCase()} users found</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid rgba(99,102,241,0.15)' }}>
                {['User','Email','Role','Status','Actions'].map(h => (
                  <th key={h} style={{ padding:'1rem 1.25rem', textAlign:'left', color:'#64748b', fontSize:'0.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: i < filtered.length-1 ? '1px solid rgba(99,102,241,0.08)' : 'none', transition:'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(99,102,241,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}
                >
                  <td style={{ padding:'1rem 1.25rem' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                      <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:`linear-gradient(135deg,${ROLE_COLORS[u.role]||'#6366f1'},${ROLE_COLORS[u.role]||'#8b5cf6'})`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:'0.9rem', flexShrink:0 }}>
                        {(u.full_name||u.username||'?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ color:'#f1f5f9', fontWeight:600, fontSize:'0.9rem' }}>{u.full_name || u.username}</div>
                        <div style={{ color:'#64748b', fontSize:'0.8rem' }}>@{u.username}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:'1rem 1.25rem', color:'#94a3b8', fontSize:'0.875rem' }}>{u.email || '—'}</td>
                  <td style={{ padding:'1rem 1.25rem' }}>
                    <select value={u.role||'operator'} onChange={e => setRole(u.id, e.target.value)}
                      style={{ background:'rgba(15,23,42,0.6)', border:'1px solid rgba(99,102,241,0.25)', borderRadius:'0.5rem', padding:'4px 8px', color: ROLE_COLORS[u.role]||'#94a3b8', fontSize:'0.8rem', fontWeight:600, outline:'none', cursor:'pointer' }}>
                      {['operator','inspector','supervisor','qa','manager','admin'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td style={{ padding:'1rem 1.25rem' }}>
                    <Badge text={u.approval_status||'approved'} color={STATUS_COLORS[u.approval_status]||'#64748b'} />
                  </td>
                  <td style={{ padding:'1rem 1.25rem' }}>
                    <div style={{ display:'flex', gap:'0.5rem' }}>
                      {u.approval_status === 'pending' && <>
                        <button onClick={() => setApproval(u.id, 'approved')} style={{ background:'rgba(16,185,129,0.2)', color:'#10b981', border:'1px solid rgba(16,185,129,0.4)', borderRadius:'0.5rem', padding:'5px 12px', fontSize:'0.8rem', fontWeight:600, cursor:'pointer' }}>Approve</button>
                        <button onClick={() => setApproval(u.id, 'rejected')} style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'0.5rem', padding:'5px 12px', fontSize:'0.8rem', fontWeight:600, cursor:'pointer' }}>Reject</button>
                      </>}
                      {u.approval_status === 'approved' && (
                        <button onClick={() => setApproval(u.id, 'rejected')} style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'0.5rem', padding:'5px 12px', fontSize:'0.8rem', fontWeight:600, cursor:'pointer' }}>Revoke</button>
                      )}
                      {u.approval_status === 'rejected' && (
                        <button onClick={() => setApproval(u.id, 'approved')} style={{ background:'rgba(16,185,129,0.2)', color:'#10b981', border:'1px solid rgba(16,185,129,0.4)', borderRadius:'0.5rem', padding:'5px 12px', fontSize:'0.8rem', fontWeight:600, cursor:'pointer' }}>Re-approve</button>
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
