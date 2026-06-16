'use client'

import { useCallback, useEffect, useState } from 'react'
import { curriculumApi } from '@/lib/api'
import { notify } from '@/lib/notify'
import { LessonMicroQuizEditor } from './LessonMicroQuizEditor'
import {
  QuizDraftQuestion,
  draftsFromSource,
  draftsToPayload,
  validateDrafts,
} from './lesson-quiz-editor.utils'

type Row = {
  lesson: { id: string; position: number; title: string; objective?: string | null; quickCheckQuestions?: unknown }
  microQuiz: any
  lessonAssignment: any
}

type QuizEditorState = {
  lessonId: string
  lessonTitle: string
  curriculumQuickCheck?: unknown
  questions: QuizDraftQuestion[]
}

export function TutorLessonActivitiesPanel({
  moduleId,
  schoolId,
  className,
  moduleLabel,
}: {
  moduleId: string
  schoolId: string
  className: string
  moduleLabel?: string
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [savingLessonId, setSavingLessonId] = useState<string | null>(null)
  const [quizEditor, setQuizEditor] = useState<QuizEditorState | null>(null)

  const load = useCallback(async () => {
    if (!moduleId || !schoolId || !className) {
      setRows([])
      return
    }
    setLoading(true)
    try {
      const data = await curriculumApi.lessonActivities(moduleId, schoolId, className)
      setRows(Array.isArray(data) ? data : [])
    } catch {
      setRows([])
    }
    setLoading(false)
  }, [moduleId, schoolId, className])

  useEffect(() => {
    load()
  }, [load])

  const openQuizEditor = (row: Row) => {
    setQuizEditor({
      lessonId: row.lesson.id,
      lessonTitle: row.lesson.title,
      curriculumQuickCheck: row.lesson.quickCheckQuestions,
      questions: draftsFromSource(row.microQuiz?.questions, row.lesson.quickCheckQuestions),
    })
  }

  const saveQuiz = async () => {
    if (!quizEditor) return
    const err = validateDrafts(quizEditor.questions)
    if (err) {
      notify.warning(err)
      return
    }
    setSavingLessonId(quizEditor.lessonId)
    try {
      await curriculumApi.upsertLessonMicroQuiz(quizEditor.lessonId, {
        schoolId,
        className,
        moduleId,
        isEnabled: true,
        questions: draftsToPayload(quizEditor.questions),
      })
      notify.success('Quick check saved and enabled')
      setQuizEditor(null)
      await load()
    } catch (e: any) {
      notify.fromError(e)
    }
    setSavingLessonId(null)
  }

  const disableQuiz = async (quizId: string, lessonId: string) => {
    setSavingLessonId(quizId)
    try {
      await curriculumApi.disableLessonMicroQuiz(quizId)
      notify.success('Micro-quiz disabled')
      if (quizEditor?.lessonId === lessonId) setQuizEditor(null)
      await load()
    } catch (e: any) {
      notify.fromError(e)
    }
    setSavingLessonId(null)
  }

  const toggleAssignment = async (lessonId: string, enabled: boolean) => {
    setSavingLessonId(lessonId)
    try {
      await curriculumApi.upsertLessonAssignment(lessonId, {
        schoolId,
        className,
        moduleId,
        enabled,
        isOptional: true,
        maxScore: 10,
      })
      notify.success(enabled ? 'Lesson practice enabled' : 'Lesson practice removed')
      await load()
    } catch (e: any) {
      notify.fromError(e)
    }
    setSavingLessonId(null)
  }

  if (!moduleId) return null

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="font-display fw-700 text-white mb-8" style={{ fontSize: 16 }}>
        Lesson activities {moduleLabel ? `— ${moduleLabel}` : ''}
      </div>
      <p className="text-muted text-xs mb-16" style={{ lineHeight: 1.55, maxWidth: 720 }}>
        Optional per-lesson quick checks and practice tasks. These are <strong className="text-white">formative</strong> — they do not gate module advance (CBT + practical still decide that).
      </p>
      {loading ? (
        <p className="text-muted text-sm">Loading lessons…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted text-sm">No published lessons in this module yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Lesson</th>
              <th>Micro-quiz</th>
              <th>Practice assignment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.lesson.id}>
                <td>
                  <div className="text-sm text-white">Lesson {row.lesson.position}: {row.lesson.title}</div>
                </td>
                <td>
                  {row.microQuiz?.isEnabled ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="badge badge-success text-xs">On · {row.microQuiz.questionCount} Q</span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={savingLessonId === row.lesson.id}
                        onClick={() => openQuizEditor(row)}
                      >
                        Edit quiz
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={savingLessonId === row.microQuiz.id}
                        onClick={() => disableQuiz(row.microQuiz.id, row.lesson.id)}
                      >
                        Disable
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={savingLessonId === row.lesson.id}
                      onClick={() => openQuizEditor(row)}
                    >
                      Set up quiz
                    </button>
                  )}
                </td>
                <td>
                  {row.lessonAssignment?.isPublished !== false && row.lessonAssignment ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="badge badge-info text-xs">On · {row.lessonAssignment.maxScore} marks</span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={savingLessonId === row.lesson.id}
                        onClick={() => toggleAssignment(row.lesson.id, false)}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={savingLessonId === row.lesson.id}
                      onClick={() => toggleAssignment(row.lesson.id, true)}
                    >
                      Add practice
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {quizEditor && (
        <LessonMicroQuizEditor
          lessonTitle={quizEditor.lessonTitle}
          questions={quizEditor.questions}
          curriculumQuickCheck={quizEditor.curriculumQuickCheck}
          saving={savingLessonId === quizEditor.lessonId}
          onChange={(questions) => setQuizEditor((prev) => (prev ? { ...prev, questions } : prev))}
          onCancel={() => setQuizEditor(null)}
          onSave={saveQuiz}
        />
      )}
    </div>
  )
}
