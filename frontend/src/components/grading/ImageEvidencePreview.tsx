'use client'

import { isImageFileUrl, isPdfFileUrl } from './preview-utils'
import { PreviewFrame, PreviewPanel } from './PreviewPanel'

export function ImageEvidencePreview({
  fileUrl,
  description,
}: {
  fileUrl: string
  description?: string
}) {
  if (!fileUrl) return null

  if (isPdfFileUrl(fileUrl)) {
    return (
      <PreviewPanel title="Preview PDF" footer="Embedded PDF viewer. Use Download if your browser blocks the preview.">
        <PreviewFrame>
          <iframe
            title="Student PDF submission"
            src={fileUrl}
            style={{ width: '100%', height: 420, border: 'none', display: 'block' }}
          />
        </PreviewFrame>
      </PreviewPanel>
    )
  }

  if (!isImageFileUrl(fileUrl)) return null

  return (
    <PreviewPanel title="Preview screenshot" footer="Original image from the student's submission.">
      <PreviewFrame>
        <img
          src={fileUrl}
          alt={description || 'Student submission screenshot'}
          style={{ width: '100%', maxHeight: 420, objectFit: 'contain', display: 'block', background: '#0f172a' }}
        />
      </PreviewFrame>
      {description ? (
        <p className="text-xs text-muted" style={{ marginTop: 6, lineHeight: 1.45 }}>
          {description}
        </p>
      ) : null}
    </PreviewPanel>
  )
}
