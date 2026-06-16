'use client'

import { FileDown, FolderOpen } from 'lucide-react'

type FileItem = { id?: string; fileName?: string; displayName?: string; url?: string; fileUrl?: string }

type Props = {
  title?: string
  subtitle?: string
  files: FileItem[]
  fileHref: (f: FileItem) => string
}

export function ModuleMaterialsPanel({
  title = 'Module materials',
  subtitle = 'Official files for this module (from curriculum or your tutor).',
  files,
  fileHref,
}: Props) {
  if (!files.length) return null

  return (
    <div className="card mb-20 learning-module-materials">
      <div className="flex-between mb-10" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FolderOpen size={20} strokeWidth={1.75} style={{ color: 'var(--gold2)' }} />
          <div>
            <div className="font-display fw-600 text-white" style={{ fontSize: 15 }}>{title}</div>
            <div className="text-muted text-xs">{subtitle}</div>
          </div>
        </div>
      </div>
      <div className="learning-file-chips">
        {files.map((f, i) => (
          <a key={f.id || i} href={fileHref(f)} target="_blank" rel="noreferrer" className="learning-file-chip">
            <FileDown size={14} strokeWidth={1.75} />
            <span>{f.fileName || f.displayName || `File ${i + 1}`}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
