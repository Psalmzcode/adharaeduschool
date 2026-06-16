'use client'

const DEFAULT_EXTENSIONS: Record<string, string> = {
  word: '.docx',
  excel: '.xlsx',
  html: '.html, .htm, .css, .js',
  zip: '.zip',
  scratch: '.sb3',
  image: '.png, .jpg, .jpeg, .pdf',
  text: '.txt, .md',
  mixed: '.docx, .xlsx, .html, .htm, .zip, .sb3, .png, .jpg, .jpeg, .pdf',
}

const TYPE_LABELS: Record<string, string> = {
  word: 'Word document',
  excel: 'Excel spreadsheet',
  html: 'Web page (HTML/CSS/JS)',
  zip: 'ZIP web project',
  scratch: 'Scratch project',
  image: 'Screenshot or image',
  text: 'Written response',
  mixed: 'Any supported file',
}

function formatExtensions(allowedExtensions: unknown, submissionType?: string | null): string {
  if (Array.isArray(allowedExtensions) && allowedExtensions.length) {
    return allowedExtensions.map((x) => String(x)).join(', ')
  }
  const type = String(submissionType || 'mixed').toLowerCase()
  return DEFAULT_EXTENSIONS[type] || DEFAULT_EXTENSIONS.mixed
}

export function SubmissionUploadHints({
  submissionType,
  allowedExtensions,
  maxSizeMB,
  extraNote,
}: {
  submissionType?: string | null
  allowedExtensions?: unknown
  maxSizeMB?: number | null
  extraNote?: string
}) {
  const type = String(submissionType || 'mixed').toLowerCase()
  const size = Number(maxSizeMB) > 0 ? Number(maxSizeMB) : 10

  return (
    <div
      className="text-xs text-muted"
      style={{
        marginBottom: 10,
        padding: '10px 12px',
        borderRadius: 8,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--border2)',
        lineHeight: 1.55,
      }}
    >
      <div style={{ fontWeight: 600, color: 'var(--white)', marginBottom: 4 }}>
        {TYPE_LABELS[type] || 'Submission requirements'}
      </div>
      <div>Accepted formats: {formatExtensions(allowedExtensions, submissionType)}</div>
      <div>Maximum size: {size}MB</div>
      {type === 'word' ? <div>Use .docx — older .doc files are not accepted.</div> : null}
      {type === 'zip' ? <div>ZIP must contain your HTML, CSS, and JS files (no node_modules).</div> : null}
      {extraNote ? <div>{extraNote}</div> : null}
    </div>
  )
}
