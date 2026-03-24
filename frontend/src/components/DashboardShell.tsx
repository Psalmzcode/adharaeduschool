'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface NavItem { icon: string; label: string; section: string; badge?: string; badgeStyle?: any }
interface Props {
  role: string; title: string; subtitle?: string; section: string
  onSectionChange: (s: string) => void; children: React.ReactNode; topbarRight?: React.ReactNode
  navBadges?: Record<string, string | number | null | undefined>
}

const NAV: Record<string, {groups:{label:string;items:NavItem[]}[];user:string;userRole:string}> = {
  admin: {
    user:'Crown Heights School', userRole:'School Admin',
    groups:[
      {label:'Main', items:[
        {icon:'📊',label:'Overview',section:'overview'},
        {icon:'👥',label:'Students',section:'students',badge:'347'},
        {icon:'📚',label:'Classes',section:'classes'},
        {icon:'🗓️',label:'Attendance',section:'attendance'},
        {icon:'📝',label:'Results & Exams',section:'results'},
      ]},
      {label:'Finance', items:[
        {icon:'💳',label:'Payments',section:'payments',badge:'12'},
      ]},
      {label:'Program', items:[
        {icon:'🏫',label:'Tutors',section:'tutors'},
        {icon:'📢',label:'Announcements',section:'announcements',badge:'!',badgeStyle:{background:'rgba(239,68,68,0.2)',color:'#F87171'}},
        {icon:'🎓',label:'Certificates',section:'certificates'},
        {icon:'📤',label:'Bulk Upload',section:'bulk-upload'},
        {icon:'📋',label:'Reports',section:'reports'},
        {icon:'📈',label:'Class performance',section:'class-insights'},
      ]},
      {label:'System', items:[
        {icon:'🏛️',label:'School profile',section:'school-profile'},
        {icon:'⚙️',label:'Settings',section:'settings'},
      ]},
    ]
  },
  tutor: {
    user:'Mustapha James', userRole:'AdharaEdu Tutor',
    groups:[
      {label:'Teaching', items:[
        {icon:'📊',label:'Dashboard',section:'tutor-dashboard'},
        {icon:'👥',label:'My Students',section:'tutor-students',badge:'28'},
        {icon:'🏫',label:'Classes',section:'tutor-classes'},
        {icon:'📅',label:'Attendance',section:'tutor-attendance'},
        {icon:'📝',label:'Mark Results',section:'tutor-results'},
        {icon:'🧾',label:'Assignments',section:'tutor-assignments'},
        {icon:'🧪',label:'Practicals',section:'tutor-practicals'},
        {icon:'📚',label:'Lesson Plans',section:'tutor-lessons'},
        {icon:'💬',label:'Messages',section:'tutor-messages',badge:'3'},
        {icon:'🖥️',label:'CBT Builder',section:'tutor-cbt'},
        {icon:'📋',label:'Weekly Report',section:'tutor-report',badge:'Due',badgeStyle:{background:'rgba(245,158,11,0.25)',color:'#FCD34D'}},
        {icon:'👤',label:'Profile',section:'tutor-settings'},
        {icon:'⏱️',label:'Session Log',section:'tutor-sessions'},
        {icon:'💼',label:'My Payroll',section:'tutor-payroll'},
        {icon:'📅',label:'Schedule Exams',section:'tutor-exam-schedule'},
        {icon:'📈',label:'Class performance',section:'class-insights'},
      ]},
      {label:'Assessments', items:[
        {icon:'📝',label:'CBT Module',section:'tutor-cbt',badge:'New',badgeStyle:{background:'rgba(34,197,94,0.2)',color:'#4ADE80'}},
      ]},
    ]
  },
  student: {
    user:'Aisha Okonkwo', userRole:'Student · SS3A',
    groups:[
      {label:'My Learning', items:[
        {icon:'🏠',label:'My Dashboard',section:'student-dashboard'},
        {icon:'📚',label:'My Modules',section:'student-modules'},
        {icon:'📝',label:'Assignments',section:'student-assignments',badge:'2'},
        {icon:'🧪',label:'Practicals',section:'student-practicals'},
        {icon:'📊',label:'My Results',section:'student-results'},
        {icon:'📅',label:'Attendance',section:'student-attendance'},
        {icon:'🎓',label:'My Certificates',section:'student-certificates'},
      ]},
      {label:'Support', items:[
        {icon:'💬',label:'Messages',section:'student-asktutor'},
        {icon:'🖥️',label:'My Exams',section:'student-exams',badge:'1'},
        {icon:'🔔',label:'Notifications',section:'student-notifications',badge:'3'},
        {icon:'⚙️',label:'Settings',section:'student-settings'},
      ]},
    ]
  },
  parent: {
    user:'Funke Okonkwo', userRole:'Parent · Aisha O.',
    groups:[
      {label:"My Child", items:[
        {icon:'📊',label:'Overview',section:'parent-overview'},
        {icon:'📈',label:'Results',section:'parent-results'},
        {icon:'🗓️',label:'Attendance',section:'parent-attendance'},
        {icon:'📅',label:'Exam Schedule',section:'parent-exams'},
        {icon:'📢',label:'School Notices',section:'parent-notices'},
        {icon:'⚙️',label:'Settings',section:'parent-settings'},
      ]},
    ]
  },
  superadmin: {
    user:'Adhara Admin', userRole:'Platform Administrator',
    groups:[
      {label:'Platform', items:[
        {icon:'📊',label:'Overview',section:'overview'},
        {icon:'🏫',label:'Schools',section:'schools',badge:'24'},
        {icon:'✅',label:'Approvals',section:'approvals',badge:'5'},
        {icon:'👩‍🏫',label:'Tutors',section:'tutors',badge:'61'},
      ]},
      {label:'Finance & Reports', items:[
        {icon:'💳',label:'Payments',section:'payments'},
        {icon:'📋',label:'Weekly Reports',section:'reports'},
        {icon:'💼',label:'Tutor Payroll',section:'payroll'},
        {icon:'⏱️',label:'Session logs',section:'session-logs'},
        {icon:'🎓',label:'Certificates',section:'certificates'},
      ]},
      {label:'Content', items:[
        {icon:'📝',label:'Assessment Vetting',section:'assessments'},
        {icon:'🖥️',label:'Modules',section:'cbt'},
        {icon:'🧭',label:'Program Tracks',section:'tracks'},
        {icon:'📈',label:'Class performance',section:'class-insights'},
      ]},
      {label:'System', items:[
        {icon:'⚙️',label:'Settings',section:'settings'},
      ]},
    ]
  }
}

