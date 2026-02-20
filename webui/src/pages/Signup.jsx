import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const BASE = '/api/v1'

export default function Signup() {
  const nav = useNavigate()
  const [form, setForm] = useState({ username:'', email:'', full_name:'', password:'', role:'operator' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Signup failed')
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (done) return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ background:'rgba(30,41,59,0.95)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:'1.5rem', padding:'3rem 2.5rem', maxWidth:'460px', width:'100%', textAlign:'center' }}>
        <div style={{ width:'64px', height:'64px', borderRadius:'50%', background:'rgba(16,185,129,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.5rem', fontSize:'2rem' }}>✅</div>
        <h2 style={{ color:'#f1f5f9', fontSize:'1.5rem', fontWeight:700, marginBottom:'0.75rem' }}>Request Submitted!</h2>
        <p style={{ color:'#94a3b8', marginBottom:'2rem', lineHeight:1.6 }}>
          Your account request has been submitted. An admin will review and approve your access. You'll be able to log in once approved.
        </p>
        <Link to="/login" style={{ display:'inline-block', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff', textDecoration:'none', padding:'0.75rem 2rem', borderRadius:'0.75rem', fontWeight:600, fontSize:'0.9rem' }}>Back to Login</Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ background:'rgba(30,41,59,0.95)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:'1.5rem', padding:'3rem 2.5rem', maxWidth:'460px', width:'100%', boxShadow:'0 25px 50px rgba(0,0,0,0.5)' }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <div style={{ width:'56px', height:'56px', borderRadius:'0.75rem', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1rem', fontSize:'1.5rem' }}>🏭</div>
          <h1 style={{ color:'#f1f5f9', fontSize:'1.5rem', fontWeight:800, margin:0 }}>Create Account</h1>
          <p style={{ color:'#64748b', fontSize:'0.85rem', marginTop:'0.4rem' }}>Request access to QMS Platform</p>
        </div>

        {error && <div style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.4)', borderRadius:'0.75rem', padding:'0.75rem 1rem', marginBottom:'1.5rem', color:'#fca5a5', fontSize:'0.875rem' }}>{error}</div>}

        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
          <div>
            <label style={{ display:'block', color:'#94a3b8', fontSize:'0.8rem', fontWeight:600, marginBottom:'0.4rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>Full Name</label>
            <input value={form.full_name} onChange={set('full_name')} required placeholder="Jane Smith" style={{ width:'100%', background:'rgba(15,23,42,0.6)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:'0.75rem', padding:'0.75rem 1rem', color:'#f1f5f9', fontSize:'0.95rem', outline:'none', boxSizing:'border-box' }} />
          </div>
          <div>
            <label style={{ display:'block', color:'#94a3b8', fontSize:'0.8rem', fontWeight:600, marginBottom:'0.4rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>Username</label>
            <input value={form.username} onChange={set('username')} required placeholder="janesmith" style={{ width:'100%', background:'rgba(15,23,42,0.6)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:'0.75rem', padding:'0.75rem 1rem', color:'#f1f5f9', fontSize:'0.95rem', outline:'none', boxSizing:'border-box' }} />
          </div>
          <div>
            <label style={{ display:'block', color:'#94a3b8', fontSize:'0.8rem', fontWeight:600, marginBottom:'0.4rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>Email</label>
            <input type="email" value={form.email} onChange={set('email')} required placeholder="jane@company.com" style={{ width:'100%', background:'rgba(15,23,42,0.6)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:'0.75rem', padding:'0.75rem 1rem', color:'#f1f5f9', fontSize:'0.95rem', outline:'none', boxSizing:'border-box' }} />
          </div>
          <div>
            <label style={{ display:'block', color:'#94a3b8', fontSize:'0.8rem', fontWeight:600, marginBottom:'0.4rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>Password</label>
            <input type="password" value={form.password} onChange={set('password')} required placeholder="••••••••" style={{ width:'100%', background:'rgba(15,23,42,0.6)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:'0.75rem', padding:'0.75rem 1rem', color:'#f1f5f9', fontSize:'0.95rem', outline:'none', boxSizing:'border-box' }} />
          </div>
          <div>
            <label style={{ display:'block', color:'#94a3b8', fontSize:'0.8rem', fontWeight:600, marginBottom:'0.4rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>Role</label>
            <select value={form.role} onChange={set('role')} style={{ width:'100%', background:'rgba(15,23,42,0.6)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:'0.75rem', padding:'0.75rem 1rem', color:'#f1f5f9', fontSize:'0.95rem', outline:'none', boxSizing:'border-box' }}>
              <option value="operator">Operator</option>
              <option value="inspector">Inspector</option>
              <option value="supervisor">Supervisor</option>
              <option value="manager">Manager</option>
              <option value="qa">QA Engineer</option>
            </select>
          </div>

          <button type="submit" disabled={loading} style={{ background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff', border:'none', borderRadius:'0.75rem', padding:'0.9rem', fontSize:'1rem', fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer', marginTop:'0.5rem' }}>
            {loading ? 'Submitting...' : 'Request Access'}
          </button>
        </form>

        <p style={{ textAlign:'center', color:'#64748b', fontSize:'0.875rem', marginTop:'1.5rem', marginBottom:0 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color:'#818cf8', textDecoration:'none', fontWeight:600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
