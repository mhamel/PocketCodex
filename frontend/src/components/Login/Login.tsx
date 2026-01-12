import { useState, type FormEvent } from 'react'
import { apiPost } from '../../services/api'
import './Login.css'

interface LoginProps {
  onLoginSuccess: (token: string) => void
}

interface LoginResponse {
  success: boolean
  message: string
  token: string | null
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await apiPost<LoginResponse>('/api/auth/login', {
        username,
        password
      })

      if (response.success && response.token) {
        onLoginSuccess(response.token)
      } else {
        setError(response.message || 'Login failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="loginContainer">
      <div className="loginCard">
        <h1 className="loginTitle">WebCodeAI</h1>
        <form onSubmit={handleSubmit} className="loginForm">
          <div className="loginField">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoComplete="username"
              disabled={loading}
            />
          </div>
          <div className="loginField">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>
          {error && <div className="loginError">{error}</div>}
          <button type="submit" className="loginBtn" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  )
}
