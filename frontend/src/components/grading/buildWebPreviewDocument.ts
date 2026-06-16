type CodeFile = { filename: string; language?: string; content: string }

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function basename(path: string): string {
  return path.replace(/^.*[\\/]/, '')
}

function pickMainHtml(files: CodeFile[]): CodeFile | undefined {
  const htmlFiles = files.filter((f) => /\.html?$/i.test(f.filename) || f.language === 'html')
  return htmlFiles.find((f) => /index\.html?$/i.test(f.filename)) || htmlFiles[0]
}

/** Bundle extracted HTML/CSS/JS into one document for iframe preview. */
export function buildWebPreviewDocument(codeFiles: CodeFile[]): string | null {
  if (!codeFiles?.length) return null

  const htmlFile = pickMainHtml(codeFiles)
  if (!htmlFile) return null

  const cssFiles = codeFiles.filter((f) => f.filename.toLowerCase().endsWith('.css'))
  const jsFiles = codeFiles.filter((f) => f.filename.toLowerCase().endsWith('.js'))

  let doc = htmlFile.content

  for (const css of cssFiles) {
    const name = escapeRegExp(basename(css.filename))
    doc = doc.replace(new RegExp(`<link[^>]*href=["'][^"']*${name}["'][^>]*>`, 'gi'), '')
  }
  for (const js of jsFiles) {
    const name = escapeRegExp(basename(js.filename))
    doc = doc.replace(new RegExp(`<script[^>]*src=["'][^"']*${name}["'][^>]*>\\s*</script>`, 'gi'), '')
  }

  const styleBlock = cssFiles.map((f) => f.content).join('\n')
  const scriptBlock = jsFiles.map((f) => f.content).join('\n')

  if (/<head[\s>]/i.test(doc)) {
    if (styleBlock) {
      doc = doc.replace(/<head([^>]*)>/i, `<head$1><style>${styleBlock}</style>`)
    }
  }

  if (scriptBlock) {
    if (/<\/body>/i.test(doc)) {
      doc = doc.replace(/<\/body>/i, `<script>${scriptBlock}</script></body>`)
    } else {
      doc += `<script>${scriptBlock}</script>`
    }
  }

  if (!/<html/i.test(doc)) {
    doc = `<!DOCTYPE html><html><head><meta charset="utf-8">${styleBlock ? `<style>${styleBlock}</style>` : ''}</head><body>${doc}${scriptBlock ? `<script>${scriptBlock}</script>` : ''}</body></html>`
  } else if (!/<!DOCTYPE/i.test(doc)) {
    doc = `<!DOCTYPE html>\n${doc}`
  }

  return doc
}

export function hasWebPreview(codeFiles: CodeFile[] | undefined | null): boolean {
  return Boolean(codeFiles?.length && pickMainHtml(codeFiles))
}

function parseSectionsFromExtractedText(text: string): CodeFile[] {
  const sources: CodeFile[] = []
  const htmlMatch = text.match(/--- HTML ---\n([\s\S]*?)(?=\n--- [A-Z]|\n--- Rendered|$)/)
  const cssMatch = text.match(/--- CSS ---\n([\s\S]*?)(?=\n--- [A-Z]|\n--- Rendered|$)/)
  const jsMatch = text.match(/--- JavaScript ---\n([\s\S]*?)(?=\n--- [A-Z]|\n--- Rendered|$)/)
  if (htmlMatch) sources.push({ filename: 'index.html', content: htmlMatch[1].trim() })
  if (cssMatch) sources.push({ filename: 'styles.css', content: cssMatch[1].trim() })
  if (jsMatch) sources.push({ filename: 'app.js', content: jsMatch[1].trim() })
  return sources
}

/** Build iframe HTML from codeFiles or embedded --- HTML --- sections in extractedText. */
export function buildWebPreviewFromEvidence(evidence: {
  codeFiles?: CodeFile[]
  extractedText?: string
}): string | null {
  if (evidence.codeFiles?.length) {
    const fromFiles = buildWebPreviewDocument(evidence.codeFiles)
    if (fromFiles) return fromFiles
  }

  const text = String(evidence.extractedText || '').trim()
  if (!text) return null

  if (/<!DOCTYPE html|<html[\s>]/i.test(text)) {
    return buildWebPreviewDocument([{ filename: 'index.html', content: text }])
  }

  const sections = parseSectionsFromExtractedText(text)
  if (sections.length) return buildWebPreviewDocument(sections)

  return null
}

export function hasWebPreviewFromEvidence(evidence: {
  codeFiles?: CodeFile[]
  extractedText?: string
} | null | undefined): boolean {
  if (!evidence) return false
  return Boolean(buildWebPreviewFromEvidence(evidence))
}
