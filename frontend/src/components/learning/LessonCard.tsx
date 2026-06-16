'use client'

import { FileDown } from 'lucide-react'

type FileItem = { id?: string; fileName?: string; displayName?: string; url?: string; fileUrl?: string }

type Props = {
  label: string
  title: string
  subtitle?: string
  variant?: 'delivered' | 'next'
  files?: FileItem[]
  fileHref: (f: FileItem) => string
}

export function LessonCard({ label, title, subtitle, variant = 'delivered', files = [], fileHref }: Props) {
  return (
    <div className={`learning-lesson-card learning-lesson-card--${variant}`}>
      <div className="learning-lesson-card-label">{label}</div>
      <div className="learning-lesson-card-title">{title}</div>
      {subtitle && <p className="learning-lesson-card-sub">{subtitle}</p>}
      {files.length > 0 && (
        <div className="learning-file-chips">
          {files.map((f, i) => (
            <a
              key={f.id || i}
              href={fileHref(f)}
              target="_blank"
              rel="noreferrer"
              className="learning-file-chip"
            >
              <FileDown size={14} strokeWidth={1.75} />
              <span>{f.fileName || f.displayName || `File ${i + 1}`}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
