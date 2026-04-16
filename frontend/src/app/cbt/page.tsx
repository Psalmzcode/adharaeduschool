'use client'
import { Suspense, useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { cbtApi } from '@/lib/api'
import { notify } from '@/lib/notify'

type Page = 'login' | 'exam' | 'results'

interface Question { id: string; number: number; questionText: string; options: string[] }

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 1400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 640,
          maxHeight: '90vh',
          background: 'var(--navy2)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--white)' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 16, overflow: 'auto' }}>{children}</div>
      </div>
    </div>
  )
}

function ConfirmModal({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  message: React.ReactNode
  confirmText?: string
  cancelText?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div className="text-sm text-muted" style={{ lineHeight: 1.6 }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'} btn-sm`}
            onClick={onConfirm}
            disabled={busy}
            style={{ justifyContent: 'center', minWidth: 140 }}
          >
            {busy ? 'Please wait…' : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function CBTPageInner() {
  const searchParams = useSearchParams()
  const scheduleId = String(searchParams.get('scheduleId') || '').trim()
  const [page, setPage] = useState<Page>('login')
  const [regNumber, setRegNumber] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [examData, setExamData] = useState<any>(null)
  const [attemptId, setAttemptId] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [flags, setFlags] = useState<Record<number, boolean>>({})
  const [timeLeft, setTimeLeft] = useState(30 * 60)
  const [result, setResult] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [resultsRefreshing, setResultsRefreshing] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState<{ unanswered: number } | null>(null)
  const timerRef = useRef<any>(null)
  const autosaveWarnedRef = useRef(false)

  // Build answer map: questionNumber -> selectedIndex
  const answerMap: Record<string, number> = {}
  Object.entries(answers).forEach(([idx, sel]) => {
    const q = questions[+idx]
    if (q) answerMap[String(q.number)] = sel
  })

  const startExam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!regNumber.trim() || !accessCode.trim()) {
      setLoginError('Please enter both fields')
      notify.warning('Please enter both fields')
      return
    }
    setLoginLoading(true); setLoginError('')
    try {
      const data = scheduleId
        ? await cbtApi.loginSchedule(regNumber, accessCode, scheduleId)
        : await (async () => {
            // Fallback: old demo behavior (first published exam)
            let examId = ''
            try {
              const exams = await cbtApi.all({ isPublished: 'true' })
              const examArr = Array.isArray(exams) ? exams : []
              if (examArr.length > 0) examId = examArr[0].id
            } catch {}

            if (!examId) {
              throw new Error('No published exam is available right now. Please contact your tutor or try again later.')
            }
            return cbtApi.login(regNumber, accessCode, examId)
          })()

      setExamData(data)
      setAttemptId(data.attempt?.id || '')
      const qs: Question[] = data.exam?.questions || []
      if (!Array.isArray(qs) || qs.length === 0) {
        throw new Error('Exam has no questions yet. Please contact your tutor.')
      }
      setQuestions(qs)
      setTimeLeft((data.exam?.durationMins || 30) * 60)
      setPage('exam')
      notify.success('Exam started')
      timerRef.current = setInterval(() => setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); handleSubmit(true); return 0 }
        return t - 1
      }), 1000)
    } catch (err: any) {
      notify.fromError(err, 'Could not start exam')
      setLoginError(err?.message || 'Invalid credentials. Try any non-empty values for demo.')
    }
    setLoginLoading(false)
  }

  const selectAnswer = (optIdx: number) => {
    setAnswers(a => ({ ...a, [current]: optIdx }))
    // Auto-save to backend
    if (attemptId) {
      const q = questions[current]
      if (q) {
        cbtApi
          .saveAnswer(attemptId, q.number, optIdx)
          .then(() => {
            autosaveWarnedRef.current = false
          })
          .catch(() => {
            if (!autosaveWarnedRef.current) {
              autosaveWarnedRef.current = true
              notify.warning('Autosave failed — your answers are still on this device. Keep going and submit at the end.')
            }
          })
      }
    }
  }

  const handleSubmit = async (autoSubmit = false) => {
    if (!autoSubmit) {
      const unanswered = questions.length - Object.keys(answers).length
      if (unanswered > 0) {
        setConfirmSubmit({ unanswered })
        return
      }
    }
    clearInterval(timerRef.current)
    setSubmitting(true)
    try {
      const res = await cbtApi.submit(attemptId, answerMap)
      setResult(res)
      setPage('results')
    } catch (e: any) { notify.fromError(e, 'Submission failed') }
    setSubmitting(false)
  }

  const refreshReleasedResult = async () => {
    if (!attemptId) return
    setResultsRefreshing(true)
    try {
      const r = await cbtApi.result(attemptId)
      if (r?.resultsPending) {
        notify.warning('Results are not released yet. Try again after your tutor notifies you.')
        setResult(r)
      } else {
        setResult(r)
        notify.success('Results are now available.')
      }
    } catch (e: any) {
      notify.fromError(e, 'Could not load results')
    }
    setResultsRefreshing(false)
  }

  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, '0')
  const seconds = String(timeLeft % 60).padStart(2, '0')
  const timerClass = timeLeft <= 300 ? 'danger' : timeLeft <= 600 ? 'warning' : 'safe'
  const answered = Object.keys(answers).length
  const q = questions[current]

  // ── LOGIN ── (uses globals.css CBT tokens — never var(--white)/var(--muted) here; they invert badly in light mode)
  if (page === 'login') return (
    <div
      id="page-cbt-login"
      style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}
    >
      <div className="cbt-login-bg-radial" aria-hidden />
      <div className="cbt-login-bg-grid" aria-hidden />
      <div className="cbt-login-card" style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 460 }}>
        <div className="cbt-login-icon-wrap">📝</div>
        <h2 className="cbt-login-title">CBT Examination Portal</h2>
        <p className="cbt-login-sub">
          {scheduleId
            ? 'Enter your registration number and exam access code (not your dashboard login password).'
            : 'Enter your student credentials to begin'}
        </p>
        <div className="cbt-login-banner">
          <div className="cbt-login-banner-title">AdharaEdu CBT Platform</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span className="cbt-login-banner-meta">📝 Live exam if available</span>
            <span className="cbt-login-banner-meta">⏱ Auto-graded</span>
            <span className="cbt-login-banner-meta">📍 Secure</span>
          </div>
        </div>
        {loginError && <div className="cbt-login-error">⚠️ {loginError}</div>}
        <form onSubmit={startExam} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
          <div>
            <label className="cbt-login-label" htmlFor="cbt-reg">Student Reg Number</label>
            <input id="cbt-reg" className="cbt-login-field" placeholder="e.g. CHR/2024/SS3A/021" value={regNumber} onChange={e => { setRegNumber(e.target.value); setLoginError('') }} />
          </div>
          <div>
            <label className="cbt-login-label" htmlFor="cbt-code">Access Code</label>
            <input
              id="cbt-code"
              type={scheduleId ? 'text' : 'password'}
              autoComplete="off"
              className="cbt-login-field"
              placeholder={scheduleId ? 'e.g. 051 (last segment of reg number)' : 'Last digits of your reg number'}
              value={accessCode}
              onChange={e => { setAccessCode(e.target.value); setLoginError('') }}
            />
            {scheduleId ? (
              <p className="cbt-login-demo" style={{ marginTop: 8, marginBottom: 0, textAlign: 'left' }}>
                For this scheduled exam, the code is usually the <strong>last part</strong> of your reg number (after the final <code>/</code>). If your tutor set a different code for this paper, use that instead.
              </p>
            ) : null}
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loginLoading}>{loginLoading ? 'Verifying…' : 'Begin Examination →'}</button>
        </form>
        <p className="cbt-login-demo">
          {scheduleId
            ? 'Reg number must match exactly. Access code is not your AdharaEdu login password.'
            : 'Use your real reg number and exam access code.'}
        </p>
        <div style={{ textAlign: 'center' }}>
          <a href="/" className="cbt-login-back">← Back to Website</a>
        </div>
      </div>
    </div>
  )

  // ── RESULTS ── (CBT tokens — see globals.css)
  if (page === 'results') {
    const resultsPending = result?.resultsPending === true
    if (resultsPending) {
      return (
        <div id="page-cbt-results" className="cbt-result-wrap">
          <div className="cbt-result-card cbt-result-card--hero">
            <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h2 className="cbt-result-msg">Exam submitted</h2>
              <p className="cbt-login-demo" style={{ marginBottom: 24, lineHeight: 1.6 }}>
                {result?.message ||
                  'Your answers are saved. Your tutor will release results when ready — then you can see your score here or under My Exams.'}
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', flexDirection: 'column', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ justifyContent: 'center', minWidth: 200 }}
                  disabled={resultsRefreshing || !attemptId}
                  onClick={() => void refreshReleasedResult()}
                >
                  {resultsRefreshing ? 'Checking…' : 'Refresh results'}
                </button>
                {scheduleId ? (
                  <a href="/dashboard/student?section=student-exams" className="btn btn-ghost">
                    Back to My Exams
                  </a>
                ) : null}
                <a href="/" className="btn btn-ghost">Back to Website</a>
              </div>
            </div>
          </div>
        </div>
      )
    }

    const scorePct = result?.score ?? 0
    const passed = scorePct >= 50
    const totalQ = result?.totalQuestions ?? questions.length
    const wrong = totalQ - (result?.totalCorrect || 0)
    return (
      <div id="page-cbt-results" className="cbt-result-wrap">
        <div className="cbt-result-card cbt-result-card--hero">
          <div className={`cbt-result-glow ${passed ? 'cbt-result-glow--pass' : 'cbt-result-glow--fail'}`} aria-hidden />
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ width: 140, height: 140, margin: '0 auto 28px', position: 'relative' }}>
              <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden>
                <circle className="cbt-result-ring-bg" cx="70" cy="70" r="56" fill="none" strokeWidth="8" />
                <circle
                  cx="70"
                  cy="70"
                  r="56"
                  fill="none"
                  stroke="url(#cbtResultRg)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 56}
                  strokeDashoffset={2 * Math.PI * 56 * (1 - scorePct / 100)}
                  transform="rotate(-90 70 70)"
                />
                <defs>
                  <linearGradient id="cbtResultRg" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#1E7FD4" />
                    <stop offset="100%" stopColor="#D4A853" />
                  </linearGradient>
                </defs>
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div className="cbt-result-ring-score">{scorePct}%</div>
                <div className="cbt-result-ring-sub">Score</div>
              </div>
            </div>
            <h2 className="cbt-result-msg">
              {scorePct >= 70 ? 'Excellent Work! 🎉' : scorePct >= 50 ? 'Good Effort! 👍' : 'Keep Studying! 💪'}
            </h2>
            <p className="cbt-result-count" style={{ marginBottom: 28 }}>
              You scored {result?.totalCorrect || 0}/{totalQ} —{' '}
              <strong className={passed ? 'cbt-pf-pass' : 'cbt-pf-fail'}>{passed ? 'PASS' : 'FAIL'}</strong>
            </p>
            <div className="cbt-result-stat-grid">
              <div className="cbt-stat-pill cbt-stat-pill--ok">
                <div className="cbt-stat-pill__val">{result?.totalCorrect ?? 0}</div>
                <div className="cbt-stat-pill__lbl">✅ Correct</div>
              </div>
              <div className="cbt-stat-pill cbt-stat-pill--bad">
                <div className="cbt-stat-pill__val">{wrong}</div>
                <div className="cbt-stat-pill__lbl">❌ Wrong</div>
              </div>
              <div className="cbt-stat-pill cbt-stat-pill--info">
                <div className="cbt-stat-pill__val">{totalQ}</div>
                <div className="cbt-stat-pill__lbl">⏱ Questions</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', flexDirection: 'column', alignItems: 'center' }}>
              {scheduleId ? (
                <>
                  <p className="cbt-login-demo" style={{ marginBottom: 4, textAlign: 'center', maxWidth: 420 }}>
                    This scheduled exam is submitted. Retakes are not allowed.
                  </p>
                  <a
                    href="/dashboard/student?section=student-exams"
                    className="btn btn-primary"
                    style={{ justifyContent: 'center' }}
                  >
                    Back to My Exams
                  </a>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setPage('login')
                    setAnswers({})
                    setFlags({})
                    setCurrent(0)
                    setTimeLeft(30 * 60)
                    setRegNumber('')
                    setAccessCode('')
                    setResult(null)
                  }}
                  className="btn btn-primary"
                >
                  Take Another Exam
                </button>
              )}
              <a href="/" className="btn btn-ghost">Back to Website</a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── EXAM ──
  return (
    <div id="page-cbt-exam" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ConfirmModal
        open={!!confirmSubmit}
        title="Submit exam?"
        message={confirmSubmit ? `You have ${confirmSubmit.unanswered} unanswered question(s). Submit anyway?` : ''}
        confirmText="Submit"
        cancelText="Go back"
        danger
        busy={submitting}
        onClose={() => setConfirmSubmit(null)}
        onConfirm={() => {
          setConfirmSubmit(null)
          handleSubmit(true)
        }}
      />
      <header id="cbt-topbar" className="cbt-topbar-inner">
        <div className="cbt-topbar-title cbt-topbar-title--exam">{examData?.exam?.title || 'CBT Examination'}</div>
        <div className={`cbt-exam-timer cbt-exam-timer--${timerClass}`}>
          ⏱ {minutes}:{seconds}
        </div>
        <button type="button" onClick={() => handleSubmit(false)} className="btn btn-primary btn-sm" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit Exam'}
        </button>
      </header>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <aside className="cbt-nav-sidebar cbt-nav-sidebar--left">
          <div className="cbt-nav-heading">Question Navigator</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 16 }}>
            {questions.map((_, i) => {
              const cls = ['cbt-qnum-btn']
              if (i === current) cls.push('is-current')
              else if (answers[i] !== undefined) cls.push('is-answered')
              else if (flags[i]) cls.push('is-flagged')
              return (
                <button key={i} type="button" className={cls.join(' ')} onClick={() => setCurrent(i)}>
                  {i + 1}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div className="cbt-legend-row">
              <span className="cbt-leg-answered">Answered</span>
              <strong className="cbt-leg-answered">{answered}</strong>
            </div>
            <div className="cbt-legend-row">
              <span className="cbt-leg-flagged">Flagged</span>
              <strong className="cbt-leg-flagged">{Object.values(flags).filter(Boolean).length}</strong>
            </div>
            <div className="cbt-legend-row">
              <span className="cbt-leg-empty">Not Answered</span>
              <strong className="cbt-leg-empty">{questions.length - answered}</strong>
            </div>
          </div>
        </aside>
        <div className="cbt-exam-main">
          {q && (
            <div className="cbt-q-box cbt-q-box--center">
              <div className="cbt-q-header-row">
                <div className="cbt-q-meta">
                  QUESTION {current + 1} OF {questions.length}
                </div>
                <button
                  type="button"
                  onClick={() => setFlags(f => ({ ...f, [current]: !f[current] }))}
                  className={`cbt-flag-btn ${flags[current] ? 'flagged' : ''}`}
                >
                  🚩 {flags[current] ? 'Flagged' : 'Flag'}
                </button>
              </div>
              <div className="cbt-q-progress-wrap">
                <div className="cbt-q-progress-fill" style={{ width: `${((current + 1) / questions.length) * 100}%` }} />
              </div>
              <div className="cbt-q-text" style={{ fontSize: 17, marginBottom: 28 }}>
                {q.questionText}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {q.options.map((opt: string, oi: number) => (
                  <div
                    key={oi}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        selectAnswer(oi)
                      }
                    }}
                    onClick={() => selectAnswer(oi)}
                    className={`cbt-opt ${answers[current] === oi ? 'sel' : ''}`}
                  >
                    <div className="cbt-opt-circle">{String.fromCharCode(65 + oi)}</div>
                    <div className="cbt-opt-txt">{opt}</div>
                  </div>
                ))}
              </div>
              <div className="cbt-exam-footer">
                <button type="button" className="cbt-nav-btn" onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}>
                  ← Previous
                </button>
                <span className="cbt-answered-count">
                  {answered} of {questions.length} answered
                </span>
                {current < questions.length - 1 ? (
                  <button type="button" className="cbt-nav-btn next" onClick={() => setCurrent(c => c + 1)}>
                    Next →
                  </button>
                ) : (
                  <button type="button" onClick={() => handleSubmit(false)} className="btn btn-primary btn-sm" disabled={submitting}>
                    {submitting ? 'Submitting…' : 'Submit Exam ✓'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CBTPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy)' }}>
          <p className="text-muted">Loading…</p>
        </div>
      }
    >
      <CBTPageInner />
    </Suspense>
  )
}
