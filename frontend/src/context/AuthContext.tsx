import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { api, setAccessToken } from '../api/client'

interface User {
  id: number
  username: string
  fullName: string
  role: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.auth.refresh().then((ok) => {
      if (ok) {
        return api.auth.me().then((userData) => setUser(userData)).catch(() => {})
      }
    }).finally(() => setLoading(false))
  }, [])

  const login = async (username: string, password: string) => {
    const result = await api.auth.login(username, password)
    setAccessToken(result.token)
    setUser(result.user)
  }

  const logout = async () => {
    try { await api.auth.logout() } catch {}
    setAccessToken(null)
    setUser(null)
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
