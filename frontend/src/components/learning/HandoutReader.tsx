'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { slugifyHeading } from './markdown-utils'

type Props = {
  markdown: string
  className?: string
  maxHeight?: string | number
}

export function HandoutReader({ markdown, className = '', maxHeight }: Props) {
  const content = String(markdown || '').trim()
  if (!content) {
    return <p className="text-muted text-sm">No content yet.</p>
  }

  const style = maxHeight
    ? { maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight, overflow: 'auto' as const }
    : undefined

  return (
    <div className={`markdown-prose ${className}`.trim()} style={style}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => {
            const text = String(children)
            return <h1 id={slugifyHeading(text)}>{children}</h1>
          },
          h2: ({ children }) => {
            const text = String(children)
            return <h2 id={slugifyHeading(text)}>{children}</h2>
          },
          h3: ({ children }) => {
            const text = String(children)
            return <h3 id={slugifyHeading(text)}>{children}</h3>
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
