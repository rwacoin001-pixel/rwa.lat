'use client'

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type PropsWithChildren } from 'react'
export type RwaTheme = 'light' | 'dark'
export type RwaMode = 'ledger' | 'instrument'
export type RwaThemePreference = RwaTheme | 'system'
type Value = { theme: RwaTheme; preference: RwaThemePreference; mode: RwaMode; setTheme: (value: RwaThemePreference) => void; toggleTheme: () => void; setMode: (value: RwaMode) => void }
const Context = createContext<Value | null>(null)
export function RwaThemeProvider({ children }: PropsWithChildren) {
  const [preference, setPreference] = useState<RwaThemePreference>('system')
  const [systemDark, setSystemDark] = useState(false)
  const [mode, setModeState] = useState<RwaMode>('ledger')
  const [ready, setReady] = useState(false)
  useLayoutEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    setSystemDark(media.matches)
    try {
      const saved = localStorage.getItem('rwa.theme') ?? localStorage.getItem('rwa-app-theme')
      if (saved === 'light' || saved === 'dark' || saved === 'system') setPreference(saved)
      const savedMode = localStorage.getItem('rwa.mode')
      if (savedMode === 'ledger' || savedMode === 'instrument') setModeState(savedMode)
    } catch { /* Storage is optional. */ }
    setReady(true)
    const change = () => setSystemDark(media.matches)
    media.addEventListener('change', change)
    const storage = (event: StorageEvent) => {
      if (event.key === 'rwa.theme') setPreference(event.newValue === 'light' || event.newValue === 'dark' ? event.newValue : 'system')
      if (event.key === 'rwa.mode') setModeState(event.newValue === 'instrument' ? 'instrument' : 'ledger')
    }
    window.addEventListener('storage', storage)
    return () => { media.removeEventListener('change', change); window.removeEventListener('storage', storage) }
  }, [])
  const theme: RwaTheme = preference === 'system' ? systemDark ? 'dark' : 'light' : preference
  useEffect(() => {
    if (!ready) return
    document.documentElement.dataset.theme = theme
    document.documentElement.dataset.mode = mode
    // Palette A styles both themes itself; 'light dark' keeps browser auto-dark (Xiaomi, Samsung, Chrome) off it.
    document.documentElement.style.colorScheme = document.documentElement.dataset.palette === 'a' && theme === 'light' ? 'light dark' : theme
    try { localStorage.setItem('rwa.theme', preference); localStorage.setItem('rwa.mode', mode) } catch { /* Storage is optional. */ }
  }, [theme, mode, preference, ready])
  const setTheme = useCallback((value: RwaThemePreference) => setPreference(value), [])
  const setMode = useCallback((value: RwaMode) => setModeState(value), [])
  const toggleTheme = useCallback(() => setPreference(theme === 'light' ? 'dark' : 'light'), [theme])
  const value = useMemo(() => ({ theme, preference, mode, setTheme, setMode, toggleTheme }), [theme, preference, mode, setTheme, setMode, toggleTheme])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useRwaTheme() {
  const value = useContext(Context)
  if (!value) throw new Error('useRwaTheme must be used within RwaThemeProvider')
  return value
}
