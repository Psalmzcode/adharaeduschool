'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authApi, tutorsApi } from '@/lib/api'

const DEMO = [
  {role:'SUPER_ADMIN',  icon:'⚡', label:'Super Admin',   email:'admin@adharaedu.com',        pw:'SuperAdmin@123', dest:'/dashboard/superadmin'},
  {role:'SCHOOL_ADMIN', icon:'🏫', label:'School Admin',  email:'admin@crownheights.edu.ng',  pw:'SchoolAdmin@123', dest:'/dashboard/admin'},
  {role:'TUTOR',        icon:'👩‍🏫', label:'Tutor',          email:'tutor@adharaedu.com',         pw:'Tutor@123',       dest:'/dashboard/tutor'},
  {role:'STUDENT',      icon:'👤', label:'Student',        email:'aisha@crownheights.edu.ng',  pw:'Student@123',     dest:'/dashboard/student'},
  {role:'PARENT',       icon:'👪', label:'Parent',         email:'funke.okonkwo@gmail.com',     pw:'Parent@123',      dest:'/dashboard/student'},
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [selectedRole, setSelectedRole] = useState('SUPER_ADMIN')
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const data = await authApi.login(email, password)
      localStorage.setItem('adhara_token', data.token)
      const dest: Record<string,string> = {SUPER_ADMIN:'/dashboard/superadmin',SCHOOL_ADMIN:'/dashboard/admin',TUTOR:'/dashboard/tutor',STUDENT:'/dashboard/student',PARENT:'/dashboard/student'}
      if (data.user?.role === 'TUTOR') {
        try {
          const profile = await tutorsApi.me()
          if (profile?.onboardingStatus === 'DRAFT') {
            router.push('/dashboard/tutor/onboarding')
            setLoading(false)
            return
          }
        } catch {
          /* continue to dashboard */
        }
      }
      router.push(dest[data.user?.role] || '/dashboard/admin')
    } catch (err: any) {
      // Demo fallback
      const demo = DEMO.find(u => u.email === email && u.pw === password)
      if (demo) {
        localStorage.setItem('adhara_token', 'demo-token')
        localStorage.setItem('adhara_user', JSON.stringify({email:demo.email,role:demo.role,firstName:demo.label.split(' ')[0],lastName:demo.label.split(' ')[1]||''}))
        router.push(demo.dest); return
      }
      setError(err.message || 'Invalid credentials')
    }
    setLoading(false)
  }

  const fill = (u: typeof DEMO[0]) => { setEmail(u.email); setPassword(u.pw); setSelectedRole(u.role); setError('') }

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
              <label>Email Address</label>
              <span className="icon">✉️</span>
              <input type="email" className="form-input" placeholder="you@school.edu.ng" value={email} onChange={e=>setEmail(e.target.value)} required />
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
            <div>
              <div style={{fontSize:13,color:'var(--muted)',marginBottom:12}}>Sign in as:</div>
              <div className="role-select-grid" style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
                {DEMO.map(u=>(
                  <div key={u.role} className={`role-btn${selectedRole===u.role?' selected':''}`}
                    onClick={()=>fill(u)}
                    style={selectedRole===u.role?{borderColor:'var(--gold)',background:'rgba(212,168,83,0.1)'}:{}}>
                    <span className="role-icon">{u.icon}</span>
                    <span className="role-name">{u.label}</span>
                  </div>
                ))}
              </div>
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
            <a className="auth-link" onClick={()=>router.push('/')} style={{cursor:'pointer'}}>← Back to website</a>
            &nbsp;&nbsp;|&nbsp;&nbsp;
            <a className="auth-link" onClick={()=>router.push('/cbt')} style={{cursor:'pointer'}}>📝 CBT Exam Login</a>
          </p>
          <div style={{marginTop:24,padding:'14px 18px',background:'var(--muted3)',border:'1px solid var(--border2)',borderRadius:12}}>
            <div style={{fontSize:11,color:'var(--muted)',marginBottom:10,fontFamily:'var(--font-display)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em'}}>Click to fill demo credentials</div>
            {DEMO.map(u=>(
              <div key={u.role} onClick={()=>fill(u)} style={{fontSize:13,color:'var(--muted)',marginBottom:5,cursor:'pointer',padding:'3px 6px',borderRadius:5}}>
                <span style={{color:'var(--gold2)',fontWeight:600}}>{u.icon} {u.label}:</span> {u.email}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
