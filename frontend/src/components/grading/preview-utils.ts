export function resolveEvidenceFileUrl(
  evidence: { metadata?: { sourceUrl?: string } } | null | undefined,
  evidenceUrl?: string | null,
): string | null {
  const url = String(evidenceUrl || evidence?.metadata?.sourceUrl || '').trim()
  return url || null
}

export function isImageFileUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url) || /\/image\/upload\//i.test(url)
}

export function isPdfFileUrl(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url) || /application\/pdf/i.test(url)
}

export function isZipFileUrl(url: string, submissionType?: string | null): boolean {
  if (submissionType === 'zip') return true
  return /\.zip(\?|$)/i.test(url)
}

export function isOfficeDownloadOnly(submissionType?: string | null, url?: string | null): boolean {
  const type = String(submissionType || '').toLowerCase()
  if (type === 'word' || type === 'excel' || type === 'scratch') return true
  if (!url) return false
  return /\.(docx?|xlsx?|sb3)(\?|$)/i.test(url)
}

/** Strip AI/summary headers from extracted essay or document text. */
export function documentBodyText(extractedText: string): string {
  let text = String(extractedText || '').trim()
  text = text.replace(/^Document summary:.*\n\n?/i, '')
  text = text.replace(/^Structure summary:.*\n\n?/i, '')
  text = text.replace(/^ZIP archive contains \d+ file\(s\):.*\n\n?/i, '')
  text = text.replace(/\n--- Student note ---[\s\S]*$/m, '')
  text = text.replace(/\n--- Rendered page text ---[\s\S]*$/m, '')
  text = text.replace(/^--- HTML ---\n[\s\S]*$/m, '') // web projects use iframe preview
  return text.trim()
}

export function hasReadableDocumentText(extractedText: string): boolean {
  const body = documentBodyText(extractedText)
  return body.length >= 40
}
