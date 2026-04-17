'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authApi } from '@/lib/api'
import { notify } from '@/lib/notify'

const REG_TOKEN_KEY = 'adhara_school_reg_token'

const STATES = ['Lagos','Abuja (FCT)','Rivers','Oyo','Kano','Enugu','Delta','Kaduna','Anambra','Osun','Ogun','Imo','Cross River','Benue','Plateau','Other']

type RegStep = 1 | 'otp' | 2

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<RegStep>(1)
  const [registrationToken, setRegistrationToken] = useState<string | null>(null)
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])
  const [countdownSecs, setCountdownSecs] = useState(59)
  const [resendLocked, setResendLocked] = useState(true)
  const [form, setForm] = useState({
    firstName:'', lastName:'', role:'Principal', email:'', phone:'', password:'', confirmPw:'',
    schoolName:'', address:'', state:'Lagos', lga:'', studentCount:'100 – 300'
  })
  const set = (k: string, v: string) => setForm(f=>({...f,[k]:v}))

  useEffect(() => {
    if (step !== 'otp' || !resendLocked) return
    if (countdownSecs <= 0) {
      setResendLocked(false)
      return
    }
    const t = window.setTimeout(() => setCountdownSecs((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [countdownSecs, resendLocked, step])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (step === 2 && !registrationToken) {
      const saved = sessionStorage.getItem(REG_TOKEN_KEY)
      if (saved) setRegistrationToken(saved)
    }
  }, [step, registrationToken])

  const focusAt = (i: number) => {
    inputsRef.current[i]?.focus()
  }

  const clearRegToken = () => {
    setRegistrationToken(null)
    sessionStorage.removeItem(REG_TOKEN_KEY)
  }

  const continueStep1 = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.firstName || !form.email || !form.password) {
      setError('Please fill all fields')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (form.password !== form.confirmPw) {
      setError('Passwords do not match')
      notify.error('Passwords do not match')
      return
    }
    setCheckingEmail(true)
    try {
      const r = await authApi.validateEmail(form.email.trim())
      if (!r?.ok) {
        const msg = r?.message || 'This email address cannot receive mail. Check spelling or use another email.'
        setError(msg)
        notify.error(msg)
        return
      }
      await authApi.requestOtp(form.email.trim(), 'SCHOOL_REGISTRATION')
      notify.success('We sent a 6-digit code to your email.')
      clearRegToken()
      setDigits(['', '', '', '', '', ''])
      setCountdownSecs(59)
      setResendLocked(true)
      setStep('otp')
      window.setTimeout(() => focusAt(0), 0)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not send verification code.'
      setError(msg)
      notify.fromError(err, msg)
    } finally {
      setCheckingEmail(false)
    }
  }

  const resendRegistrationOtp = async () => {
    setError('')
    setSendingOtp(true)
    try {
      await authApi.requestOtp(form.email.trim(), 'SCHOOL_REGISTRATION')
      notify.success('New code sent.')
      setDigits(['', '', '', '', '', ''])
      setCountdownSecs(59)
      setResendLocked(true)
      window.setTimeout(() => focusAt(0), 0)
    } catch (err: unknown) {
      notify.fromError(err, 'Could not resend code')
      setError(err instanceof Error ? err.message : 'Could not resend code.')
    } finally {
      setSendingOtp(false)
    }
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

  const verifyOtpAndContinue = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const code = digits.join('')
    if (code.length !== 6) {
      setError('Enter the 6-digit code from your email.')
      return
    }
    setVerifyingOtp(true)
    try {
      const r = await authApi.verifyRegistrationOtp(form.email.trim(), code)
      setRegistrationToken(r.registrationToken)
      sessionStorage.setItem(REG_TOKEN_KEY, r.registrationToken)
      setStep(2)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid code.'
      setError(msg)
      notify.fromError(err, msg)
    } finally {
      setVerifyingOtp(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirmPw) {
      notify.error('Passwords do not match')
      setError('Passwords do not match')
      return
    }
    const tok = registrationToken || (typeof window !== 'undefined' ? sessionStorage.getItem(REG_TOKEN_KEY) : null)
    if (!tok) {
      notify.error('Verify your email again to continue.')
      setError('Verify your email again — your verification may have expired.')
      setStep('otp')
      clearRegToken()
      return
    }
    setError(''); setLoading(true)
    try {
      const data = await authApi.register({
        firstName: form.firstName, lastName: form.lastName,
        email: form.email, password: form.password, phone: form.phone,
        role: 'SCHOOL_ADMIN', schoolName: form.schoolName,
        address: form.address, state: form.state, lga: form.lga,
        leadContactTitle: form.role.trim(),
        studentCountBand: form.studentCount.trim(),
        registrationToken: tok,
      })
      sessionStorage.removeItem(REG_TOKEN_KEY)
      if (data.school?.status === 'PENDING') {
        localStorage.removeItem('adhara_token')
        localStorage.removeItem('adhara_user')
        const q = new URLSearchParams({ name: data.school.name || '' })
        notify.success('Registration submitted — your school is pending approval.')
        router.push(`/auth/pending-approval?${q.toString()}`)
        return
      }
      if (data.token) localStorage.setItem('adhara_token', data.token)
      if (data.user) localStorage.setItem('adhara_user', JSON.stringify(data.user))
      notify.success('School account created — taking you to your dashboard.')
      router.push('/dashboard/admin')
    } catch (err: any) {
      notify.fromError(err, 'Registration failed. Please try again.')
      setError(err?.message || 'Registration failed. Please try again.')
    }
    setLoading(false)
  }

  const progressStep = step === 1 ? 1 : step === 'otp' ? 2 : 3

  return (
    <div id="page-register" className="auth-page active">
      <div className="auth-left">
        <div className="auth-left-bg"></div>
        <div className="auth-left-grid"></div>
        <div className="auth-left-content">
          <Link href="/" className="nav-logo" style={{marginBottom:48,display:'inline-flex',textDecoration:'none'}}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 50" height="40" width="200">
              <rect x="1" y="4" width="38" height="40" rx="12" ry="14" fill="#1E7FD4"/>
              <polygon points="20,10 23.5,18.5 33,18.5 25.5,24 28.5,33 20,27.5 11.5,33 14.5,24 7,18.5 16.5,18.5" fill="#F5C518"/>
              <text x="46" y="33" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="26" fill="var(--white)">Adhara</text>
              <text x="153" y="14" fontFamily="Arial,sans-serif" fontWeight="700" fontStyle="italic" fontSize="12" fill="#1E7FD4">Edu</text>
            </svg>
          </Link>
          <h2 style={{fontFamily:'var(--font-display)',fontSize:34,fontWeight:800,marginBottom:16,color:'var(--white)'}}>Partner with AdharaEdu</h2>
          <p style={{fontSize:16,color:'var(--muted)',marginBottom:40,lineHeight:1.8}}>Join 50+ Nigerian schools providing world-class tech education to their students.</p>
          <ul className="auth-feature-list">
            {[['✅','No long-term commitment','Start with a one-term pilot. No lock-in for first-time schools.'],
              ['📋','Full curriculum provided','We supply all lesson plans, materials, and assessments — ready to go.'],
              ['👩‍🏫','Expert tutor deployed','A verified, trained AdharaEdu tutor is assigned to your school.'],
              ['📊','Dashboard from Day 1','Your admin portal goes live the moment your first class starts.'],
              ['💰','Affordable pricing','From ₦5,000 per student per term — less than a textbook.'],
            ].map(([icon,title,desc])=>(
              <li key={title as string} className="auth-feature-item">
                <div className="auth-feature-icon">{icon}</div>
                <div className="auth-feature-text"><h5>{title as string}</h5><p>{desc as string}</p></div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="auth-right" style={{overflowY:'auto',padding:'40px 60px'}}>
        <div className="auth-form-box" style={{maxWidth:460}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:24,flexWrap:'wrap'}}>
            {[1,2,3].map(n=>(
              <div key={n} style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:28,height:28,borderRadius:'50%',background:progressStep>=n?'var(--gold)':'var(--muted3)',border:`1px solid ${progressStep>=n?'var(--gold)':'var(--border2)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,fontFamily:'var(--font-display)',color:progressStep>=n?'var(--navy)':'var(--muted)'}}>{n}</div>
                <span style={{fontSize:12,color:progressStep>=n?'var(--white)':'var(--muted)'}}>{n===1?'Your Details':n===2?'Verify email':'School Info'}</span>
                {n<3 && <div style={{width:24,height:1,background:'var(--border2)',margin:'0 4px'}}></div>}
              </div>
            ))}
          </div>
          <h2 style={{marginBottom:8}}>{step===1?'Create Your Account':step==='otp'?'Check your email':'School Information'}</h2>
          <p style={{fontSize:14,color:'var(--muted)',marginBottom:28}}>{step===1?'Set up your admin profile':step==='otp'?`We sent a code to ${form.email.trim() || 'your email'}`:'Tell us about your school'}</p>
          {error && <div style={{background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'12px 16px',marginBottom:16,fontSize:14,color:'#F87171'}}>⚠️ {error}</div>}
          
          {step === 'otp' ? (
            <form onSubmit={verifyOtpAndContinue} style={{display:'flex',flexDirection:'column',gap:18}}>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }} onPaste={onPaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputsRef.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={d}
                    onChange={(e) => onDigitChange(i, e)}
                    onKeyDown={(e) => onKeyDown(i, e)}
                    className="form-input"
                    style={{ width: 44, height: 52, textAlign: 'center', fontSize: 22, fontFamily: 'var(--font-mono)' }}
                  />
                ))}
              </div>
              <p className="text-muted text-xs" style={{ lineHeight: 1.45, textAlign: 'center' }}>
                Didn&apos;t get it?{' '}
                <button
                  type="button"
                  className="auth-link"
                  style={{ cursor: resendLocked || sendingOtp ? 'not-allowed' : 'pointer', opacity: resendLocked || sendingOtp ? 0.5 : 1, background: 'none', border: 'none', padding: 0, color: 'var(--gold)' }}
                  disabled={resendLocked || sendingOtp}
                  onClick={resendRegistrationOtp}
                >
                  {sendingOtp ? 'Sending…' : resendLocked ? `Resend in ${countdownSecs}s` : 'Resend code'}
                </button>
              </p>
              <div style={{display:'flex',gap:12}}>
                <button type="button" className="btn btn-ghost" style={{flex:1,justifyContent:'center'}} onClick={() => { clearRegToken(); setStep(1) }}>← Back</button>
                <button type="submit" className="btn btn-primary" style={{flex:2,justifyContent:'center'}} disabled={verifyingOtp || digits.join('').length !== 6}>
                  {verifyingOtp ? 'Verifying…' : 'Continue → School details'}
                </button>
              </div>
            </form>
          ) : (
          <form onSubmit={step === 1 ? continueStep1 : handleSubmit} style={{display:'flex',flexDirection:'column',gap:18}}>
            {step === 1 ? (<>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group"><label>First Name</label><input className="form-input" required placeholder="Adunola" value={form.firstName} onChange={e=>set('firstName',e.target.value)} /></div>
                <div className="form-group"><label>Last Name</label><input className="form-input" required placeholder="Fashola" value={form.lastName} onChange={e=>set('lastName',e.target.value)} /></div>
              </div>
              <div className="form-group"><label>Your Role</label>
                <select className="form-input" value={form.role} onChange={e=>set('role',e.target.value)} style={{appearance:'none'}}>
                  {['Principal','VP Academics','ICT Coordinator','Admin Officer'].map(r=><option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>School Email</label>
                <input
                  type="email"
                  className="form-input"
                  required
                  placeholder="admin@yourschool.edu.ng"
                  value={form.email}
                  onChange={e=>set('email',e.target.value)}
                  autoComplete="email"
                />
                <p className="text-muted text-xs mt-4" style={{ lineHeight: 1.45 }}>
                  We check that your domain can receive mail, then send a verification code. This does not prove the inbox exists — use a real address you can open.
                </p>
              </div>
              <div className="form-group"><label>Phone Number</label><input type="tel" className="form-input" placeholder="+234 800 000 0000" value={form.phone} onChange={e=>set('phone',e.target.value)} /></div>
              <div className="form-group"><label>Create Password</label><input type="password" className="form-input" required minLength={8} placeholder="At least 8 characters" value={form.password} onChange={e=>set('password',e.target.value)} /></div>
              <div className="form-group"><label>Confirm Password</label><input type="password" className="form-input" required placeholder="Re-enter password" value={form.confirmPw} onChange={e=>set('confirmPw',e.target.value)} /></div>
              <button type="submit" className="btn btn-primary" style={{width:'100%',justifyContent:'center'}} disabled={checkingEmail}>
                {checkingEmail ? 'Checking email…' : 'Continue → Verify email'}
              </button>
            </>) : (<>
              <div className="form-group"><label>School Name</label><input className="form-input" required placeholder="Crown Heights Secondary School" value={form.schoolName} onChange={e=>set('schoolName',e.target.value)} /></div>
              <div className="form-group"><label>School Address</label><input className="form-input" placeholder="12 Education Blvd, Victoria Island" value={form.address} onChange={e=>set('address',e.target.value)} /></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group"><label>State</label>
                  <select className="form-input" value={form.state} onChange={e=>set('state',e.target.value)} style={{appearance:'none'}}>
                    {STATES.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>LGA</label><input className="form-input" placeholder="Ikeja" value={form.lga} onChange={e=>set('lga',e.target.value)} /></div>
              </div>
              <div className="form-group"><label>Estimated Number of Students</label>
                <select className="form-input" value={form.studentCount} onChange={e=>set('studentCount',e.target.value)} style={{appearance:'none'}}>
                  {['Under 100','100 – 300','300 – 600','600+'].map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div style={{display:'flex',gap:12}}>
                <button type="button" className="btn btn-ghost" style={{flex:1,justifyContent:'center'}} onClick={() => { clearRegToken(); setDigits(['', '', '', '', '', '']); setStep('otp') }}>← Back</button>
                <button type="submit" className="btn btn-primary" style={{flex:2,justifyContent:'center'}} disabled={loading}>
                  {loading?'Submitting…':'Submit registration →'}
                </button>
              </div>
            </>)}
          </form>
          )}
          <p className="auth-footer-text" style={{marginTop:20}}>
            Already registered? <a className="auth-link" onClick={()=>router.push('/auth/login')} style={{cursor:'pointer'}}>Sign in here</a>
          </p>
          <p className="auth-footer-text" style={{marginTop:8}}>
            <a className="auth-link" onClick={()=>router.push('/')} style={{cursor:'pointer'}}>← Back to website</a>
          </p>
        </div>
      </div>
    </div>
  )
}
