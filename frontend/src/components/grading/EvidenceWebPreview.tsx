'use client'

import { useMemo } from 'react'
import { buildWebPreviewFromEvidence } from './buildWebPreviewDocument'
import { PreviewFrame, PreviewPanel } from './PreviewPanel'

export function EvidenceWebPreview({ evidence }: { evidence: any }) {
  const previewHtml = useMemo(() => buildWebPreviewFromEvidence(evidence), [evidence])
  if (!previewHtml) return null

  return (
    <PreviewPanel
      title="Preview website"
      footer="Live render from the student's HTML, CSS, and JavaScript — works for single .html files and ZIP projects."
    >
      <PreviewFrame>
        <iframe
          title="Student web project preview"
          srcDoc={previewHtml}
          sandbox="allow-scripts"
          style={{ width: '100%', height: 380, border: 'none', display: 'block' }}
        />
      </PreviewFrame>
    </PreviewPanel>
  )
}
