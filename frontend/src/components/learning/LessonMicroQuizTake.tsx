'use client'

import { useState } from 'react'
import { curriculumApi } from '@/lib/api'
import { notify } from '@/lib/notify'

type Question = { questionText: string; options: string[]; correctIndex: number }

export function LessonMicroQuizTake({
  quizId,
  questions,
  attempted,
  score,
  onDone,
}: {
  quizId: string
  questions: Question[]
  attempted?: boolean
  score?: number | null
  onDone?: () => void
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<number | null>(attempted ? score ?? null : null)

  const submit = async () => {
    const ordered = questions.map((_, i) => answers[i] ?? -1)
    if (ordered.some((a) => a < 0)) {
      notify.warning('Answer all questions before submitting')
      return
    }
    setSubmitting(true)
    try {
      const res = await curriculumApi.submitLessonMicroQuiz(quizId, ordered)
      setResult(res?.score ?? null)
      notify.success(`Quiz submitted — ${res?.score ?? 0}%`)
      onDone?.()
    } catch (e: any) {
      notify.fromError(e)
    }
    setSubmitting(false)
  }

  if (result != null) {
    return (
      <div className="text-sm" style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
        Quick check completed — <strong style={{ color: '#4ADE80' }}>{Math.round(result)}%</strong>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
      {questions.map((q, qi) => (
        <div key={qi} style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border2)' }}>
          <div className="text-sm text-white mb-8" style={{ fontWeight: 600 }}>
            {qi + 1}. {q.questionText}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {q.options.map((opt, oi) => (
              <label key={oi} className="text-sm text-muted" style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name={`lq-${quizId}-${qi}`}
                  checked={answers[qi] === oi}
                  onChange={() => setAnswers((prev) => ({ ...prev, [qi]: oi }))}
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={submitting} style={{ alignSelf: 'flex-start' }}>
        {submitting ? 'Submitting…' : 'Submit quick check'}
      </button>
    </div>
  )
}
