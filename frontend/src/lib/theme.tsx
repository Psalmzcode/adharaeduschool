'use client'
import { createContext, useContext, useEffect, useState } from 'react'

interface ThemeCtx { theme: 'dark'|'light'; toggle: () => void }
const Ctx = createContext<ThemeCtx>({ theme:'dark', toggle:()=>{} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'dark'|'light'>('dark')
  useEffect(() => {
    const saved = localStorage.getItem('adharaTheme')
    if (saved === 'light') { setTheme('light'); document.body.classList.add('light-mode') }
  }, [])
  const toggle = () => {
    if (theme === 'dark') {
      setTheme('light'); document.body.classList.add('light-mode'); localStorage.setItem('adharaTheme','light')
    } else {
      setTheme('dark'); document.body.classList.remove('light-mode'); localStorage.setItem('adharaTheme','dark')
    }
  }
  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>
}
export const useTheme = () => useContext(Ctx)
