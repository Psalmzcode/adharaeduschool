'use client'

import {
  QuizDraftQuestion,
  defaultQuestionSet,
  draftsFromSource,
  emptyQuestion,
  validateDrafts,
} from './lesson-quiz-editor.utils'

type Props = {
  lessonTitle: string
  questions: QuizDraftQuestion[]
  curriculumQuickCheck?: unknown
  saving?: boolean
  onChange: (questions: QuizDraftQuestion[]) => void
  onCancel: () => void
  onSave: () => void
}

export function LessonMicroQuizEditor({
  lessonTitle,
  questions,
  curriculumQuickCheck,
  saving,
  onChange,
  onCancel,
  onSave,
}: Props) {
  const updateQuestion = (idx: number, patch: Partial<QuizDraftQuestion>) => {
    onChange(questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)))
  }

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    onChange(
      questions.map((q, i) => {
        if (i !== qIdx) return q
        const options = [...q.options]
        options[oIdx] = value
        return { ...q, options }
      }),
    )
  }

  const removeQuestion = (idx: number) => {
    if (questions.length <= 1) return
    onChange(questions.filter((_, i) => i !== idx))
  }

  const importCurriculum = () => {
    const imported = draftsFromSource([], curriculumQuickCheck)
    if (imported.length && imported.some((q) => q.questionText.trim())) {
      onChange(imported)
    }
  }

  const hasCurriculum =
    Array.isArray(curriculumQuickCheck) && (curriculumQuickCheck as unknown[]).length > 0

  return (
    <div
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 10,
        border: '1px solid var(--border2)',
        background: 'rgba(255,255,255,0.03)',
      }}
    >
      <div className="flex-between mb-12" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="font-display fw-700 text-white" style={{ fontSize: 15 }}>
            Quick check — {lessonTitle}
          </div>
          <p className="text-muted text-xs mt-4" style={{ maxWidth: 560, lineHeight: 1.5 }}>
            1–10 multiple-choice questions. Students get one attempt; scored automatically.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {hasCurriculum && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={importCurriculum} disabled={saving}>
              Import curriculum prompts
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onChange([...questions, emptyQuestion()])}
            disabled={saving || questions.length >= 10}
          >
            + Add question
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {questions.map((q, qi) => (
          <div
            key={q.id}
            style={{
              padding: 14,
              borderRadius: 8,
              border: '1px solid var(--border2)',
              background: 'rgba(0,0,0,0.15)',
            }}
          >
            <div className="flex-between mb-8" style={{ gap: 8 }}>
              <span className="text-xs text-muted" style={{ fontWeight: 600 }}>
                Question {qi + 1}
              </span>
              {questions.length > 1 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '2px 8px', fontSize: 11 }}
                  onClick={() => removeQuestion(qi)}
                  disabled={saving}
                >
                  Remove
                </button>
              )}
            </div>
            <input
              className="form-input text-sm mb-10"
              placeholder="Question text"
              value={q.questionText}
              onChange={(e) => updateQuestion(qi, { questionText: e.target.value })}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {q.options.map((opt, oi) => (
                <label
                  key={oi}
                  className="text-sm"
                  style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}
                >
                  <input
                    type="radio"
                    name={`correct-${q.id}`}
                    checked={q.correctIndex === oi}
                    onChange={() => updateQuestion(qi, { correctIndex: oi })}
                  />
                  <input
                    className="form-input text-sm"
                    placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                    value={opt}
                    onChange={(e) => updateOption(qi, oi, e.target.value)}
                    style={{ flex: 1 }}
                  />
                </label>
              ))}
            </div>
            <p className="text-xs text-muted mt-6">Select the radio for the correct answer.</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save & enable quiz'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => onChange(defaultQuestionSet(3))}
          disabled={saving}
        >
          Reset to 3 blanks
        </button>
      </div>
    </div>
  )
}
