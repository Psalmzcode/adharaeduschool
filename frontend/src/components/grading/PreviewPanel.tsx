'use client'

import type { ReactNode } from 'react'

export function PreviewPanel({
  title,
  open = true,
  children,
  footer,
}: {
  title: string
  open?: boolean
  children: ReactNode
  footer?: string
}) {
  return (
    <details style={{ marginTop: 8 }} open={open}>
      <summary className="text-xs" style={{ cursor: 'pointer', color: 'var(--teal2)' }}>
        {title}
      </summary>
      <div style={{ marginTop: 8 }}>{children}</div>
      {footer ? (
        <p className="text-xs text-muted" style={{ marginTop: 6, lineHeight: 1.45 }}>
          {footer}
        </p>
      ) : null}
    </details>
  )
}

export function PreviewFrame({
  children,
  height = 380,
  background = '#fff',
}: {
  children: ReactNode
  height?: number
  background?: string
}) {
  return (
    <div
      style={{
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid var(--border2)',
        background,
      }}
    >
      {children}
    </div>
  )
}
