'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { typingApi } from '@/lib/api'
import { notify } from '@/lib/notify'
import {
  FORMAL_TEST_DURATION_SEC,
  PROGRAMME_WPM_TARGET,
  computeTypingMetrics,
  formatCountdown,
} from './typing.utils'

type Drill = {
  key: string
  title: string
  description: string
  kind: 'practice' | 'formal_test'
  text: string
}

type Phase = 'idle' | 'running' | 'done'

type TypingFeedback = {
  headline: string
  paragraphs: string[]
  suggestion: string
  suggestedDrillKey: string | null
  source: 'ai' | 'rule'
}

export function TypingLab({ moduleId, moduleTitle }: { moduleId: string; moduleTitle?: string }) {
  const [drills, setDrills] = useState<Drill[]>([])
  const [formalDurationSec, setFormalDurationSec] = useState(FORMAL_TEST_DURATION_SEC)
  const [summary, setSummary] = useState<any>(null)
  const [feedback, setFeedback] = useState<TypingFeedback | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedKey, setSelectedKey] = useState<string>('home_row')
  const [phase, setPhase] = useState<Phase>('idle')
  const [typed, setTyped] = useState('')
  const [elapsedSec, setElapsedSec] = useState(0)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const startedAtRef = useRef<number | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const selected = drills.find((d) => d.key === selectedKey) ?? drills[0]
  const isFormal = selected?.kind === 'formal_test'
  const live =
    selected && typed.length > 0
      ? computeTypingMetrics(typed, selected.text, Math.max(1, elapsedSec), selected.kind)
      : null

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [catalog, sum, fb] = await Promise.all([
        typingApi.drills(),
        typingApi.mySummary(moduleId),
        typingApi.feedback(moduleId).catch(() => null),
      ])
      const list = Array.isArray(catalog?.drills) ? catalog.drills : []
      setDrills(list)
      setFormalDurationSec(catalog?.formalTestDurationSec ?? FORMAL_TEST_DURATION_SEC)
      setSummary(sum)
      setFeedback(fb)
      if (list.length) {
        setSelectedKey((prev) => (list.some((d: Drill) => d.key === prev) ? prev : list[0].key))
      }
    } catch (e: any) {
      notify.fromError(e, 'Could not load typing lab')
    }
    setLoading(false)
  }, [moduleId])

  useEffect(() => {
    load()
  }, [load])

  const clearTimer = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
  }

  useEffect(() => () => clearTimer(), [])

  const startSession = () => {
    setTyped('')
    setElapsedSec(0)
    setPhase('running')
    startedAtRef.current = Date.now()
    clearTimer()
    tickRef.current = setInterval(() => {
      const start = startedAtRef.current
      if (!start) return
      const sec = Math.floor((Date.now() - start) / 1000)
      setElapsedSec(sec)
    }, 250)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const finishSession = useCallback(async () => {
    if (!selected || phase !== 'running') return
    clearTimer()
    const start = startedAtRef.current ?? Date.now()
    const finalElapsed = Math.max(1, Math.floor((Date.now() - start) / 1000))
    setElapsedSec(finalElapsed)
    setPhase('done')

    if (isFormal && finalElapsed < formalDurationSec - 5) {
      notify.warning(`Keep typing until the full ${formalDurationSec / 60}-minute test ends`)
      setPhase('running')
      startedAtRef.current = start
      tickRef.current = setInterval(() => {
        const s = startedAtRef.current
        if (!s) return
        setElapsedSec(Math.floor((Date.now() - s) / 1000))
      }, 250)
      return
    }

    setSaving(true)
    try {
      await typingApi.saveAttempt({
        moduleId,
        drillKey: selected.key,
        typed,
        elapsedSec: finalElapsed,
      })
      notify.success(isFormal ? 'Official test saved' : 'Practice session saved')
      await load()
    } catch (e: any) {
      notify.fromError(e)
      setPhase('running')
      startedAtRef.current = start
      tickRef.current = setInterval(() => {
        const s = startedAtRef.current
        if (!s) return
        setElapsedSec(Math.floor((Date.now() - s) / 1000))
      }, 250)
    }
    setSaving(false)
  }, [selected, phase, typed, isFormal, formalDurationSec, moduleId, load])

  useEffect(() => {
    if (phase !== 'running' || !isFormal) return
    if (elapsedSec >= formalDurationSec) {
      finishSession()
    }
  }, [elapsedSec, phase, isFormal, formalDurationSec, finishSession])

  const reset = () => {
    clearTimer()
    startedAtRef.current = null
    setTyped('')
    setElapsedSec(0)
    setPhase('idle')
  }

  const onSelectDrill = (key: string) => {
    if (phase === 'running') return
    setSelectedKey(key)
    reset()
  }

  const renderSource = () => {
    if (!selected) return null
    const src = selected.text
    const srcLen = src.length
    const chars: JSX.Element[] = []
    const displayLen = isFormal ? Math.max(srcLen, typed.length + 40) : srcLen
    for (let i = 0; i < displayLen; i++) {
      const ch = src[i % srcLen] ?? ' '
      let color = 'var(--muted)'
      if (i < typed.length) {
        color = typed[i] === src[i % srcLen] ? 'var(--success)' : 'var(--danger)'
      } else if (i === typed.length) {
        color = 'var(--white)'
      }
      chars.push(
        <span key={i} style={{ color, background: i === typed.length ? 'rgba(212,168,83,0.25)' : undefined }}>
          {ch}
        </span>,
      )
    }
    return chars
  }

  const remainingFormal = Math.max(0, formalDurationSec - elapsedSec)

  if (loading && !drills.length) {
    return (
      <div className="card mb-20" style={{ padding: 16 }}>
        <div className="text-muted text-sm">Loading typing lab…</div>
      </div>
    )
  }

  return (
    <div className="card mb-20">
      <div className="flex-between mb-12" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="font-display fw-600 text-white" style={{ fontSize: 16 }}>Typing lab</div>
          <div className="text-xs text-muted mt-4">
            Keep practising touch typing on Track 1
            {moduleTitle ? (
              <> (first taught in <strong className="text-white">{moduleTitle}</strong>)</>
            ) : null}
            . Programme target: <strong className="text-white">{PROGRAMME_WPM_TARGET} WPM</strong> with ≥90% accuracy on the official test.
            <span className="text-muted"> · formative only — does not gate module advance</span>
          </div>
        </div>
        {summary?.bestFormal && (
          <div className="text-xs" style={{ textAlign: 'right' }}>
            <div className="text-muted">Best official test</div>
            <div className="text-white" style={{ fontWeight: 700 }}>
              {summary.bestFormal.wpm} WPM · {summary.bestFormal.accuracy}%
            </div>
          </div>
        )}
      </div>

      {feedback && (
        <div
          style={{
            marginBottom: 16,
            padding: '14px 16px',
            borderRadius: 10,
            border: '1px solid rgba(26,127,212,0.35)',
            background: 'linear-gradient(135deg, rgba(26,127,212,0.12) 0%, rgba(139,92,246,0.08) 100%)',
          }}
        >
          <div className="flex-between mb-8" style={{ alignItems: 'center', gap: 8 }}>
            <div className="text-xs fw-700" style={{ color: 'var(--teal2)', letterSpacing: '0.04em' }}>
              AI FEEDBACK
            </div>
            <span className="badge badge-info" style={{ fontSize: 10 }}>
              {feedback.source === 'ai' ? 'AI coach' : 'Coach tips'}
            </span>
          </div>
          <div className="font-display fw-700 text-white mb-8" style={{ fontSize: 15 }}>
            {feedback.headline}
          </div>
          {feedback.paragraphs.map((line, i) => (
            <p key={i} className="text-sm text-muted" style={{ margin: '0 0 8px', lineHeight: 1.55 }}>
              {line}
            </p>
          ))}
          <p className="text-sm" style={{ margin: 0, lineHeight: 1.55, color: 'var(--white)' }}>
            {feedback.suggestion}
          </p>
          {feedback.suggestedDrillKey && drills.some((d) => d.key === feedback.suggestedDrillKey) && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 10 }}
              disabled={phase === 'running'}
              onClick={() => onSelectDrill(feedback.suggestedDrillKey!)}
            >
              Practice {drills.find((d) => d.key === feedback.suggestedDrillKey)?.title || 'suggested drill'} →
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {drills.map((d) => (
          <button
            key={d.key}
            type="button"
            className={`btn btn-sm ${selectedKey === d.key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onSelectDrill(d.key)}
            disabled={phase === 'running'}
          >
            {d.title}
            {d.kind === 'formal_test' && ' · 3 min'}
          </button>
        ))}
      </div>

      {selected && (
        <>
          <p className="text-xs text-muted mb-12">{selected.description}</p>

          <div
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: 14,
              lineHeight: 1.7,
              padding: '12px 14px',
              borderRadius: 8,
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid var(--border2)',
              marginBottom: 12,
              minHeight: 72,
              userSelect: 'none',
            }}
          >
            {renderSource()}
          </div>

          <textarea
            ref={inputRef}
            className="form-input text-sm mb-12"
            rows={4}
            value={typed}
            disabled={phase !== 'running' || saving}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={phase === 'idle' ? 'Press Start, then type here…' : 'Type the passage above…'}
            style={{ width: '100%', fontFamily: 'ui-monospace, monospace', resize: 'vertical' }}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />

          <div className="flex-between" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div className="text-xs text-muted" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span>WPM: <strong className="text-white">{live?.wpm ?? '—'}</strong></span>
              <span>Accuracy: <strong className="text-white">{live ? `${live.accuracy}%` : '—'}</strong></span>
              {isFormal && phase === 'running' && (
                <span>Time left: <strong className="text-white">{formatCountdown(remainingFormal)}</strong></span>
              )}
              {!isFormal && phase === 'running' && (
                <span>Elapsed: <strong className="text-white">{formatCountdown(elapsedSec)}</strong></span>
              )}
              {summary?.practiceSessions != null && (
                <span>Practice sessions: <strong className="text-white">{summary.practiceSessions}</strong></span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {phase === 'idle' && (
                <button type="button" className="btn btn-primary btn-sm" onClick={startSession}>
                  {isFormal ? 'Start 3-minute test' : 'Start practice'}
                </button>
              )}
              {phase === 'running' && (
                <>
                  {!isFormal && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={finishSession} disabled={saving || !typed.trim()}>
                      {saving ? 'Saving…' : 'Save practice'}
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={reset} disabled={saving}>
                    Cancel
                  </button>
                </>
              )}
              {phase === 'done' && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
                  Try again
                </button>
              )}
            </div>
          </div>

          {isFormal && phase === 'idle' && (
            <div className="text-xs text-muted mt-12">
              Official scores need ≥150 correct characters and ≥90% accuracy. The timer runs for the full 3 minutes.
            </div>
          )}

          {Array.isArray(summary?.recent) && summary.recent.length > 0 && (
            <div style={{ marginTop: 16, borderTop: '1px solid var(--border2)', paddingTop: 12 }}>
              <div className="text-xs text-muted mb-8">Recent attempts</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {summary.recent.map((a: any) => (
                  <div key={a.id} className="text-xs text-muted">
                    {a.kind === 'formal_test' ? 'Official test' : a.drillKey} — {a.wpm} WPM, {a.accuracy}%
                    {a.kind === 'formal_test' && !a.isValidScore && (
                      <span style={{ color: 'var(--warning)' }}> · below valid threshold</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
