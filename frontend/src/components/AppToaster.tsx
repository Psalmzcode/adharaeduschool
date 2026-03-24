'use client'

import { Toaster } from 'react-hot-toast'

/** Sleek toasts — theme vars follow dark / light (body.light-mode). */
export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      containerStyle={{ top: 72, zIndex: 10000 }}
      toastOptions={{
        duration: 3800,
        className: 'adhara-toast',
        style: {
          background: 'var(--glass2)',
          color: 'var(--white)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          padding: '14px 18px',
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          lineHeight: 1.45,
          boxShadow: 'var(--shadow-sm)',
          maxWidth: 'min(420px, calc(100vw - 32px))',
        },
        success: {
          duration: 3600,
          iconTheme: { primary: '#0A1628', secondary: '#22C55E' },
          style: { borderColor: 'rgba(34, 197, 94, 0.35)' },
        },
        error: {
          duration: 5200,
          iconTheme: { primary: '#0A1628', secondary: '#EF4444' },
          style: { borderColor: 'rgba(239, 68, 68, 0.35)' },
        },
      }}
    />
  )
}
