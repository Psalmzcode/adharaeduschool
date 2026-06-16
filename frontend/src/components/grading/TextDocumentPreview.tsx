'use client'

import { documentBodyText, hasReadableDocumentText } from './preview-utils'
import { PreviewFrame, PreviewPanel } from './PreviewPanel'

export function TextDocumentPreview({
  extractedText,
  title = 'Preview written response',
  footer,
}: {
  extractedText: string
  title?: string
  footer?: string
}) {
  const body = documentBodyText(extractedText)
  if (!hasReadableDocumentText(extractedText)) return null

  return (
    <PreviewPanel title={title} footer={footer}>
      <PreviewFrame background="rgba(255,255,255,0.04)">
        <pre
          className="text-sm"
          style={{
            margin: 0,
            padding: '16px 18px',
            maxHeight: 360,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: 1.6,
            color: 'var(--white)',
          }}
        >
          {body.slice(0, 12000)}
        </pre>
      </PreviewFrame>
    </PreviewPanel>
  )
}
