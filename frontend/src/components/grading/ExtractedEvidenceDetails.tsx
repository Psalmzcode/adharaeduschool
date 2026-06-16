'use client'

import { hasWebPreviewFromEvidence } from './buildWebPreviewDocument'
import { EvidenceWebPreview } from './EvidenceWebPreview'
import { ImageEvidencePreview } from './ImageEvidencePreview'
import { hasReadableDocumentText, resolveEvidenceFileUrl } from './preview-utils'
import { ScratchProjectPreview } from './ScratchProjectPreview'
import { SpreadsheetPreview } from './SpreadsheetPreview'
import { TextDocumentPreview } from './TextDocumentPreview'
import { WordDocumentPreview } from './WordDocumentPreview'

/** Tutor-visible extraction preview (before or after AI suggest grade). */
export function ExtractedEvidenceDetails({
  evidence,
  evidenceUrl,
  submissionType,
}: {
  evidence: any
  evidenceUrl?: string | null
  submissionType?: string | null
}) {
  if (!evidence) return null

  const fileUrl = resolveEvidenceFileUrl(evidence, evidenceUrl)
  const fileType = String(evidence.metadata?.fileType || '').toLowerCase()
  const type = String(submissionType || fileType || '').toLowerCase()
  const extractedText = String(evidence.extractedText || '').trim()
  const codeFiles = evidence.codeFiles || []
  const tables = evidence.tables || []
  const scratchData = evidence.scratchData

  const showWeb = hasWebPreviewFromEvidence(evidence)
  const showWord =
    !showWeb &&
    (type === 'word' || fileType === 'docx' || /\.docx?(\?|$)/i.test(fileUrl || '')) &&
    hasReadableDocumentText(extractedText)
  const showExcel = !showWeb && tables.length > 0
  const showImage =
    !showWeb &&
    !showWord &&
    !showExcel &&
    fileUrl &&
    (type === 'image' || fileType === 'image' || /\.(png|jpe?g|gif|webp|pdf)(\?|$)/i.test(fileUrl))
  const showScratch = Boolean(scratchData)
  const showVisionText =
    !showWeb &&
    !showWord &&
    !showExcel &&
    !showImage &&
    !showScratch &&
    (type === 'image' || fileType === 'image') &&
    hasReadableDocumentText(extractedText)
  const showText =
    !showWeb &&
    !showWord &&
    !showExcel &&
    !showImage &&
    !showScratch &&
    !showVisionText &&
    (type === 'text' || hasReadableDocumentText(extractedText))

  const hasRichPreview =
    showWeb || showWord || showExcel || showImage || showScratch || showVisionText || showText
  const isZipManifest = /^ZIP archive contains \d+ file/i.test(extractedText)

  return (
    <div style={{ marginTop: 4 }}>
      {showWeb && <EvidenceWebPreview evidence={evidence} />}
      {showWord && <WordDocumentPreview extractedText={extractedText} />}
      {showExcel && <SpreadsheetPreview tables={tables} />}
      {showImage && fileUrl && (
        <ImageEvidencePreview
          fileUrl={fileUrl}
          description={evidence.images?.[0]?.description || extractedText.slice(0, 280)}
        />
      )}
      {showScratch && <ScratchProjectPreview scratchData={scratchData} fileUrl={fileUrl} />}
      {showVisionText && (
        <TextDocumentPreview
          extractedText={extractedText}
          title="Preview image analysis"
          footer="AI description of what is visible in the screenshot. Open the image file for the original."
        />
      )}
      {showText && <TextDocumentPreview extractedText={extractedText} />}

      <details style={{ marginTop: 8 }} open={!hasRichPreview}>
        <summary className="text-xs" style={{ cursor: 'pointer', color: 'var(--teal2)' }}>
          View source data
        </summary>
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {extractedText && !(showWeb && isZipManifest) && (
            <pre
              className="text-xs text-muted"
              style={{
                whiteSpace: 'pre-wrap',
                maxHeight: 180,
                overflow: 'auto',
                background: 'rgba(0,0,0,0.2)',
                padding: 10,
                borderRadius: 8,
                margin: 0,
              }}
            >
              {extractedText.slice(0, 4000)}
            </pre>
          )}
          {codeFiles.length > 0 && (
            <pre
              className="text-xs text-muted"
              style={{
                whiteSpace: 'pre-wrap',
                maxHeight: 180,
                overflow: 'auto',
                background: 'rgba(0,0,0,0.2)',
                padding: 10,
                borderRadius: 8,
                margin: 0,
              }}
            >
              {codeFiles.map((f: any) => `--- ${f.filename} ---\n${f.content}`).join('\n\n').slice(0, 4000)}
            </pre>
          )}
          {tables.length > 0 && showExcel && (
            <pre
              className="text-xs text-muted"
              style={{
                whiteSpace: 'pre-wrap',
                maxHeight: 120,
                overflow: 'auto',
                background: 'rgba(0,0,0,0.2)',
                padding: 10,
                borderRadius: 8,
                margin: 0,
              }}
            >
              Raw table export shown above in spreadsheet preview.
            </pre>
          )}
        </div>
      </details>
    </div>
  )
}
