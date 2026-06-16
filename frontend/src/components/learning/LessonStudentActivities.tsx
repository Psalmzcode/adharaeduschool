'use client'

import { useState } from 'react'
import { assignmentsApi, uploadsApi } from '@/lib/api'
import { notify } from '@/lib/notify'
import { LessonMicroQuizTake } from './LessonMicroQuizTake'

export function LessonStudentActivities({
  lesson,
  onRefresh,
}: {
  lesson: any
  onRefresh?: () => void
}) {
  const activities = lesson?.activities
  const quiz = activities?.microQuiz
  const asg = activities?.lessonAssignment
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!quiz && !asg) return null

  const submitAssignment = async () => {
    if (!asg?.id) return
    if (!file && !note.trim()) {
      notify.warning('Add text or upload a file')
      return
    }
    setSubmitting(true)
    try {
      let fileUrl: string | undefined
      if (file) {
        const up = await uploadsApi.assignment(file, asg.id)
        fileUrl = up?.fileUrl
      }
      await assignmentsApi.submit(asg.id, { textBody: note.trim() || undefined, fileUrl })
      notify.success('Lesson practice submitted')
      onRefresh?.()
    } catch (e: any) {
      notify.fromError(e)
    }
    setSubmitting(false)
  }

  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {quiz && (
        <div>
          <div className="text-xs text-muted mb-4">Quick check ({quiz.questionCount} questions)</div>
          <LessonMicroQuizTake
            quizId={quiz.id}
            questions={Array.isArray(quiz.questions) ? quiz.questions : []}
            attempted={quiz.attempted}
            score={quiz.score}
            onDone={onRefresh}
          />
        </div>
      )}
      {asg && (
        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border2)' }}>
          <div className="text-sm text-white mb-4" style={{ fontWeight: 600 }}>
            {asg.title}
            {asg.isOptional && <span className="text-muted"> · optional</span>}
          </div>
          {asg.submitted ? (
            <div className="text-xs text-muted">
              Submitted
              {asg.score != null ? ` — score ${asg.score}/${asg.maxScore}` : ' — awaiting grade'}
            </div>
          ) : (
            <>
              <textarea
                className="form-input text-sm mb-8"
                rows={3}
                placeholder="Your answer or reflection…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ width: '100%', resize: 'vertical' }}
              />
              <input type="file" className="text-xs text-muted mb-8" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={submitAssignment} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit practice'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
