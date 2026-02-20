import { useState } from 'react'
import { Link } from 'react-router-dom'
import { login } from '../api'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(username, password)
      if (data.token) {
        const user = {
          username: data.username,
          role: data.role,
          full_name: data.full_name,
          is_admin: data.is_admin,
          user_id: data.user_id
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
      <div className="login-card">
        <div className="login-logo">
          <svg width="26" height="26" viewBox="0 0 40 40" fill="none">
            <path d="M8 20l8 8 16-16" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="login-title">Quality Management</h1>
        <p className="login-sub">Sign in to your workspace</p>

        {error && (
          <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:8, padding:'10px 14px', marginBottom:16, color:'#b91c1c', fontSize:13, fontWeight:500 }}>
            ⚠ {error}
          </div>
        )}

        <form onSubmit={submit}>
          <div className="form-group" style={{ marginBottom:14 }}>
            <label>Username</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
              placeholder="admin"
            />
          </div>
          <div className="form-group" style={{ marginBottom:6 }}>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

        <p style={{ textAlign:'center', marginTop:20, fontSize:12, color:'#94a3b8' }}>
          Default: admin / admin123
        </p>
        <p style={{ textAlign:'center', marginTop:8, fontSize:12, color:'#94a3b8' }}>
          New user?{' '}
          <Link to="/signup" style={{ color:'#6366f1', textDecoration:'none', fontWeight:600 }}>
            Request access
          </Link>
        </p>
      </div>
    </div>
  )
}
