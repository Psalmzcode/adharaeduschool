'use client'

import { documentBodyText, hasReadableDocumentText } from './preview-utils'
import { PreviewFrame, PreviewPanel } from './PreviewPanel'

export function WordDocumentPreview({ extractedText }: { extractedText: string }) {
  const body = documentBodyText(extractedText)
  if (!hasReadableDocumentText(extractedText)) return null

  const paragraphs = body.split(/\n{2,}/).filter(Boolean)

  return (
    <PreviewPanel
      title="Preview document"
      footer="Text extracted from the Word file. Download the original .docx to see exact formatting."
    >
      <PreviewFrame background="rgba(255,255,255,0.97)">
        <article
          style={{
            padding: '20px 22px',
            maxHeight: 380,
            overflow: 'auto',
            color: '#1a1a1a',
            fontSize: 14,
            lineHeight: 1.65,
          }}
        >
          {paragraphs.map((p, i) => (
            <p key={i} style={{ margin: i === 0 ? 0 : '0 0 14px' }}>
              {p}
            </p>
          ))}
        </article>
      </PreviewFrame>
    </PreviewPanel>
  )
}
