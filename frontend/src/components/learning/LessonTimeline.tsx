'use client'

import { CheckCircle2, Circle } from 'lucide-react'
import { FileDown } from 'lucide-react'

type LessonItem = {
  id: string
  position: number
  title: string
  objective?: string | null
  completed?: boolean
  files?: { id?: string; fileName?: string; displayName?: string; url?: string; fileUrl?: string }[]
}

type Props = {
  lessons: LessonItem[]
  activeLessonId?: string | null
  fileHref: (f: { url?: string; fileUrl?: string }) => string
}

export function LessonTimeline({ lessons, activeLessonId, fileHref }: Props) {
  return (
    <div className="learning-timeline">
      {lessons.map((L, idx) => {
        const isActive = activeLessonId === L.id
        const isLast = idx === lessons.length - 1
        return (
          <div
            key={L.id}
            className={`learning-timeline-item${L.completed ? ' learning-timeline-item--done' : ''}${isActive ? ' learning-glow' : ''}`}
          >
            <div className="learning-timeline-rail">
              <div className={`learning-timeline-node${L.completed ? ' learning-timeline-node--done' : ''}${isActive ? ' learning-timeline-node--active' : ''}`}>
                {L.completed ? (
                  <CheckCircle2 size={18} strokeWidth={2} className="learning-timeline-icon-done" />
                ) : (
                  <Circle size={18} strokeWidth={1.75} className="learning-timeline-icon-pending" />
                )}
              </div>
              {!isLast && <div className="learning-timeline-line" aria-hidden="true" />}
            </div>
            <div className="learning-timeline-content">
              <div className="learning-timeline-title">
                Lesson {L.position}: {L.title}
              </div>
              {L.objective && <p className="learning-timeline-objective">{L.objective}</p>}
              {Array.isArray(L.files) && L.files.length > 0 && (
                <div className="learning-file-chips">
                  {L.files.slice(0, 4).map((f, i) => (
                    <a
                      key={f.id || i}
                      href={fileHref(f)}
                      target="_blank"
                      rel="noreferrer"
                      className="learning-file-chip"
                    >
                      <FileDown size={13} strokeWidth={1.75} />
                      <span>{f.fileName || f.displayName || 'File'}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
