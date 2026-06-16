'use client'

import { isImageFileUrl, isOfficeDownloadOnly, isPdfFileUrl, isZipFileUrl } from './preview-utils'

function linkLabel(url: string, submissionType?: string | null): string {
  const type = String(submissionType || '').toLowerCase()
  if (isZipFileUrl(url, submissionType)) return 'Download ZIP'
  if (type === 'scratch' || /\.sb3(\?|$)/i.test(url)) return 'Download Scratch project'
  if (type === 'word' || /\.docx?(\?|$)/i.test(url)) return 'Download Word document'
  if (type === 'excel' || /\.xlsx?(\?|$)/i.test(url)) return 'Download Excel file'
  if (type === 'html' || /\.html?(\?|$)/i.test(url)) return 'Download HTML file'
  if (isPdfFileUrl(url)) return 'Open PDF'
  if (isImageFileUrl(url) || type === 'image') return 'Open image'
  return 'Open file'
}

function previewHint(url: string, submissionType?: string | null): string | null {
  const type = String(submissionType || '').toLowerCase()
  if (isZipFileUrl(url, submissionType) || type === 'html') {
    return 'Use Preview website below to view the page.'
  }
  if (type === 'word' || /\.docx?(\?|$)/i.test(url)) {
    return 'Use Preview document below for extracted text.'
  }
  if (type === 'excel' || /\.xlsx?(\?|$)/i.test(url)) {
    return 'Use Preview spreadsheet below for the table view.'
  }
  if (type === 'image' || isImageFileUrl(url) || isPdfFileUrl(url)) {
    return 'Use Preview screenshot below, or open the image directly.'
  }
  if (type === 'scratch' || /\.sb3(\?|$)/i.test(url)) {
    return 'Use Preview Scratch project below, then download to run in Scratch.'
  }
  if (type === 'text') return 'Use Preview written response below.'
  if (isOfficeDownloadOnly(submissionType, url)) return 'Use the preview panel below.'
  return null
}

export function SubmissionEvidenceLinks({
  evidenceUrl,
  submissionType,
}: {
  evidenceUrl?: string | null
  submissionType?: string | null
}) {
  if (!evidenceUrl?.trim()) return <span>—</span>

  const hint = previewHint(evidenceUrl, submissionType)

  return (
    <span>
      <a
        href={evidenceUrl}
        target="_blank"
        rel="noreferrer"
        download={isZipFileUrl(evidenceUrl, submissionType) || isOfficeDownloadOnly(submissionType, evidenceUrl) ? true : undefined}
        className="text-teal"
        style={{ color: 'var(--teal2)' }}
      >
        {linkLabel(evidenceUrl, submissionType)}
      </a>
      {hint ? (
        <span className="text-muted text-xs" style={{ marginLeft: 6 }}>
          — {hint}
        </span>
      ) : null}
    </span>
  )
}
