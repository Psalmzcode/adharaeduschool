'use client'

import { useMemo } from 'react'
import { HandoutReader } from './HandoutReader'
import { extractMarkdownHeadings } from './markdown-utils'

type Props = {
  markdown: string
  title?: string
}

export function MaterialPreview({ markdown, title }: Props) {
  const headings = useMemo(() => extractMarkdownHeadings(markdown), [markdown])

  const jumpTo = (id: string) => {
    const el = document.getElementById(id)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="material-preview">
      {headings.length > 0 && (
        <aside className="material-preview-outline">
          <div className="material-preview-outline-title">Outline</div>
          {title && <div className="material-preview-outline-session">{title}</div>}
          <nav className="material-preview-outline-nav">
            {headings.map((h) => (
              <button
                key={`${h.id}-${h.text}`}
                type="button"
                className="material-preview-outline-link"
                style={{ paddingLeft: h.level > 2 ? 16 : h.level > 1 ? 8 : 0 }}
                onClick={() => jumpTo(h.id)}
              >
                {h.text}
              </button>
            ))}
          </nav>
        </aside>
      )}
      <div className="material-preview-body">
        <HandoutReader markdown={markdown} />
      </div>
    </div>
  )
}
