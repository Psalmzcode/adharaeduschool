'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authApi, tutorsApi } from '@/lib/api'
import { notify } from '@/lib/notify'

export default function LoginPage() {
  const router = useRouter()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await authApi.login(loginId, password)
      localStorage.setItem('adhara_token', data.token)
      if (data.user) localStorage.setItem('adhara_user', JSON.stringify(data.user))
      const dest: Record<string,string> = {SUPER_ADMIN:'/dashboard/superadmin',SCHOOL_ADMIN:'/dashboard/admin',TUTOR:'/dashboard/tutor',STUDENT:'/dashboard/student',PARENT:'/dashboard/student'}
      if (data.user?.role === 'TUTOR') {
        try {
          const profile = await tutorsApi.me()
          if (profile?.onboardingStatus === 'DRAFT') {
            notify.success('Signed in successfully')
            router.push('/dashboard/tutor/onboarding')
            return
          }
        } catch {
          /* continue to dashboard */
        }
      }
      notify.success('Signed in successfully')
      router.push(dest[data.user?.role] || '/dashboard/admin')
    } catch (err: any) {
      notify.fromError(err, 'Invalid credentials')
      setError(err?.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div id="page-login" className="auth-page active">
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
          <h2 style={{fontFamily:'var(--font-display)',fontSize:32,fontWeight:800,marginBottom:12,color:'var(--white)'}}>Welcome back</h2>
          <p style={{fontSize:15,color:'var(--muted)',marginBottom:40}}>Sign in to your AdharaEdu portal</p>
          <ul className="auth-feature-list">
            {[['📊','Real-time School Dashboard','Monitor attendance, progress, and scores across all classes and tracks.'],
              ['🏆','CBT Examination Engine','Computer-based tests with timer, auto-grading, and instant leaderboards.'],
              ['👪','Parent Visibility Portal','Parents see everything — attendance, results, upcoming exams, and notices.'],
              ['👩‍🏫','Tutor Management','Track weekly reports, mark attendance, and build CBT assessments.'],
            ].map(([icon,title,desc])=>(
              <li key={title as string} className="auth-feature-item">
                <div className="auth-feature-icon">{icon}</div>
                <div className="auth-feature-text"><h5>{title as string}</h5><p>{desc as string}</p></div>
              </li>
            ))}
          </ul>
        </div>
        <div className="auth-left-quote">
          <p>&ldquo;Our SS3 students are now building real applications. AdharaEdu transformed our school in one term.&rdquo;</p>
          <div className="author">— Mr. Adebayo Okafor, Principal · Crown Heights Secondary School</div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-form-box">
          <h2>Sign In</h2>
          <p>Access your AdharaEdu portal</p>
          {error && <div style={{background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'12px 16px',marginBottom:16,fontSize:14,color:'#F87171'}}>⚠️ {error}</div>}
          <form className="auth-form" onSubmit={handleLogin}>
            <div className="form-group form-input-icon">
              <label>Email or username</label>
              <span className="icon">✉️</span>
              <input type="text" className="form-input" placeholder="you@school.edu.ng or chr.aisha" value={loginId} onChange={e=>setLoginId(e.target.value)} required autoComplete="username" />
            </div>
            <div className="form-group form-input-icon" style={{position:'relative'}}>
              <label>Password</label>
              <span className="icon">🔒</span>
              <input type={showPw?'text':'password'} className="form-input" placeholder="Enter your password" value={password} onChange={e=>setPassword(e.target.value)} required />
              <button type="button" onClick={()=>setShowPw(!showPw)} style={{position:'absolute',right:16,bottom:14,background:'none',border:'none',cursor:'pointer',color:'var(--muted)',fontSize:16}}>{showPw?'🙈':'👁️'}</button>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'var(--muted)',cursor:'pointer'}}>
                <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} style={{accentColor:'var(--gold)'}} /> Remember me
              </label>
              <a className="auth-link" style={{fontSize:13,cursor:'pointer'}}>Forgot password?</a>
            </div>
            <button type="submit" className="btn btn-primary" style={{width:'100%',justifyContent:'center'}} disabled={loading}>
              {loading?'Signing in…':'Sign In to Dashboard →'}
            </button>
            <div className="auth-divider">or</div>
            <button type="button" className="btn btn-ghost" style={{width:'100%',justifyContent:'center'}}>🔑 Sign in with Google</button>
          </form>
          <p className="auth-footer-text" style={{marginTop:24}}>
            Don&apos;t have an account? <a className="auth-link" onClick={()=>router.push('/auth/register')} style={{cursor:'pointer'}}>Register your school</a>
          </p>
          <p className="auth-footer-text" style={{marginTop:12}}>
            <a className="auth-link" onClick={()=>router.push('/auth/login-otp')} style={{cursor:'pointer'}}>Sign in with email code →</a>
          </p>
          <p className="auth-footer-text" style={{marginTop:12}}>
            <a className="auth-link" onClick={()=>router.push('/')} style={{cursor:'pointer'}}>← Back to website</a>
            &nbsp;&nbsp;|&nbsp;&nbsp;
            <a className="auth-link" onClick={()=>router.push('/cbt')} style={{cursor:'pointer'}}>📝 CBT Exam Login</a>
          </p>
        </div>
      </div>
    </div>
  )
}