export function DashboardShell({ role, title, subtitle, section, onSectionChange, children, topbarRight, navBadges }: Props) {
  const [theme, setTheme] = useState<'dark'|'light'>('dark')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement|null>(null)
  const router = useRouter()
  const nav = NAV[role] || NAV.superadmin

  useEffect(() => {
    const saved = localStorage.getItem('adharaTheme')
    if (saved === 'light') { setTheme('light'); document.body.classList.add('light-mode') }
  }, [])

  const toggleTheme = () => {
    if (theme === 'dark') { setTheme('light'); document.body.classList.add('light-mode'); localStorage.setItem('adharaTheme','light') }
    else { setTheme('dark'); document.body.classList.remove('light-mode'); localStorage.setItem('adharaTheme','dark') }
  }

  const logout = () => { localStorage.removeItem('adhara_token'); localStorage.removeItem('adhara_user'); router.push('/auth/login') }
  const initials = nav?.user?.split(' ').map((w: string) => w[0]).join('').slice(0,2) || 'U'

  useEffect(() => {
    const onDocPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocPointerDown)
    return () => document.removeEventListener('mousedown', onDocPointerDown)
  }, [])

  return (
    <div style={{display:'flex',minHeight:'100vh'}} className="page dashboard-page active">
      {sidebarOpen && <div className="sidebar-overlay open" onClick={()=>setSidebarOpen(false)} style={{display:'block'}}></div>}
      <button className="sidebar-toggle" onClick={()=>setSidebarOpen(!sidebarOpen)} aria-label="Menu">☰</button>

      <aside className={`sidebar${sidebarOpen?' open':''}`}>
        <div className="sidebar-logo">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 50" height="40" width="200" aria-label="AdharaEdu">
            <rect x="1" y="4" width="38" height="40" rx="12" ry="14" fill="#1E7FD4"/>
            <polygon points="20,10 23.5,18.5 33,18.5 25.5,24 28.5,33 20,27.5 11.5,33 14.5,24 7,18.5 16.5,18.5" fill="#F5C518"/>
            <text x="46" y="33" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="26" fill="var(--white)" className="logo-adhara">Adhara</text>
            <text x="153" y="14" fontFamily="Arial,sans-serif" fontWeight="700" fontStyle="italic" fontSize="12" fill="#1E7FD4">Edu</text>
            <text x="46" y="46" fontFamily="Georgia,serif" fontStyle="italic" fontSize="9.5" fill="var(--muted)" letterSpacing="0.3" className="logo-tagline">Learn Smart. Grow Together</text>
          </svg>
        </div>
        <nav className="sidebar-nav">
          {nav?.groups.map((g: any) => (
            <div key={g.label}>
              <div className="sidebar-section-label">{g.label}</div>
              {g.items.map((item: any) => {
                const dynamicBadge = navBadges?.[item.section]
                const resolvedBadge = dynamicBadge !== undefined ? dynamicBadge : item.badge
                return (
                  <a key={item.section+item.label} className={`sidebar-link${section===item.section?' active':''}`}
                    onClick={()=>{ onSectionChange(item.section); setSidebarOpen(false) }} style={{cursor:'pointer'}}>
                    <span className="link-icon">{item.icon}</span>
                    {item.label}
                    {resolvedBadge !== null && resolvedBadge !== undefined && String(resolvedBadge) !== '' && <span className="link-badge" style={item.badgeStyle||{}}>{resolvedBadge}</span>}
                  </a>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-footer-actions">
            <button className="btn btn-ghost btn-sm sidebar-logout-btn" onClick={logout} title="Sign out">↪ Logout</button>
            <button className="btn btn-ghost btn-sm sidebar-back-btn" onClick={()=>router.push('/')}>← Back to Website</button>
          </div>
        </div>
      </aside>

      <div className="dashboard-main">
        <div className="topbar">
          <div className="topbar-title">
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="topbar-right">
            {topbarRight}
            <button onClick={toggleTheme} className="topbar-icon-btn" title="Toggle theme" style={{fontSize:16}}>{theme==='dark'?'☀️':'🌙'}</button>
            <div className="topbar-icon-btn" style={{position:'relative'}}>🔔<div className="topbar-notif-badge"></div></div>
            <div className="topbar-icon-btn">🔍</div>
            <div className="topbar-profile-menu" ref={profileMenuRef}>
              <button className="topbar-profile-btn" onClick={()=>setProfileMenuOpen(!profileMenuOpen)} title="Account menu">
                <div className="sidebar-avatar" style={{width:40,height:40,fontSize:14,cursor:'pointer'}}>{initials}</div>
              </button>
              {profileMenuOpen && (
                <div className="topbar-profile-dropdown">
                  <div className="topbar-profile-meta">
                    <div className="topbar-profile-name">{nav?.user}</div>
                    <div className="topbar-profile-role">{nav?.userRole}</div>
                  </div>
                  <button className="topbar-profile-item danger" onClick={logout}>↪ Logout</button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="dashboard-content">{children}</div>
      </div>
    </div>
  )
}
