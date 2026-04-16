'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { authApi, tutorsApi } from '@/lib/api'
import { notify } from '@/lib/notify'

type Phase = 'email' | 'code'

export default function LoginOtpPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('email')
  const [email, setEmail] = useState('')
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [countdownSecs, setCountdownSecs] = useState(59)
  const [resendLocked, setResendLocked] = useState(true)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('email') : null
    if (q) setEmail(q)
  }, [])

  useEffect(() => {
    if (phase !== 'code' || !resendLocked) return
    if (countdownSecs <= 0) {
      setResendLocked(false)
      return
    }
    const t = window.setTimeout(() => setCountdownSecs((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [countdownSecs, resendLocked, phase])

  const focusAt = (i: number) => {
    inputsRef.current[i]?.focus()
  }

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setError('')
    setInfo('')
    const addr = email.trim()
    if (!addr || !addr.includes('@')) {
      setError('Enter a valid email address.')
      notify.error('Enter a valid email address')
      return
    }
    setSending(true)
    try {
      await authApi.requestOtp(addr)
      setInfo('If an account exists for this address, we sent a 6-digit code. Check your inbox.')
      notify.success('Verification code sent (if account exists)')
      setPhase('code')
      setDigits(['', '', '', '', '', ''])
      setCountdownSecs(59)
      setResendLocked(true)
      window.setTimeout(() => focusAt(0), 0)
    } catch (err: unknown) {
      notify.fromError(err, 'Could not send code')
      setError(err instanceof Error ? err.message : 'Could not send code.')
    }
    setSending(false)
  }

  const onDigitChange = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(-1)
    setDigits((prev) => {
      const next = [...prev]
      next[i] = v
      return next
    })
    if (v && i < 5) window.setTimeout(() => focusAt(i + 1), 0)
  }

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[i] && i > 0) {
        setDigits((prev) => {
          const next = [...prev]
          next[i - 1] = ''
          return next
        })
        focusAt(i - 1)
      } else {
        setDigits((prev) => {
          const next = [...prev]
          next[i] = ''
          return next
        })
      }
      e.preventDefault()
    }
    if (e.key === 'ArrowLeft' && i > 0) focusAt(i - 1)
    if (e.key === 'ArrowRight' && i < 5) focusAt(i + 1)
  }

  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const next = ['', '', '', '', '', '']
    text.split('').forEach((ch, idx) => {
      next[idx] = ch
    })
    setDigits(next)
    window.setTimeout(() => focusAt(Math.min(Math.max(text.length - 1, 0), 5)), 0)
  }

  const allFilled = digits.every((d) => d.length === 1)

  const completeSignIn = useCallback(
    async (tokenPayload: { token: string; user: { role?: string } }) => {
      localStorage.setItem('adhara_token', tokenPayload.token)
      const dest: Record<string, string> = {
        SUPER_ADMIN: '/dashboard/superadmin',
        SCHOOL_ADMIN: '/dashboard/admin',
        TUTOR: '/dashboard/tutor',
        STUDENT: '/dashboard/student',
        PARENT: '/dashboard/student',
      }
      const role = tokenPayload.user?.role
      if (role === 'TUTOR') {
        try {
          const profile = await tutorsApi.me()
          if (profile?.onboardingStatus === 'DRAFT') {
            router.push('/dashboard/tutor/onboarding')
            return
          }
        } catch {
          /* continue */
        }
      }
      router.push(dest[role || ''] || '/dashboard/admin')
    },
    [router],
  )

  const verify = useCallback(async () => {
    const code = digits.join('')
    if (code.length !== 6) return
    setError('')
    setVerifying(true)
    try {
      const data = await authApi.verifyOtp(email.trim(), code)
      notify.success('Signed in successfully')
      await completeSignIn(data)
    } catch (err: unknown) {
      notify.fromError(err, 'Invalid or expired code')
      setError(err instanceof Error ? err.message : 'Invalid or expired code.')
    }
    setVerifying(false)
  }, [digits, email, completeSignIn])

  async function resend() {
    setDigits(['', '', '', '', '', ''])
    setCountdownSecs(59)
    setResendLocked(true)
    setError('')
    await sendCode()
    focusAt(0)
  }

  return (
    <div id="page-login-otp" className="auth-page active">
      <div className="auth-right" style={{ width: '100%', minHeight: '100vh', justifyContent: 'center', padding: '48px 24px' }}>
        <div className="auth-form-box" style={{ maxWidth: 460, width: '100%' }}>
          <Link
            href="/auth/login"
            className="auth-link"
            style={{ display: 'inline-block', marginBottom: 20, fontSize: 14 }}
          >
            ← Sign in with password
          </Link>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>Email code sign-in</h2>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 24 }}>
            We’ll email a one-time code to your registered address. Accounts without an email on file must use password
            sign-in.
          </p>

          {error && (
            <div
              style={{
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8,
                padding: '12px 16px',
                marginBottom: 16,
                fontSize: 14,
                color: '#F87171',
              }}
            >
              {error}
            </div>
          )}
          {info && phase === 'code' && (
            <div
              style={{
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.25)',
                borderRadius: 8,
                padding: '12px 16px',
                marginBottom: 16,
                fontSize: 13,
                color: 'var(--muted)',
              }}
            >
              {info}
            </div>
          )}

          {phase === 'email' ? (
            <form onSubmit={sendCode} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="form-group form-input-icon">
                <label>Email</label>
                <span className="icon">✉️</span>
                <input
                  type="email"
                  className="form-input"
                  required
                  autoComplete="email"
                  placeholder="you@school.edu.ng"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={sending}>
                {sending ? 'Sending…' : 'Send verification code →'}
              </button>
            </form>
          ) : (
            <>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Code sent to</p>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  color: 'var(--gold)',
                  marginBottom: 20,
                  wordBreak: 'break-all',
                }}
              >
                {email.trim()}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ marginBottom: 20 }}
                onClick={() => {
                  setPhase('email')
                  setInfo('')
                  setError('')
                }}
              >
                Use a different email
              </button>

              <div className="otp-inputs" style={{ marginBottom: 24 }}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputsRef.current[i] = el
                    }}
                    className={`otp-input${d ? ' filled' : ''}`}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={d}
                    onChange={(e) => onDigitChange(i, e)}
                    onKeyDown={(e) => onKeyDown(i, e)}
                    onPaste={onPaste}
                    aria-label={`Digit ${i + 1}`}
                  />
                ))}
              </div>

              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }}
                disabled={!allFilled || verifying}
                onClick={verify}
              >
                {verifying ? 'Verifying…' : 'Verify and sign in →'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Didn’t get it?</span>
                <button type="button" className="btn btn-ghost btn-sm" disabled={resendLocked} onClick={resend}>
                  Resend code
                </button>
                {resendLocked && (
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{`0:${String(countdownSecs).padStart(2, '0')}`}</span>
                )}
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 20, textAlign: 'center' }}>
                You can paste the 6-digit code into any box. Codes expire in <strong>10 minutes</strong>.
              </p>
            </>
          )}

          <p className="auth-footer-text" style={{ marginTop: 28 }}>
            <a className="auth-link" onClick={() => router.push('/')} style={{ cursor: 'pointer' }}>
              ← Back to website
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
