export const THEME_STORAGE_KEY = 'adharaTheme'

export type ThemeMode = 'light' | 'dark'

/** Runs in the browser — syncs `light-mode` on html + body. */
export function applyTheme(theme: ThemeMode) {
  if (typeof document === 'undefined') return
  const on = theme === 'light'
  document.documentElement.classList.toggle('light-mode', on)
  document.body.classList.toggle('light-mode', on)
}

export function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

/** Inline script — must run before first paint (first child of body). */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'){document.documentElement.classList.add('light-mode');document.body.classList.add('light-mode');}}catch(e){}})();`
