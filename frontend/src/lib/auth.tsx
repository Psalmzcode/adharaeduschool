'use client'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { notify } from '@/lib/notify'

interface User { email?: string | null; username?: string | null; role: string; firstName?: string; lastName?: string; avatarUrl?: string; school?: any; tutorProfile?: any; studentProfile?: any; parentProfile?: any }
interface AuthCtx { user: User|null; token: string|null; loading: boolean; login: (e:string,p:string)=>Promise<void>; logout: ()=>void }

const Ctx = createContext<AuthCtx>({ user:null, token:null, loading:false, login:async()=>{}, logout:()=>{} })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User|null>(null)
  const [token, setToken] = useState<string|null>(null)
  const [loading, setLoading] = useState(true)
  const bootToastShownRef = useRef(false)

  useEffect(() => {
    const t = localStorage.getItem('adhara_token')
    if (t) { setToken(t); fetchUser(t) } else setLoading(false)
  }, [])

  const fetchUser = async (t: string) => {
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL||'http://localhost:3001/api/v1'}/auth/me`, { headers:{ Authorization:`Bearer ${t}` }})
      if (r.ok) { const u = await r.json(); setUser(u) }
      else {
        localStorage.removeItem('adhara_token')
        setToken(null)
        setUser(null)
        if (!bootToastShownRef.current) {
          bootToastShownRef.current = true
          notify.info('Session expired. Please sign in again.')
        }
      }
    } catch {
      // Avoid spamming toasts on transient network issues during app boot
    }
    setLoading(false)
  }

  const login = async (login: string, password: string) => {
    const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL||'http://localhost:3001/api/v1'}/auth/login`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ login, password })
    })
    if (!r.ok) { const e = await r.json(); throw new Error(e.message||'Login failed') }
    const { user:u, token:t } = await r.json()
    localStorage.setItem('adhara_token', t); setToken(t); setUser(u)
  }

  const logout = () => { localStorage.removeItem('adhara_token'); setToken(null); setUser(null); window.location.href='/auth/login' }

  return <Ctx.Provider value={{ user, token, loading, login, logout }}>{children}</Ctx.Provider>
}
export const useAuth = () => useContext(Ctx)
