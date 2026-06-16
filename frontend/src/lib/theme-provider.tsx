'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { applyTheme, readStoredTheme, THEME_STORAGE_KEY, type ThemeMode } from './theme'

interface ThemeCtx {
  theme: ThemeMode
  toggle: () => void
}

const Ctx = createContext<ThemeCtx>({ theme: 'dark', toggle: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>('dark')

  useEffect(() => {
    const stored = readStoredTheme()
    setTheme(stored)
    applyTheme(stored)
  }, [])

  const toggle = () => {
    setTheme((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      localStorage.setItem(THEME_STORAGE_KEY, next)
      return next
    })
  }

  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>
}

export const useTheme = () => useContext(Ctx)
