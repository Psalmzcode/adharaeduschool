'use client'
import { useState, useEffect, useRef } from 'react'
import { cbtApi } from '@/lib/api'
import { notify } from '@/lib/notify'

type Page = 'login' | 'exam' | 'results'

interface Question { id: string; number: number; questionText: string; options: string[] }

export default function CBTPage() {
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
  const timerRef = useRef<any>(null)

  // Build answer map: questionNumber -> selectedIndex
  const answerMap: Record<string, number> = {}
  Object.entries(answers).forEach(([idx, sel]) => {
    const q = questions[+idx]
    if (q) answerMap[String(q.number)] = sel
  })

  const startExam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!regNumber.trim() || !accessCode.trim()) { setLoginError('Please enter both fields'); return }
    setLoginLoading(true); setLoginError('')
    try {
      // Fetch available published exams first
      let examId = ''
      try {
        const exams = await cbtApi.all({ isPublished: 'true' })
        const examArr = Array.isArray(exams) ? exams : []
        if (examArr.length > 0) examId = examArr[0].id
      } catch {}

      let data: any
      if (examId) {
        data = await cbtApi.login(regNumber, accessCode, examId)
      } else {
        // No live exam — use demo mode with built-in questions
        data = { student: { name: regNumber, regNumber }, exam: { title: 'Demo CBT Exam', durationMins: 30, questions: DEMO_QUESTIONS }, attempt: { id: 'demo-' + Date.now() } }
      }

      setExamData(data)
      setAttemptId(data.attempt?.id || '')
      const qs: Question[] = data.exam?.questions || DEMO_QUESTIONS
      setQuestions(qs)
      setTimeLeft((data.exam?.durationMins || 30) * 60)
      setPage('exam')
      timerRef.current = setInterval(() => setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); handleSubmit(true); return 0 }
        return t - 1
      }), 1000)
    } catch (err: any) {
      setLoginError(err.message || 'Invalid credentials. Try any non-empty values for demo.')
    }
    setLoginLoading(false)
  }

  const selectAnswer = (optIdx: number) => {
    setAnswers(a => ({ ...a, [current]: optIdx }))
    // Auto-save to backend
    if (attemptId && !attemptId.startsWith('demo-')) {
      const q = questions[current]
      if (q) cbtApi.saveAnswer(attemptId, q.number, optIdx).catch(() => {})
    }
  }

  const handleSubmit = async (autoSubmit = false) => {
    if (!autoSubmit) {
      const unanswered = questions.length - Object.keys(answers).length
      if (unanswered > 0 && !confirm(`You have ${unanswered} unanswered question(s). Submit anyway?`)) return
    }
    clearInterval(timerRef.current)
    setSubmitting(true)
    try {
      let res: any
      if (attemptId && !attemptId.startsWith('demo-')) {
        res = await cbtApi.submit(attemptId, answerMap)
      } else {
        // Demo grading
        let correct = 0
        DEMO_QUESTIONS.forEach((q: any, i: number) => { if (answers[i] === q.correct) correct++ })
        const pct = Math.round(correct / DEMO_QUESTIONS.length * 100)
        res = { score: pct, totalCorrect: correct, totalQuestions: DEMO_QUESTIONS.length, breakdown: DEMO_QUESTIONS.map((q: any, i: number) => ({ questionNumber: q.number, selected: answers[i] ?? null, correct: q.correct, isCorrect: answers[i] === q.correct, explanation: q.explanation })) }
      }
      setResult(res)
      setPage('results')
    } catch (e: any) { notify.fromError(e, 'Submission failed') }
    setSubmitting(false)
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
        <p className="cbt-login-sub">Enter your student credentials to begin</p>
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
            <input id="cbt-code" type="password" className="cbt-login-field" placeholder="Last digits of your reg number" value={accessCode} onChange={e => { setAccessCode(e.target.value); setLoginError('') }} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loginLoading}>{loginLoading ? 'Verifying…' : 'Begin Examination →'}</button>
        </form>
        <p className="cbt-login-demo">Demo: Enter any reg number + last digits as code</p>
        <div style={{ textAlign: 'center' }}>
          <a href="/" className="cbt-login-back">← Back to Website</a>
        </div>
      </div>
    </div>
  )

  // ── RESULTS ── (CBT tokens — see globals.css)
  if (page === 'results') {
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
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
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

// Demo questions used when no live exam is available
const DEMO_QUESTIONS: Question[] = [
  { id: 'd1', number: 1, questionText: 'What is the primary purpose of a database in a web application?', options: ['To store and manage structured data persistently', 'To design the visual layout of a website', 'To connect users to the internet', 'To handle printing tasks'] },
  { id: 'd2', number: 2, questionText: 'Which of the following is NOT a valid Python data type?', options: ['Integer', 'String', 'Character', 'Boolean'] },
  { id: 'd3', number: 3, questionText: 'In HTML, which tag is used to create a hyperlink?', options: ['<link>', '<a>', '<href>', '<url>'] },
  { id: 'd4', number: 4, questionText: 'What does CSS stand for?', options: ['Computer Style Sheets', 'Creative Style System', 'Cascading Style Sheets', 'Coded Stylesheet Syntax'] },
  { id: 'd5', number: 5, questionText: 'Which is a popular freelancing platform for tech workers?', options: ['LinkedIn Jobs', 'Fiverr', 'Indeed', 'Glassdoor'] },
  { id: 'd6', number: 6, questionText: 'What is a "function" in programming?', options: ['A type of variable', 'A reusable block of code that performs a task', 'A programming error', 'A hardware component'] },
  { id: 'd7', number: 7, questionText: 'Which correctly defines a list in Python?', options: ['list = (1, 2, 3)', 'list = {1, 2, 3}', 'list = [1, 2, 3]', 'list = <1, 2, 3>'] },
  { id: 'd8', number: 8, questionText: 'What does HTML stand for?', options: ['HyperText Markup Language', 'High Text Manipulation Language', 'HyperText Management Language', 'Hierarchical Text Markup Language'] },
  { id: 'd9', number: 9, questionText: 'Which CSS property controls text color?', options: ['font-color', 'text-style', 'color', 'foreground'] },
  { id: 'd10', number: 10, questionText: 'What symbol starts a comment in Python?', options: ['//', '/*', '#', '--'] },
]
// Add correct answers for demo grading (not sent to students)
;(DEMO_QUESTIONS as any).forEach((q: any, i: number) => { q.correct = [0,2,1,2,1,1,2,0,2,2][i] })
