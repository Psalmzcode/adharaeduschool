'use client'

import { FileDown, BookMarked } from 'lucide-react'

type Bundle = {
  id: string
  title: string
  curriculumLesson?: { title?: string; position?: number } | null
  files?: { id?: string; fileName?: string; displayName?: string; url?: string; fileUrl?: string }[]
  hasPublishedHandout?: boolean
}

type Props = {
  bundles: Bundle[]
  fileHref: (f: { url?: string; fileUrl?: string }) => string
}

export function TutorLessonMaterials({ bundles, fileHref }: Props) {
  const withFiles = bundles.filter((b) => Array.isArray(b.files) && b.files.length > 0)
  if (!withFiles.length) return null

  return (
    <div className="card mb-20">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <BookMarked size={20} strokeWidth={1.75} style={{ color: 'var(--teal2)' }} />
        <div>
          <div className="font-display fw-600 text-white" style={{ fontSize: 15 }}>Tutor lesson files</div>
          <div className="text-muted text-xs">PDFs and attachments from your tutor&apos;s lesson plans</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {withFiles.map((b) => (
          <div key={b.id} className="learning-lesson-card" style={{ borderColor: 'var(--border2)' }}>
            <div className="learning-lesson-card-title">{b.title}</div>
            {b.curriculumLesson?.title && (
              <div className="text-muted text-xs" style={{ marginTop: 4 }}>
                Linked: Lesson {b.curriculumLesson.position}: {b.curriculumLesson.title}
              </div>
            )}
            <div className="learning-file-chips">
              {(b.files || []).map((f, i) => (
                <a key={f.id || i} href={fileHref(f)} target="_blank" rel="noreferrer" className="learning-file-chip">
                  <FileDown size={14} strokeWidth={1.75} />
                  <span>{f.fileName || f.displayName || `Attachment ${i + 1}`}</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
