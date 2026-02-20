import { useState } from 'react'
import { Link } from 'react-router-dom'
import { login } from '../api'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(username, password)
      if (data.token) {
        const user = {
          username:  data.username,
          role:      data.role,
          full_name: data.full_name,
          email:     data.email,
          is_admin:  data.is_admin,
          user_id:   data.user_id,
        }
        localStorage.setItem('qms_token', data.token)
        localStorage.setItem('qms_user', JSON.stringify(user))
        onLogin(user)
      } else {
        setError(data.detail || 'Login failed')
      }
    } catch (err) {
      setError(err?.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* ── Left branding panel ── */}
      <div className="login-panel-left">
        {/* Three-dot Asana-style logo */}
        <div style={{ marginBottom: 36 }}>
          <svg width="48" height="32" viewBox="0 0 18 12" fill="white" opacity=".9">
            <circle cx="3"  cy="9" r="3"/>
            <circle cx="9"  cy="3" r="3"/>
            <circle cx="15" cy="9" r="3"/>
          </svg>
        </div>
        <h2>Quality work,<br/>tracked & signed.</h2>
        <p>
          Manage inspections, documents, operators and compliance workflows —
          all in one place.
        </p>
      </div>

      {/* ── Right form panel ── */}
      <div className="login-panel-right">
        <div className="login-card">
          {/* Logo mark */}
          <div className="login-logo">
            <svg width="22" height="15" viewBox="0 0 18 12" fill="white">
              <circle cx="3"  cy="9" r="3"/>
              <circle cx="9"  cy="3" r="3"/>
              <circle cx="15" cy="9" r="3"/>
            </svg>
          </div>

          <h1 className="login-title">Sign in to QualityOS</h1>
          <p className="login-sub">Enter your credentials to continue</p>

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
              <label>Username</label>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                required autoFocus placeholder="admin"
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required placeholder="••••••••"
              />
            </div>
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
            Default: <strong style={{ color: 'var(--text-secondary)' }}>admin</strong> /
            {' '}<strong style={{ color: 'var(--text-secondary)' }}>admin123</strong>
          </p>
          <p style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
            New user?{' '}
            <Link to="/signup" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>
              Request access
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
