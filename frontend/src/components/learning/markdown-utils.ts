/** Extract ## / ### headings for outline navigation. */
export function extractMarkdownHeadings(markdown: string) {
  const headings: { id: string; text: string; level: number }[] = []
  for (const line of String(markdown || '').split('\n')) {
    const m = line.match(/^(#{1,3})\s+(.+)/)
    if (!m) continue
    const text = m[2].trim()
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
    headings.push({ id, text, level: m[1].length })
  }
  return headings
}

export function slugifyHeading(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}
