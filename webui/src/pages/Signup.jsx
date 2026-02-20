import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const BASE = '/api/v1'

export default function Signup() {
  const nav = useNavigate()
  const [form, setForm] = useState({ username:'', email:'', full_name:'', password:'', role:'operator' })
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const [error, setError]     = useState('')

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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
    <div className="login-page">
      <div className="login-panel-left">
        <div style={{ marginBottom: 36 }}>
          <svg width="48" height="32" viewBox="0 0 18 12" fill="white" opacity=".9">
            <circle cx="3"  cy="9" r="3"/>
            <circle cx="9"  cy="3" r="3"/>
            <circle cx="15" cy="9" r="3"/>
          </svg>
        </div>
        <h2>Welcome aboard.</h2>
        <p>Your request has been submitted. An admin will review your access shortly.</p>
      </div>
      <div className="login-panel-right">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>✅</div>
          <h2 className="login-title">Request Submitted!</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
            An admin will review and approve your access. You'll be able to log in once approved.
          </p>
          <Link to="/login" className="login-btn" style={{ display: 'block', textDecoration: 'none', textAlign: 'center' }}>
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <div className="login-page">
      {/* Left branding panel */}
      <div className="login-panel-left">
        <div style={{ marginBottom: 36 }}>
          <svg width="48" height="32" viewBox="0 0 18 12" fill="white" opacity=".9">
            <circle cx="3"  cy="9" r="3"/>
            <circle cx="9"  cy="3" r="3"/>
            <circle cx="15" cy="9" r="3"/>
          </svg>
        </div>
        <h2>Join your team on QualityOS.</h2>
        <p>Request access and get started managing quality workflows with your organisation.</p>
      </div>

      {/* Right form panel */}
      <div className="login-panel-right">
        <div className="login-card">
          <div className="login-logo">
            <svg width="22" height="15" viewBox="0 0 18 12" fill="white">
              <circle cx="3"  cy="9" r="3"/>
              <circle cx="9"  cy="3" r="3"/>
              <circle cx="15" cy="9" r="3"/>
            </svg>
          </div>
          <h1 className="login-title">Create account</h1>
          <p className="login-sub">Request access to QualityOS</p>

          {error && (
            <div style={{
              background: '#FFEAEA', border: '1px solid #FFBBBB',
              borderRadius: 6, padding: '10px 14px', marginBottom: 16,
              color: '#C62828', fontSize: 13, fontWeight: 500,
            }}>
              ⚠ {error}
            </div>
          )}

          <form onSubmit={submit}>
            <div className="form-group">
              <label>Full Name</label>
              <input value={form.full_name} onChange={set('full_name')} required placeholder="Jane Smith" />
            </div>
            <div className="form-group">
              <label>Username</label>
              <input value={form.username} onChange={set('username')} required placeholder="janesmith" />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={set('email')} required placeholder="jane@company.com" />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={form.password} onChange={set('password')} required placeholder="••••••••" />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select value={form.role} onChange={set('role')}>
                <option value="operator">Operator</option>
                <option value="inspector">Inspector</option>
                <option value="supervisor">Supervisor</option>
                <option value="manager">Manager</option>
                <option value="qa">QA Engineer</option>
              </select>
            </div>
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Submitting…' : 'Request Access'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
