
'use client'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { DashboardShell } from '@/components/DashboardShell'
import { ClassPerformancePanel } from '@/components/ClassPerformancePanel'
import { SchoolProfileView } from '@/components/school/SchoolProfileView'
import { schoolsApi, studentsApi, noticesApi, examsApi, attendanceApi, bulkUploadApi, paymentsApi, paystackApi, certificatesApi, tutorsApi, schoolClassesApi, reportsApi, tracksApi, practicalsApi } from '@/lib/api'
import { notify } from '@/lib/notify'

// ── tiny reusable pieces ──────────────────────────────────────────────────
function StatCard({icon,value,label,trend,trendUp,glowColor='var(--gold)'}:{icon:string,value:any,label:string,trend?:string,trendUp?:boolean,glowColor?:string}) {
  return (
    <div className="stat-card">
      <div style={{position:'absolute',width:120,height:120,borderRadius:'50%',right:-30,top:-30,filter:'blur(40px)',background:glowColor,opacity:0.3,pointerEvents:'none'}}/>
      <div className="stat-card-icon" style={{background:`${glowColor}22`}}>{icon}</div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
      {trend && <span className={`stat-card-trend${trendUp?' trend-up':''}`}>{trend}</span>}
    </div>
  )
}

function ProgressBar({value,color='linear-gradient(90deg,var(--gold),var(--teal))'}:{value:number,color?:string}) {
  return (
    <div style={{height:6,background:'var(--muted3)',borderRadius:3,overflow:'hidden'}}>
      <div style={{height:'100%',width:`${Math.min(value,100)}%`,background:color,borderRadius:3,transition:'width 0.5s'}}/>
    </div>
  )
}

function Modal({open,onClose,title,children}:{open:boolean,onClose:()=>void,title:string,children:React.ReactNode}) {
  if (!open) return null
  return (
    <div
      onClick={onClose}
      style={{
        position:'fixed',
        inset:0,
        background:'rgba(0,0,0,0.7)',
        backdropFilter:'blur(4px)',
        zIndex:1000,
        display:'flex',
        alignItems:'center',
        justifyContent:'center',
        padding:16
      }}
    >
      <div
        onClick={e=>e.stopPropagation()}
        style={{
          width:'100%',
          maxWidth:720,
          maxHeight:'90vh',
          background:'var(--navy2)',
          border:'1px solid var(--border)',
          borderRadius:18,
          overflow:'hidden',
          display:'flex',
          flexDirection:'column'
        }}
      >
        <div style={{padding:'16px 18px',borderBottom:'1px solid var(--border2)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
          <h3 style={{fontFamily:'var(--font-display)',fontSize:18,fontWeight:700,color:'var(--white)'}}>{title}</h3>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted)',fontSize:20}}>✕</button>
        </div>
        <div style={{padding:16,overflow:'auto'}}>{children}</div>
      </div>
    </div>
  )
}

// ── section components ────────────────────────────────────────────────────
function Overview({school,stats,topStudents,attendanceData,notices,upcomingExams,onAddStudent}:{school:any,stats:any,topStudents:any[],attendanceData:any[],notices:any[],upcomingExams:any[],onAddStudent:()=>void}) {
  const totalStudentsVal = stats?.totalStudents ?? '—'
  const attendanceRateVal = stats?.attendanceRate != null ? `${stats.attendanceRate}%` : '—'
  const avgScoreVal = stats?.avgScore != null ? `${stats.avgScore}%` : '—'
  const upcomingExamsVal = stats?.upcomingExams ?? '—'

  return (
    <>
      {/* School info card */}
      <div style={{background:'linear-gradient(135deg,rgba(212,168,83,0.1),rgba(26,127,212,0.06))',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',padding:'24px 28px',marginBottom:24,display:'flex',alignItems:'center',gap:20,flexWrap:'wrap'}}>
        <div style={{width:60,height:60,borderRadius:16,background:'rgba(212,168,83,0.15)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>🏫</div>
        <div style={{flex:1}}>
          <h3 style={{fontFamily:'var(--font-display)',fontSize:20,fontWeight:800,color:'var(--white)',marginBottom:4}}>{school?.name || 'School overview'}</h3>
          <p style={{fontSize:13,color:'var(--muted)',marginBottom:8}}>{school?.address || 'Address not available'} · Est. 2004</p>
          <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
            <span className="badge badge-success">● Active</span>
            <span className="badge badge-teal">Track 1 · 2 · 3</span>
            <span className="badge badge-gold">Term 2, 2026</span>
          </div>
        </div>
        <button onClick={onAddStudent} className="btn btn-primary btn-sm">+ Add Student</button>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <StatCard icon="👥" value={totalStudentsVal} label="Total Students" trend="↑ 23 this term" trendUp glowColor="var(--teal)"/>
        <StatCard icon="📅" value={attendanceRateVal} label="Attendance Rate" trend="↑ This week" trendUp glowColor="var(--success)"/>
        <StatCard icon="📈" value={avgScoreVal} label="Avg Module Score" trend="↑ 3% vs last term" trendUp glowColor="var(--gold)"/>
        <StatCard icon="🎓" value={upcomingExamsVal} label="Upcoming Exams" trend="Next: Mar 15" glowColor="#A78BFA"/>
      </div>

      <div className="content-grid-3">
        {/* Top students table */}
        <div className="card">
          <div className="flex-between mb-20">
            <div>
              <div className="font-display fw-700 text-white" style={{fontSize:16}}>Top Performing Students</div>
              <div className="text-muted text-sm mt-4">Ranked by average module score</div>
            </div>
          </div>
          <table className="data-table">
            <thead><tr><th>#</th><th>Student</th><th>Track</th><th>Progress</th><th>Status</th></tr></thead>
            <tbody>
              {topStudents.slice(0,8).map((s:any,i:number)=>(
                <tr key={i}>
                  <td><span style={{color:i<3?'var(--gold)':'var(--muted)',fontWeight:700}}>{i<3?['🥇','🥈','🥉'][i]:i+1}</span></td>
                  <td><div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:32,height:32,borderRadius:'50%',background:'rgba(212,168,83,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,fontFamily:'var(--font-display)',color:'var(--gold)'}}>
                      {(s.name||'').split(' ').map((n:string)=>n[0]).join('')}
                    </div>
                    <span style={{color:'rgba(248,245,239,0.9)',fontWeight:500}}>{s.name}</span>
                  </div></td>
                  <td><span className={`badge ${s.track?.includes('3')?'badge-info':s.track?.includes('2')?'badge-gold':'badge-teal'}`}>{s.track}</span></td>
                  <td>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:80}}><ProgressBar value={s.progress||s.averageScore||0}/></div>
                      <span style={{fontSize:12,color:'var(--muted)'}}>{s.progress||s.averageScore||0}%</span>
                    </div>
                  </td>
                  <td><span className={`badge ${s.status==='At Risk'?'badge-danger':'badge-success'}`}>{s.status||'Active'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right column */}
        <div style={{display:'flex',flexDirection:'column',gap:20}}>
          {/* Calendar */}
          <div className="card">
            <div className="flex-between mb-16">
              <div className="font-display fw-700 text-white" style={{fontSize:15}}>March 2026</div>
              <div style={{display:'flex',gap:8}}>
                <button className="topbar-icon-btn" style={{width:28,height:28,fontSize:12}}>‹</button>
                <button className="topbar-icon-btn" style={{width:28,height:28,fontSize:12}}>›</button>
              </div>
            </div>
            <div className="cal-grid">
              {['S','M','T','W','T','F','S'].map((d,i)=><div key={i} className="cal-day-label">{d}</div>)}
              <div className="cal-day" style={{gridColumn:1}}></div>
              {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31].map(d=>(
                <div key={d} className={`cal-day${[4,9,12,15,17,26].includes(d)?' has-event':''}${d===17?' today':''}`}>{d}</div>
              ))}
            </div>
            <div className="divider mt-16 mb-12"></div>
            <div style={{fontSize:13,display:'flex',flexDirection:'column',gap:10}}>
              {upcomingExams.slice(0,3).map((e:any,i:number)=>(
                <div key={i} style={{display:'flex',gap:12,alignItems:'center'}}>
                  <div style={{width:4,height:36,background:i===0?'var(--gold)':'var(--teal)',borderRadius:2,flexShrink:0}}></div>
                  <div>
                    <div style={{color:'var(--white)',fontWeight:500,marginBottom:2}}>{e.title||e.label}</div>
                    <div style={{fontSize:11,color:'var(--muted)'}}>{e.date||e.scheduledAt}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="card">
            <div className="flex-between mb-16">
              <div className="font-display fw-700 text-white" style={{fontSize:15}}>Notifications</div>
              <span className="badge badge-gold">4 new</span>
            </div>
            {[
              {dot:'var(--gold)',text:'Emeka Chukwu completed Track 1 with 96% score.',time:'2h ago'},
              {dot:'var(--danger)',text:'Tunde Ibrahim missed 3 consecutive sessions.',time:'5h ago'},
              {dot:'var(--teal)',text:'28 certificates ready for Track 1 completers.',time:'1d ago'},
              {dot:'var(--info)',text:'February payment reconciliation report available.',time:'2d ago'},
            ].map((n,i)=>(
              <div key={i} className="notif-item">
                <div className="notif-dot" style={{background:n.dot}}></div>
                <div className="notif-text" dangerouslySetInnerHTML={{__html:n.text}}/>
                <div className="notif-time">{n.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="content-grid">
        <div className="card">
          <div className="flex-between mb-20">
            <div>
              <div className="font-display fw-700 text-white mb-4" style={{fontSize:16}}>Monthly Attendance</div>
              <div className="text-muted text-sm">Sessions attended per week</div>
            </div>
          </div>
          <div className="chart-bars">
            {[['W1',55],['W2',70],['W3',62],['W4',85],['W5',78],['W6',90],['W7',95],['W8',88]].map(([l,h])=>(
              <div key={l} className="chart-bar-wrap">
                <div className={`chart-bar${Number(h)>85?' teal':''}`} style={{height:`${h}%`}}></div>
                <div className="chart-bar-label">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="font-display fw-700 text-white mb-4" style={{fontSize:16}}>Track Distribution</div>
          <div className="text-muted text-sm mb-20">Students per track this term</div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-around'}}>
            <svg width="120" height="120" viewBox="0 0 120 120" className="progress-ring">
              <circle className="progress-ring-bg" cx="60" cy="60" r="52"/>
              <circle className="progress-ring-fill" cx="60" cy="60" r="52" stroke="url(#gr1)" strokeDasharray="326.7" strokeDashoffset="82"/>
              <text x="60" y="56" fill="white" fontFamily="Syne,sans-serif" fontSize="20" fontWeight="800" textAnchor="middle">347</text>
              <text x="60" y="72" fill="rgba(248,245,239,0.5)" fontFamily="DM Sans,sans-serif" fontSize="11" textAnchor="middle">Students</text>
              <defs><linearGradient id="gr1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="var(--gold)"/><stop offset="100%" stopColor="var(--teal2)"/></linearGradient></defs>
            </svg>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {[['var(--teal)','Track 1','148 students','43%'],['var(--gold)','Track 2','112 students','32%'],['#93C5FD','Track 3','87 students','25%']].map(([c,t,s,p])=>(
                <div key={t}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                    <div style={{width:10,height:10,borderRadius:3,background:c,flexShrink:0}}></div>
                    <span style={{fontSize:13,color:'var(--white)',fontWeight:500}}>{t}</span>
                    <span style={{fontSize:12,color:'var(--gold)',marginLeft:'auto',fontFamily:'var(--font-display)',fontWeight:700}}>{p}</span>
                  </div>
                  <div style={{fontSize:11,color:'var(--muted)',paddingLeft:18}}>{s}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function StudentsSection({school,selectedClass,onClearClass,onBackToClasses}:{school:any,selectedClass?:string|null,onClearClass?:()=>void,onBackToClasses?:()=>void}) {
  const { data: tracksData } = useQuery({
    queryKey: ['admin', 'tracks-options'],
    queryFn: () => tracksApi.all(),
    staleTime: 60_000,
    retry: 1,
  })
  const trackOptions = (Array.isArray(tracksData) ? tracksData : [])
    .filter((t: any) => t.isActive !== false)
    .map((t: any) => ({
      code: String(t.code),
      label: String(t.name || String(t.code).replace('TRACK_', 'Track ')),
    }))
  const trackLabelMap = trackOptions.reduce((acc: Record<string, string>, t: { code: string; label: string }) => {
    acc[t.code] = t.label
    return acc
  }, {})
  const DEFAULT_CLASSES = ['JSS1A','JSS1B','JSS2A','SS1A','SS1B','SS2A','SS2B','SS3A','SS3B']
  const [students, setStudents] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [termFilter, setTermFilter] = useState<string>('ALL')
  const [loading, setLoading] = useState(true)
  const [loadingPracticals, setLoadingPracticals] = useState(false)
  const [practicalAvgByStudentId, setPracticalAvgByStudentId] = useState<Record<string, number>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [tempPwByStudentId, setTempPwByStudentId] = useState<Record<string, string>>({})
  const [revealPwByStudentId, setRevealPwByStudentId] = useState<Record<string, boolean>>({})
  const [resettingPwByStudentId, setResettingPwByStudentId] = useState<Record<string, boolean>>({})
  const [manualClassTrackMap, setManualClassTrackMap] = useState<Record<string, string>>({})
  const [form, setForm] = useState({firstName:'',lastName:'',email:'',className:'SS3A',track:'TRACK_1'})
  const resolvedTermLabel = (() => {
    const y = String(school?.academicYearLabel || '').trim()
    const t = String(school?.currentTermLabel || '').trim()
    const joined = [y, t].filter(Boolean).join(' ').trim()
    return joined || '2025/2026 Term 2'
  })()

  useEffect(()=>{ if(school?.id) loadStudents() },[school, search, termFilter])
  useEffect(() => {
    if (!school?.id) {
      setManualClassTrackMap({})
      return
    }
    const loadClassTracks = async () => {
      try {
        const classes = await schoolClassesApi.all(school.id)
        const map = (Array.isArray(classes) ? classes : []).reduce((acc: Record<string, string>, c: any) => {
          if (c?.className && c?.track) acc[c.className] = c.track
          return acc
        }, {})
        setManualClassTrackMap(map)
      } catch {
        setManualClassTrackMap({})
      }
    }
    loadClassTracks()
  }, [school?.id])
  const loadStudents = async () => {
    setLoading(true)
    try {
      const params: any = { schoolId: school?.id, search }
      if (termFilter && termFilter !== 'ALL') params.termLabel = termFilter
      const d = await studentsApi.all(params)
      setStudents(d || [])
    } catch {
      setStudents([])
    }
    setLoading(false)
  }
  const addStudent = async (e:React.FormEvent) => {
    e.preventDefault()
    const resolvedTrack = classTrackMap[form.className] || form.track
    try {
      await studentsApi.create({ ...form, track: resolvedTrack, schoolId: school?.id, termLabel: resolvedTermLabel })
      notify.success('Student created')
      setShowAdd(false)
      loadStudents()
    } catch (e: any) {
      notify.fromError(e, 'Could not create student')
    }
  }

  const resetPassword = async (studentId: string) => {
    setResettingPwByStudentId((prev) => ({ ...prev, [studentId]: true }))
    try {
      const res = await studentsApi.resetPassword(studentId)
      const pw = String(res?.tempPassword || '')
      if (!pw) throw new Error('No temporary password returned')
      setTempPwByStudentId((prev) => ({ ...prev, [studentId]: pw }))
      setRevealPwByStudentId((prev) => ({ ...prev, [studentId]: true }))
      notify.success('Temporary password generated')
    } catch (e: any) {
      notify.fromError(e, 'Could not reset password')
    }
    setResettingPwByStudentId((prev) => ({ ...prev, [studentId]: false }))
  }

  const list = students
  const observedClassTrackMap = list.reduce((acc: Record<string, Record<string, number>>, s: any) => {
    if (!s?.className || !s?.track) return acc
    if (!acc[s.className]) acc[s.className] = {}
    acc[s.className][s.track] = (acc[s.className][s.track] || 0) + 1
    return acc
  }, {})
  const resolvedObservedMap = Object.keys(observedClassTrackMap).reduce((acc: Record<string, string>, className: string) => {
    const trackCounts = observedClassTrackMap[className]
    const bestTrack = Object.keys(trackCounts).sort((a, b) => trackCounts[b] - trackCounts[a])[0]
    if (bestTrack) acc[className] = bestTrack
    return acc
  }, {})
  const classTrackMap = { ...manualClassTrackMap, ...resolvedObservedMap }
  const classOptions = Array.from(new Set([...DEFAULT_CLASSES, ...Object.keys(classTrackMap)])).sort()
  const filteredList = selectedClass ? list.filter((s:any)=>s.className===selectedClass) : list
  const termOptions = Array.from(
    new Set(
      (Array.isArray(students) ? students : [])
        .map((s: any) => String(s?.termLabel || '').trim())
        .filter(Boolean),
    ),
  ).sort()
  useEffect(() => {
    const derivedTrack = classTrackMap[form.className]
    if (derivedTrack && derivedTrack !== form.track) {
      setForm((prev) => ({ ...prev, track: derivedTrack }))
    }
  }, [form.className, form.track, classTrackMap])
  useEffect(() => {
    const loadPracticalScores = async () => {
      if (!school?.id || !selectedClass) {
        setPracticalAvgByStudentId({})
        return
      }
      setLoadingPracticals(true)
      try {
        const tasks = await practicalsApi.listTasks({ schoolId: school.id, className: selectedClass }).catch(() => [])
        const taskArr = Array.isArray(tasks) ? tasks : []
        if (!taskArr.length) {
          setPracticalAvgByStudentId({})
          setLoadingPracticals(false)
          return
        }
        const submissionsByTask = await Promise.all(taskArr.map((t: any) => practicalsApi.submissions(t.id).catch(() => [])))
        const submissions = submissionsByTask.flat()
        const filteredSubs =
          termFilter && termFilter !== 'ALL'
            ? submissions.filter((s: any) => String(s?.termLabel || '').trim() === termFilter)
            : submissions
        const scoreMap: Record<string, number[]> = {}
        filteredSubs.forEach((sub: any) => {
          if (!sub?.studentId || typeof sub?.totalScore !== 'number') return
          if (!scoreMap[sub.studentId]) scoreMap[sub.studentId] = []
          scoreMap[sub.studentId].push(sub.totalScore)
        })
        const avgMap = Object.keys(scoreMap).reduce((acc: Record<string, number>, studentId: string) => {
          const scores = scoreMap[studentId]
          acc[studentId] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          return acc
        }, {})
        setPracticalAvgByStudentId(avgMap)
      } catch {
        setPracticalAvgByStudentId({})
      }
      setLoadingPracticals(false)
    }
    loadPracticalScores()
  }, [school?.id, selectedClass, termFilter])
  useEffect(() => {
    if (!trackOptions.length) return
    if (!trackOptions.some((t) => t.code === form.track)) {
      setForm((prev) => ({ ...prev, track: trackOptions[0].code }))
    }
  }, [JSON.stringify(trackOptions), form.track])
  const classMetrics: { avgModule: number | null; avgAssignment: number | null; avgCbt: number | null; avgPractical: number | null; avgTrackScore: number | null; atRisk: number } = {
    avgModule: null,
    avgAssignment: null,
    avgCbt: null,
    avgPractical: null,
    avgTrackScore: null,
    atRisk: 0,
  }
  if (filteredList.length > 0) {
    const moduleAverages: number[] = []
    const assignmentAverages: number[] = []
    const cbtAverages: number[] = []
    const practicalAverages: number[] = []
    const trackScores: number[] = []
    let atRiskCount = 0

    for (const s of filteredList as any[]) {
      const moduleScores = (s.moduleProgress || []).map((p: any) => p.score).filter((x: any) => typeof x === 'number')
      if (moduleScores.length) {
        const moduleAvg = Math.round(moduleScores.reduce((a: number, b: number) => a + b, 0) / moduleScores.length)
        moduleAverages.push(moduleAvg)
        if (moduleAvg < 50) atRiskCount += 1
      }

      const assignmentScores = (s.assignmentSubs || []).map((a: any) => a.score).filter((x: any) => typeof x === 'number')
      if (assignmentScores.length) {
        assignmentAverages.push(Math.round(assignmentScores.reduce((a: number, b: number) => a + b, 0) / assignmentScores.length))
      }

      const cbtScores = (s.examAttempts || []).map((e: any) => e.score).filter((x: any) => typeof x === 'number')
      if (cbtScores.length) {
        cbtAverages.push(Math.round(cbtScores.reduce((a: number, b: number) => a + b, 0) / cbtScores.length))
      }
      const practicalAvg = practicalAvgByStudentId[s.id]
      if (typeof practicalAvg === 'number') practicalAverages.push(practicalAvg)

      const cbtAvg = cbtScores.length ? Math.round(cbtScores.reduce((a: number, b: number) => a + b, 0) / cbtScores.length) : null
      const assignmentAvg = assignmentScores.length ? Math.round(assignmentScores.reduce((a: number, b: number) => a + b, 0) / assignmentScores.length) : null
      const parts: Array<{ score: number; weight: number }> = []
      if (cbtAvg != null) parts.push({ score: cbtAvg, weight: 40 })
      if (assignmentAvg != null) parts.push({ score: assignmentAvg, weight: 20 })
      if (typeof practicalAvg === 'number') parts.push({ score: practicalAvg, weight: 40 })
      const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0)
      if (totalWeight) {
        trackScores.push(Math.round(parts.reduce((sum, p) => sum + (p.score * p.weight), 0) / totalWeight))
      }
    }

    classMetrics.avgModule = moduleAverages.length ? Math.round(moduleAverages.reduce((a: number, b: number) => a + b, 0) / moduleAverages.length) : null
    classMetrics.avgAssignment = assignmentAverages.length ? Math.round(assignmentAverages.reduce((a: number, b: number) => a + b, 0) / assignmentAverages.length) : null
    classMetrics.avgCbt = cbtAverages.length ? Math.round(cbtAverages.reduce((a: number, b: number) => a + b, 0) / cbtAverages.length) : null
    classMetrics.avgPractical = practicalAverages.length ? Math.round(practicalAverages.reduce((a: number, b: number) => a + b, 0) / practicalAverages.length) : null
    classMetrics.avgTrackScore = trackScores.length ? Math.round(trackScores.reduce((a: number, b: number) => a + b, 0) / trackScores.length) : null
    classMetrics.atRisk = atRiskCount
  }

  return (
    <>
      <Modal open={showAdd} onClose={()=>setShowAdd(false)} title="Add New Student">
        <form onSubmit={addStudent} style={{display:'flex',flexDirection:'column',gap:16}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div><label style={{display:'block',fontSize:12,color:'var(--muted)',marginBottom:6,fontFamily:'var(--font-display)',textTransform:'uppercase',letterSpacing:'0.06em'}}>First Name</label><input className="form-input" required value={form.firstName} onChange={e=>setForm({...form,firstName:e.target.value})} placeholder="Aisha"/></div>
            <div><label style={{display:'block',fontSize:12,color:'var(--muted)',marginBottom:6,fontFamily:'var(--font-display)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Last Name</label><input className="form-input" required value={form.lastName} onChange={e=>setForm({...form,lastName:e.target.value})} placeholder="Okonkwo"/></div>
          </div>
          <div><label style={{display:'block',fontSize:12,color:'var(--muted)',marginBottom:6,fontFamily:'var(--font-display)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Email Address</label><input type="email" className="form-input" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="student@school.edu.ng"/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div><label style={{display:'block',fontSize:12,color:'var(--muted)',marginBottom:6,fontFamily:'var(--font-display)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Class</label>
              <select
                className="form-input"
                value={form.className}
                onChange={e=>{
                  const nextClass = e.target.value
                  setForm((prev) => ({
                    ...prev,
                    className: nextClass,
                    track: classTrackMap[nextClass] || prev.track,
                  }))
                }}
                style={{appearance:'none'}}
              >
                {classOptions.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label style={{display:'block',fontSize:12,color:'var(--muted)',marginBottom:6,fontFamily:'var(--font-display)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Track</label>
              <input className="form-input" value={trackLabelMap[form.track] || form.track} readOnly />
              <div className="text-muted text-xs mt-4">Auto-filled from selected class</div>
            </div>
          </div>
          <div style={{display:'flex',gap:12,marginTop:8}}>
            <button type="button" onClick={()=>setShowAdd(false)} className="btn btn-ghost" style={{flex:1,justifyContent:'center'}}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{flex:2,justifyContent:'center'}}>Add Student →</button>
          </div>
        </form>
      </Modal>

      <div className="card">
        <div className="flex-between mb-20">
          <div>
            <div className="font-display fw-700 text-white" style={{fontSize:18}}>All Students</div>
            <div className="text-muted text-sm">
              {loading ? 'Loading students…' : `${filteredList.length} students enrolled this term`}
              {selectedClass ? ` · Class ${selectedClass}` : ''}
            </div>
          </div>
          <div style={{display:'flex',gap:12,alignItems:'center'}}>
            <input className="form-input" placeholder="Search students…" value={search} onChange={e=>setSearch(e.target.value)} style={{width:240,padding:'10px 16px'}}/>
            <select
              className="form-input"
              value={termFilter}
              onChange={(e) => setTermFilter(e.target.value)}
              style={{ appearance: 'none', width: 220, padding: '10px 16px' }}
              title="Filter by term (billing)"
            >
              <option value="ALL">All terms</option>
              {termOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {selectedClass && <button onClick={onBackToClasses} className="btn btn-ghost btn-sm">Back to Classes</button>}
            {selectedClass && <button onClick={onClearClass} className="btn btn-ghost btn-sm">Clear Class Filter</button>}
            <button onClick={()=>setShowAdd(true)} className="btn btn-primary btn-sm">+ Add Student</button>
          </div>
        </div>
        {selectedClass && (
          <div className="stats-row" style={{gridTemplateColumns:'repeat(5,1fr)',marginBottom:20}}>
            <StatCard icon="👥" value={filteredList.length} label="Class Students" glowColor="var(--teal)" />
            <StatCard icon="📝" value={classMetrics.avgAssignment != null ? `${classMetrics.avgAssignment}%` : '—'} label="Avg Assignment Score" glowColor="var(--gold)" />
            <StatCard icon="🖥️" value={classMetrics.avgCbt != null ? `${classMetrics.avgCbt}%` : '—'} label="Avg CBT Score" glowColor="#A78BFA" />
            <StatCard icon="🧪" value={loadingPracticals ? '…' : classMetrics.avgPractical != null ? `${classMetrics.avgPractical}%` : '—'} label="Avg Practical Score" glowColor="var(--success)" />
            <StatCard icon="⚠️" value={classMetrics.atRisk} label="At Risk" glowColor="var(--danger)" />
          </div>
        )}
        <table className="data-table">
          <thead><tr><th>Student</th><th>Reg Number</th><th>Class</th><th>Track</th><th>Module Avg</th><th>Assignment Avg</th><th>CBT Avg</th><th>Practical Avg</th><th>Track Score</th><th>Password</th><th>Status</th></tr></thead>
          <tbody>
            {!loading && filteredList.length===0 && (
              <tr><td colSpan={11} style={{textAlign:'center',padding:'24px 0',color:'var(--muted)'}}>No students found</td></tr>
            )}
            {loading && (
              <tr><td colSpan={11} style={{textAlign:'center',padding:'24px 0',color:'var(--muted)'}}>Loading students…</td></tr>
            )}
            {!loading && filteredList.map((s:any,i:number)=>{
              const scores = (s.moduleProgress||[]).map((p:any)=>p.score).filter(Boolean)
              const avg = scores.length ? Math.round(scores.reduce((a:number,b:number)=>a+b)/scores.length) : 0
              const assignmentScores = (s.assignmentSubs||[]).map((a:any)=>a.score).filter((x:any)=>typeof x === 'number')
              const assignmentAvg = assignmentScores.length ? Math.round(assignmentScores.reduce((a:number,b:number)=>a+b)/assignmentScores.length) : null
              const cbtScores = (s.examAttempts||[]).map((e:any)=>e.score).filter((x:any)=>typeof x === 'number')
              const cbtAvg = cbtScores.length ? Math.round(cbtScores.reduce((a:number,b:number)=>a+b)/cbtScores.length) : null
              const practicalAvg = typeof practicalAvgByStudentId[s.id] === 'number' ? practicalAvgByStudentId[s.id] : null
              const parts: Array<{ score: number; weight: number }> = []
              if (cbtAvg != null) parts.push({ score: cbtAvg, weight: 40 })
              if (assignmentAvg != null) parts.push({ score: assignmentAvg, weight: 20 })
              if (practicalAvg != null) parts.push({ score: practicalAvg, weight: 40 })
              const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0)
              const trackScore = totalWeight ? Math.round(parts.reduce((sum, p) => sum + (p.score * p.weight), 0) / totalWeight) : null
              const pw = tempPwByStudentId[s.id]
              const revealing = !!revealPwByStudentId[s.id]
              const resetting = !!resettingPwByStudentId[s.id]
              return (
                <tr key={i}>
                  <td><div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:32,height:32,borderRadius:'50%',background:'rgba(212,168,83,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,fontFamily:'var(--font-display)',color:'var(--gold)'}}>
                      {s.user?.firstName?.[0]}{s.user?.lastName?.[0]}
                    </div>
                    <span>{s.user?.firstName} {s.user?.lastName}</span>
                  </div></td>
                  <td style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--muted)'}}>{s.regNumber}</td>
                  <td>{s.className}</td>
                  <td><span className={`badge ${s.track==='TRACK_3'?'badge-info':s.track==='TRACK_2'?'badge-gold':'badge-teal'}`}>{(s.track||'').replace('TRACK_','Track ')}</span></td>
                  <td><strong style={{color:avg>=70?'var(--success)':avg>0?'var(--warning)':'var(--muted)'}}>{avg>0?`${avg}%`:'—'}</strong></td>
                  <td><strong style={{color:assignmentAvg!=null?(assignmentAvg>=70?'var(--success)':'var(--warning)'):'var(--muted)'}}>{assignmentAvg!=null?`${assignmentAvg}%`:'—'}</strong></td>
                  <td><strong style={{color:cbtAvg!=null?(cbtAvg>=70?'var(--success)':'var(--warning)'):'var(--muted)'}}>{cbtAvg!=null?`${cbtAvg}%`:'—'}</strong></td>
                  <td><strong style={{color:practicalAvg!=null?(practicalAvg>=70?'var(--success)':'var(--warning)'):'var(--muted)'}}>{practicalAvg!=null?`${practicalAvg}%`:'—'}</strong></td>
                  <td><strong style={{color:trackScore!=null?(trackScore>=70?'var(--success)':'var(--warning)'):'var(--muted)'}}>{trackScore!=null?`${trackScore}%`:'—'}</strong></td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {pw ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span>{revealing ? pw : '••••••••'}</span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 10, padding: '6px 10px' }}
                          onClick={() => setRevealPwByStudentId((prev) => ({ ...prev, [s.id]: !prev[s.id] }))}
                        >
                          {revealing ? 'Hide' : 'Reveal'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 10, padding: '6px 10px' }}
                          onClick={() =>
                            navigator.clipboard?.writeText(pw)
                              .then(() => notify.success('Password copied'))
                              .catch(() => notify.warning('Could not copy'))
                          }
                        >
                          Copy
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 10, padding: '6px 10px' }}
                        disabled={resetting}
                        onClick={() => resetPassword(s.id)}
                      >
                        {resetting ? 'Generating…' : 'Generate'}
                      </button>
                    )}
                  </td>
                  <td><span className={`badge ${avg>0&&avg<50?'badge-danger':'badge-success'}`}>{avg>0&&avg<50?'At Risk':'Active'}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function ClassesSection({ school, onOpenClass }: { school: any; onOpenClass: (className: string) => void }) {
  const { data: tracksData } = useQuery({
    queryKey: ['admin', 'tracks-options'],
    queryFn: () => tracksApi.all(),
    staleTime: 60_000,
    retry: 1,
  })
  const trackOptions = (Array.isArray(tracksData) ? tracksData : [])
    .filter((t: any) => t.isActive !== false)
    .map((t: any) => ({ code: String(t.code), label: String(t.name || String(t.code).replace('TRACK_', 'Track ')) }))
  const [loading, setLoading] = useState(true)
  const [studentsRaw, setStudentsRaw] = useState<any[]>([])
  const [savedClasses, setSavedClasses] = useState<Array<{ className: string; track: string }>>([])
  const [showAddClass, setShowAddClass] = useState(false)
  const [form, setForm] = useState({ className: '', primaryTrack: '' })

  useEffect(() => {
    const loadClasses = async () => {
      if (!school?.id) return
      setLoading(true)
      try {
        const [students, classes] = await Promise.all([
          studentsApi.all({ schoolId: school.id }),
          schoolClassesApi.all(school.id).catch(() => []),
        ])
        setStudentsRaw(Array.isArray(students) ? students : [])
        setSavedClasses(Array.isArray(classes) ? classes : [])
      } catch {
        setStudentsRaw([])
        setSavedClasses([])
      }
      setLoading(false)
    }
    loadClasses()
  }, [school?.id])
  useEffect(() => {
    if (!trackOptions.length) return
    if (!trackOptions.some((t) => t.code === form.primaryTrack)) {
      setForm((prev) => ({ ...prev, primaryTrack: trackOptions[0].code }))
    }
  }, [JSON.stringify(trackOptions), form.primaryTrack])

  const groupedFromStudents = studentsRaw.reduce((acc: Record<string, any>, s: any) => {
    const key = s.className || 'Unassigned'
    if (!acc[key]) {
      acc[key] = {
        className: key,
        total: 0,
        tracks: {} as Record<string, number>,
        primaryTrack: undefined as string | undefined,
      }
    }
    acc[key].total += 1
    if (s.track) acc[key].tracks[s.track] = (acc[key].tracks[s.track] || 0) + 1
    return acc
  }, {})

  savedClasses.forEach((c) => {
    if (!groupedFromStudents[c.className]) {
      groupedFromStudents[c.className] = {
        className: c.className,
        total: 0,
        tracks: {} as Record<string, number>,
        primaryTrack: c.track,
      }
    } else if (!groupedFromStudents[c.className].primaryTrack) {
      groupedFromStudents[c.className].primaryTrack = c.track
    }
  })

  const classes = Object.values(groupedFromStudents)
    .map((c: any) => {
      const trackEntries = Object.entries(c.tracks || {}) as Array<[string, number]>
      const topTrack = trackEntries.sort((a, b) => b[1] - a[1])[0]?.[0]
      return { ...c, displayTrack: c.total > 0 ? (topTrack || c.primaryTrack || 'TRACK_1') : (c.primaryTrack || 'TRACK_1') }
    })
    .sort((a: any, b: any) => a.className.localeCompare(b.className))

  const addClass = async (e: React.FormEvent) => {
    e.preventDefault()
    const className = form.className.trim().toUpperCase()
    if (!className) return
    if (savedClasses.some((c) => c.className === className) || classes.some((c: any) => c.className === className)) {
      notify.warning('Class already exists')
      return
    }
    try {
      const created = await schoolClassesApi.create({
        schoolId: school?.id,
        className,
        track: form.primaryTrack,
      })
      setSavedClasses((prev) => [...prev, { className: created.className, track: created.track }])
      setShowAddClass(false)
      setForm({ className: '', primaryTrack: form.primaryTrack })
    } catch (err: any) {
      notify.error(err?.message || 'Failed to create class')
    }
  }

  return (
    <>
      <Modal open={showAddClass} onClose={() => setShowAddClass(false)} title="Add Class">
        <form onSubmit={addClass} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="form-label">Class Name</label>
            <input
              className="form-input"
              placeholder="e.g. SS1A"
              value={form.className}
              onChange={(e) => setForm({ ...form, className: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="form-label">Primary Track</label>
            <select
              className="form-input"
              value={form.primaryTrack}
              onChange={(e) => setForm({ ...form, primaryTrack: e.target.value })}
              style={{ appearance: 'none' }}
            >
              {(trackOptions.length ? trackOptions : [{ code: 'TRACK_1', label: 'Track 1' }, { code: 'TRACK_2', label: 'Track 2' }, { code: 'TRACK_3', label: 'Track 3' }]).map((t) => (
                <option key={t.code} value={t.code}>{t.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn btn-primary btn-sm">Add Class</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAddClass(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      <div className="flex-between mb-20">
        <div>
          <div className="font-display fw-700 text-white" style={{ fontSize: 18 }}>Classes</div>
          <div className="text-muted text-sm">Track and enrollment overview by class</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAddClass(true)}>+ Add Class</button>
      </div>

      {loading ? (
        <div className="card"><p className="text-muted text-sm" style={{ padding: 20 }}>Loading classes…</p></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 16 }}>
          {classes.map((c: any) => (
            <button
              key={c.className}
              className="card"
              style={{ padding: 20, textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)' }}
              onClick={() => onOpenClass(c.className)}
              title={`View ${c.className} students`}
            >
              <div className="flex-between mb-12">
                <div className="font-display fw-700 text-white" style={{ fontSize: 18 }}>{c.className}</div>
                <span className={`badge ${c.displayTrack === 'TRACK_3' ? 'badge-info' : c.displayTrack === 'TRACK_2' ? 'badge-warning' : 'badge-teal'}`}>
                  {c.displayTrack.replace('TRACK_', 'Track ')}
                </span>
              </div>
              <div style={{ fontSize: 28, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--gold)', marginBottom: 4 }}>{c.total}</div>
              <div className="text-muted text-sm" style={{ marginBottom: 12 }}>Total Students</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.keys(c.tracks || {}).length > 0 ? (
                  Object.entries(c.tracks).map(([trackCode, count]) => (
                    <span key={trackCode} className="badge badge-teal">{`${trackCode.replace('TRACK_', 'Track ')}: ${count}`}</span>
                  ))
                ) : (
                  <span className="badge badge-teal">{(c.primaryTrack || 'TRACK_1').replace('TRACK_', 'Track ')}</span>
                )}
              </div>
              <div className="text-muted text-xs" style={{ marginTop: 10 }}>Click card to view attendance →</div>
            </button>
          ))}
          {classes.length === 0 && (
            <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>
              No classes available
            </div>
          )}
        </div>
      )}
    </>
  )
}

function AttendanceSection({
  school,
  selectedClass,
  onClearClass,
  onBackToClasses,
}:{
  school:any,
  selectedClass?: string | null,
  onClearClass?: ()=>void,
  onBackToClasses?: ()=>void,
}) {
  const [className, setClassName] = useState('')
  const [weeks, setWeeks] = useState(12)
  const [weekly, setWeekly] = useState<any[]>([])
  const [classCards, setClassCards] = useState<any[]>([])
  const [classOptions, setClassOptions] = useState<string[]>([])
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadClassOptions = async () => {
      if (!school?.id) {
        setClassOptions([])
        setClassCards([])
        setLoadingClasses(false)
        return
      }
      setLoadingClasses(true)
      if (!school?.id) return
      try {
        const [students, storedClasses] = await Promise.all([
          studentsApi.all({ schoolId: school.id }),
          schoolClassesApi.all(school.id).catch(() => []),
        ])
        const studentArr = Array.isArray(students) ? students : []
        const storedArr = Array.isArray(storedClasses) ? storedClasses : []
        const classes = Array.from(
          new Set([
            ...studentArr.map((s: any) => s.className).filter(Boolean),
            ...storedArr.map((s: any) => s.className).filter(Boolean),
          ])
        ).sort() as string[]
        const studentCountMap = studentArr.reduce((acc: Record<string, number>, s: any) => {
          if (!s?.className) return acc
          acc[s.className] = (acc[s.className] || 0) + 1
          return acc
        }, {})
        const classTrackMap = storedArr.reduce((acc: Record<string, string>, c: any) => {
          if (c?.className && c?.track) acc[c.className] = c.track
          return acc
        }, {})
        setClassOptions(classes)
        setClassCards(
          classes.map((c) => ({
            className: c,
            totalStudents: studentCountMap[c] || 0,
            track: classTrackMap[c] || 'TRACK_1',
          }))
        )
      } catch {
        setClassOptions([])
        setClassCards([])
      } finally {
        setLoadingClasses(false)
      }
    }
    loadClassOptions()
  }, [school?.id])

  useEffect(() => {
    const loadWeekly = async () => {
      if (!school?.id || !className) {
        setWeekly([])
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const data = await attendanceApi.schoolWeekly(school.id, weeks, className)
        setWeekly(Array.isArray(data) ? data : [])
      } catch {
        setWeekly([])
      }
      setLoading(false)
    }
    loadWeekly()
  }, [school?.id, className, weeks])
  useEffect(() => {
    if (selectedClass) setClassName(selectedClass)
  }, [selectedClass])

  const totals = weekly.reduce(
    (acc: any, w: any) => ({
      present: acc.present + (w.present || 0),
      absent: acc.absent + (w.absent || 0),
      late: acc.late + (w.late || 0),
      excused: acc.excused + (w.excused || 0),
      total: acc.total + (w.total || 0),
      markedDays: acc.markedDays + (w.markedDays || 0),
    }),
    { present: 0, absent: 0, late: 0, excused: 0, total: 0, markedDays: 0 }
  )
  const avgRate = totals.total ? Math.round((totals.present / totals.total) * 100) : null

  if (!className) {
    return (
      <div className="card">
        <div className="flex-between mb-24" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="font-display fw-700 text-white" style={{fontSize:18}}>Attendance by Class</div>
            <div className="text-muted text-sm">Select a class card to view weekly attendance details</div>
            <div className="text-muted text-xs mt-4">Tutors take attendance in class. This page is tracking-only.</div>
          </div>
        </div>
        {loadingClasses && <div className="text-muted text-sm">Loading classes…</div>}
        {!loadingClasses && classCards.length === 0 && (
          <div className="text-muted text-sm">No classes found yet.</div>
        )}
        {!loadingClasses && classCards.length > 0 && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,300px))',gap:14,justifyContent:'start'}}>
            {classCards.map((c:any)=>(
              <button
                key={c.className}
                onClick={()=>setClassName(c.className)}
                className="card"
                style={{textAlign:'left',cursor:'pointer',border:'1px solid var(--border2)',padding:16,background:'var(--muted3)',transition:'all .2s ease'}}
              >
                <div className="flex-between mb-12">
                  <div className="font-display fw-700 text-white" style={{ fontSize: 18 }}>{c.className}</div>
                  <span className={`badge ${c.track === 'TRACK_3' ? 'badge-info' : c.track === 'TRACK_2' ? 'badge-warning' : 'badge-teal'}`}>
                    {String(c.track).replace('TRACK_', 'Track ')}
                  </span>
                </div>
                <div style={{ fontSize: 28, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--gold)', marginBottom: 4 }}>{c.totalStudents}</div>
                <div className="text-muted text-sm">Total Students</div>
                <div className="text-muted text-xs" style={{ marginTop: 10 }}>Click to view attendance →</div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex-between mb-24" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="font-display fw-700 text-white" style={{fontSize:18}}>Attendance Tracker</div>
          <div className="text-muted text-sm">Weekly term attendance visibility for school admin</div>
          <div className="text-muted text-xs mt-4">Tutors take attendance in class. This page is tracking-only.</div>
          <div style={{marginTop:10,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <span className="badge badge-info">Class: {className}</span>
            {onBackToClasses && <button onClick={onBackToClasses} className="btn btn-ghost btn-sm">Back to Classes</button>}
            <button onClick={()=>{ setClassName(''); onClearClass?.() }} className="btn btn-ghost btn-sm">Choose Another Class</button>
          </div>
        </div>
        <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
          <select className="form-input" value={className} onChange={e=>setClassName(e.target.value)} style={{appearance:'none',minWidth:140,padding:'10px 14px'}}>
            {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="form-input" value={weeks} onChange={e=>setWeeks(Number(e.target.value))} style={{appearance:'none',minWidth:150,padding:'10px 14px'}}>
            {[4,8,12,16].map(w => <option key={w} value={w}>Last {w} Weeks</option>)}
          </select>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:20}}>
        {[['✅','Present',totals.present,'var(--success)'],
          ['❌','Absent',totals.absent,'var(--danger)'],
          ['⏰','Late',totals.late,'var(--warning)'],
          ['🕊️','Excused',totals.excused,'var(--teal)'],
          ['📊','Avg Rate',avgRate != null ? `${avgRate}%` : '—','var(--gold)'],
        ].map(([icon,label,val,color])=>(
          <div key={label as string} style={{background:'var(--muted3)',border:'1px solid var(--border2)',borderRadius:12,padding:'16px',textAlign:'center'}}>
            <div style={{fontSize:24,marginBottom:8}}>{icon}</div>
            <div style={{fontFamily:'var(--font-display)',fontSize:22,fontWeight:700,color:color as string}}>{val}</div>
            <div style={{fontSize:12,color:'var(--muted)'}}>{label}</div>
          </div>
        ))}
      </div>

      <table className="data-table">
        <thead><tr><th>Week</th><th>Present</th><th>Absent</th><th>Late</th><th>Excused</th><th>Rate</th><th>Marked Days</th></tr></thead>
        <tbody>
          {loading && (
            <tr><td colSpan={7} style={{textAlign:'center',padding:'24px 0',color:'var(--muted)'}}>Loading weekly attendance…</td></tr>
          )}
          {!loading && weekly.length === 0 && (
            <tr><td colSpan={7} style={{textAlign:'center',padding:'24px 0',color:'var(--muted)'}}>No attendance records found for this range</td></tr>
          )}
          {!loading && weekly.map((w:any, i:number)=>(
            <tr key={`${w.weekLabel}-${i}`}>
              <td style={{fontWeight:600,color:'var(--white)'}}>{w.weekLabel}</td>
              <td>{w.present}</td>
              <td>{w.absent}</td>
              <td>{w.late}</td>
              <td>{w.excused}</td>
              <td><strong style={{color:w.rate!=null&&w.rate>=75?'var(--success)':w.rate!=null&&w.rate>=50?'var(--warning)':'var(--danger)'}}>{w.rate != null ? `${w.rate}%` : '—'}</strong></td>
              <td>{w.markedDays || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AnnouncementsSection({school}:{school:any}) {
  const [notices, setNotices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({title:'',body:'',type:'INFO'})

  useEffect(()=>{
    const loadNotices = async () => {
      if (!school?.id) return
      setLoading(true)
      try {
        const d = await noticesApi.all(school.id)
        setNotices(d||[])
      } catch {
        setNotices([])
      }
      setLoading(false)
    }
    loadNotices()
  },[school])

  const postNotice = async (e:React.FormEvent) => {
    e.preventDefault()
    try {
      await noticesApi.create({ ...form, schoolId: school?.id })
      notify.success('Announcement posted')
      setShowAdd(false)
      if (school?.id) noticesApi.all(school.id).then((d: any) => setNotices(d || []))
    } catch (e: any) {
      notify.fromError(e, 'Could not post announcement')
    }
  }
  const deleteNotice = async (id:string) => {
    try { 
      const token = localStorage.getItem('adhara_token')
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL||'http://localhost:3001/api/v1'}/notices/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message || 'Failed to delete announcement')
      }
      setNotices(n=>n.filter((x:any)=>x.id!==id))
      notify.success('Announcement deleted')
    } catch (e: any) {
      notify.fromError(e, 'Could not delete announcement')
    }
  }

  const list = notices
  const typeColor: Record<string,string> = {URGENT:'var(--danger)',IMPORTANT:'var(--gold)',INFO:'var(--teal)'}
  const typeBadge: Record<string,string> = {URGENT:'badge-danger',IMPORTANT:'badge-warning',INFO:'badge-info'}

  return (
    <>
      <Modal open={showAdd} onClose={()=>setShowAdd(false)} title="Post New Announcement">
        <form onSubmit={postNotice} style={{display:'flex',flexDirection:'column',gap:16}}>
          <div><label style={{display:'block',fontSize:12,color:'var(--muted)',marginBottom:6,fontFamily:'var(--font-display)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Type</label>
            <select className="form-input" value={form.type} onChange={e=>setForm({...form,type:e.target.value})} style={{appearance:'none'}}>
              <option value="INFO">Info</option><option value="IMPORTANT">Important</option><option value="URGENT">Urgent</option>
            </select>
          </div>
          <div><label style={{display:'block',fontSize:12,color:'var(--muted)',marginBottom:6,fontFamily:'var(--font-display)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Title</label><input className="form-input" required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Exam postponement notice…"/></div>
          <div><label style={{display:'block',fontSize:12,color:'var(--muted)',marginBottom:6,fontFamily:'var(--font-display)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Message</label><textarea className="form-input" rows={4} required value={form.body} onChange={e=>setForm({...form,body:e.target.value})} style={{resize:'vertical'}} placeholder="Full notice text…"/></div>
          <div style={{display:'flex',gap:12}}>
            <button type="button" onClick={()=>setShowAdd(false)} className="btn btn-ghost" style={{flex:1,justifyContent:'center'}}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{flex:2,justifyContent:'center'}}>Post Notice →</button>
          </div>
        </form>
      </Modal>
      <div className="flex-between mb-20">
        <div>
          <div className="font-display fw-700 text-white" style={{fontSize:18}}>School Announcements</div>
          <div className="text-muted text-sm">Notices visible to parents and students</div>
        </div>
        <button onClick={()=>setShowAdd(true)} className="btn btn-primary btn-sm">+ New Notice</button>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        {loading && (
          <div className="card" style={{textAlign:'center',padding:'24px 0',color:'var(--muted)'}}>Loading announcements…</div>
        )}
        {!loading && list.length===0 && (
          <div className="card" style={{textAlign:'center',padding:'24px 0',color:'var(--muted)'}}>No announcements yet</div>
        )}
        {list.map((n:any)=>(
          <div key={n.id} className="card" style={{borderLeft:`3px solid ${typeColor[n.type]||'var(--teal)'}`}}>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                  <span className={`badge ${typeBadge[n.type]||'badge-info'}`}>{n.type}</span>
                  <span style={{fontSize:12,color:'var(--muted)'}}>{n.publishedAt?new Date(n.publishedAt).toLocaleDateString('en-NG',{month:'short',day:'numeric',year:'numeric'}):''}</span>
                </div>
                <h3 style={{fontFamily:'var(--font-display)',fontWeight:700,color:'var(--white)',fontSize:16,marginBottom:8}}>{n.title}</h3>
                <p style={{fontSize:14,color:'var(--muted)',lineHeight:1.7}}>{n.body}</p>
              </div>
              <button onClick={()=>deleteNotice(n.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',fontSize:18,flexShrink:0,padding:4}} title="Delete notice">🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function SettingsSection({ school, onUpdated }:{ school:any, onUpdated:(next:any)=>void }) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    principalName: '',
    principalPhone: '',
    address: '',
  })
  useEffect(() => {
    setForm({
      name: school?.name || '',
      principalName: school?.principalName || '',
      principalPhone: school?.principalPhone || '',
      address: school?.address || '',
    })
  }, [school])
  const save = async () => {
    if (!school?.id) return
    setSaving(true)
    try {
      const updated = await schoolsApi.update(school.id, form)
      onUpdated(updated)
      setSaved(true)
      setTimeout(()=>setSaved(false),2500)
    } catch (e:any) {
      notify.error(e?.message || 'Unable to save changes')
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="card">
      <div className="font-display fw-700 text-white mb-20" style={{fontSize:16}}>School Profile</div>
      <div style={{display:'flex',flexDirection:'column',gap:16,maxWidth:720}}>
        <div><label style={{display:'block',fontSize:12,color:'var(--muted)',marginBottom:6,fontFamily:'var(--font-display)',textTransform:'uppercase',letterSpacing:'0.06em'}}>School Name</label><input className="form-input" value={form.name} onChange={(e)=>setForm(prev=>({...prev,name:e.target.value}))}/></div>
        <div><label style={{display:'block',fontSize:12,color:'var(--muted)',marginBottom:6,fontFamily:'var(--font-display)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Principal Name</label><input className="form-input" value={form.principalName} onChange={(e)=>setForm(prev=>({...prev,principalName:e.target.value}))}/></div>
        <div><label style={{display:'block',fontSize:12,color:'var(--muted)',marginBottom:6,fontFamily:'var(--font-display)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Phone Number</label><input type="tel" className="form-input" value={form.principalPhone} onChange={(e)=>setForm(prev=>({...prev,principalPhone:e.target.value}))}/></div>
        <div><label style={{display:'block',fontSize:12,color:'var(--muted)',marginBottom:6,fontFamily:'var(--font-display)',textTransform:'uppercase',letterSpacing:'0.06em'}}>School Address</label><input className="form-input" value={form.address} onChange={(e)=>setForm(prev=>({...prev,address:e.target.value}))}/></div>
        <button onClick={save} className="btn btn-primary btn-sm" style={{alignSelf:'flex-start'}} disabled={saving}>{saving?'Saving…':saved?'✓ Saved!':'Save Changes'}</button>
      </div>
    </div>
  )
}

function AdminReportsSection({ school }:{ school:any }) {
  const [loading, setLoading] = useState(false)
  const [reports, setReports] = useState<any[]>([])
  useEffect(() => {
    const load = async () => {
      if (!school?.id) return
      setLoading(true)
      try {
        const data = await reportsApi.all({ schoolId: school.id })
        setReports(Array.isArray(data) ? data : [])
      } catch {
        setReports([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [school?.id])

  return (
    <div className="card">
      <div className="font-display fw-700 text-white mb-20" style={{fontSize:18}}>School Reports</div>
      <table className="data-table">
        <thead><tr><th>Report</th><th>Type</th><th>Status</th><th>Submitted</th></tr></thead>
        <tbody>
          {loading && <tr><td colSpan={4} style={{textAlign:'center',padding:'24px 0',color:'var(--muted)'}}>Loading reports…</td></tr>}
          {!loading && reports.length===0 && <tr><td colSpan={4} style={{textAlign:'center',padding:'24px 0',color:'var(--muted)'}}>No reports available</td></tr>}
          {!loading && reports.map((r:any)=>(
            <tr key={r.id}>
              <td style={{fontWeight:600,color:'var(--white)'}}>{r.title || r.name || 'Untitled Report'}</td>
              <td>{r.type || 'GENERAL'}</td>
              <td><span className={`badge ${r.status==='APPROVED'?'badge-success':r.status==='REJECTED'?'badge-danger':'badge-warning'}`}>{r.status || 'DRAFT'}</span></td>
              <td>{r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('en-NG') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AdminResultsSection({ school }:{ school:any }) {
  const [loading, setLoading] = useState(false)
  const [upcoming, setUpcoming] = useState<any[]>([])
  const [resultRows, setResultRows] = useState<any[]>([])
  const [practicalSummary, setPracticalSummary] = useState({ tasks: 0, submissions: 0, graded: 0, passRate: 0, pending: 0 })
  const [practicalModuleRows, setPracticalModuleRows] = useState<Array<{ module: string; className: string; avgScore: number; passRate: number; submissions: number }>>([])

  useEffect(() => {
    const load = async () => {
      if (!school?.id) return
      setLoading(true)
      try {
        const [scheduled, students, practicalTasksRaw] = await Promise.all([
          examsApi.all({ schoolId: school.id }),
          studentsApi.all({ schoolId: school.id }),
          practicalsApi.listTasks({ schoolId: school.id }).catch(() => []),
        ])
        setUpcoming(Array.isArray(scheduled) ? scheduled : [])
        const map = new Map<string, { exam: string; className: string; date: string; total: number; passed: number; count: number }>()
        ;(Array.isArray(students) ? students : []).forEach((s: any) => {
          ;(s.examAttempts || []).forEach((a: any) => {
            const title = a?.exam?.title || a?.cbtExam?.title || 'Exam'
            const className = s.className || '—'
            const key = `${title}::${className}`
            const existing = map.get(key) || { exam: title, className, date: a?.submittedAt || a?.createdAt || '', total: 0, passed: 0, count: 0 }
            existing.total += Number(a?.score || 0)
            existing.count += 1
            if (Number(a?.score || 0) >= 50) existing.passed += 1
            if (!existing.date || new Date(a?.submittedAt || 0).getTime() > new Date(existing.date || 0).getTime()) {
              existing.date = a?.submittedAt || a?.createdAt || existing.date
            }
            map.set(key, existing)
          })
        })
        const rows = Array.from(map.values()).map((r) => ({
          ...r,
          avgScore: r.count ? Math.round(r.total / r.count) : 0,
          passRate: r.count ? Math.round((r.passed / r.count) * 100) : 0,
        }))
        rows.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
        setResultRows(rows.slice(0, 10))

        const practicalTasks = Array.isArray(practicalTasksRaw) ? practicalTasksRaw : []
        if (!practicalTasks.length) {
          setPracticalSummary({ tasks: 0, submissions: 0, graded: 0, passRate: 0, pending: 0 })
          setPracticalModuleRows([])
        } else {
          const submissionsByTask = await Promise.all(practicalTasks.map((t: any) => practicalsApi.submissions(t.id).catch(() => [])))
          const allSubmissions = submissionsByTask.flat()
          const gradedSubs = allSubmissions.filter((s: any) => typeof s?.totalScore === 'number')
          const passedSubs = gradedSubs.filter((s: any) => String(s?.status || '').toUpperCase() === 'PASSED')
          const pending = allSubmissions.length - gradedSubs.length
          const passRate = gradedSubs.length ? Math.round((passedSubs.length / gradedSubs.length) * 100) : 0
          setPracticalSummary({
            tasks: practicalTasks.length,
            submissions: allSubmissions.length,
            graded: gradedSubs.length,
            passRate,
            pending: Math.max(0, pending),
          })

          const moduleMap = new Map<string, { module: string; className: string; total: number; passed: number; count: number }>()
          practicalTasks.forEach((task: any, idx: number) => {
            const moduleLabel = task?.module ? `Module ${task.module.number}: ${task.module.title}` : (task?.title || 'Practical')
            const className = task?.className || '—'
            const submissions = (Array.isArray(submissionsByTask[idx]) ? submissionsByTask[idx] : []).filter((s: any) => typeof s?.totalScore === 'number')
            if (!submissions.length) return
            const key = `${moduleLabel}::${className}`
            const existing = moduleMap.get(key) || { module: moduleLabel, className, total: 0, passed: 0, count: 0 }
            submissions.forEach((s: any) => {
              const score = Number(s.totalScore || 0)
              existing.total += score
              existing.count += 1
              if (String(s?.status || '').toUpperCase() === 'PASSED') existing.passed += 1
            })
            moduleMap.set(key, existing)
          })
          const moduleRows = Array.from(moduleMap.values())
            .map((r) => ({
              module: r.module,
              className: r.className,
              submissions: r.count,
              avgScore: r.count ? Math.round(r.total / r.count) : 0,
              passRate: r.count ? Math.round((r.passed / r.count) * 100) : 0,
            }))
            .sort((a, b) => b.avgScore - a.avgScore)
          setPracticalModuleRows(moduleRows.slice(0, 8))
        }
      } catch {
        setUpcoming([])
        setResultRows([])
        setPracticalSummary({ tasks: 0, submissions: 0, graded: 0, passRate: 0, pending: 0 })
        setPracticalModuleRows([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [school?.id])

  return (
    <div className="card">
      <div className="font-display fw-700 text-white mb-20" style={{fontSize:18}}>Results & Exam Schedule</div>
      <div style={{marginBottom:24}}>
        <div style={{fontFamily:'var(--font-display)',fontWeight:600,color:'var(--white)',fontSize:15,marginBottom:12}}>Upcoming Exams</div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {loading && <div className="text-muted text-sm">Loading exams…</div>}
          {!loading && upcoming.length===0 && <div className="text-muted text-sm">No scheduled exams yet.</div>}
          {!loading && upcoming.slice(0,5).map((e:any)=>(
            <div key={e.id || `${e.title}-${e.scheduledAt}`} style={{padding:'18px 20px',background:'var(--muted3)',border:'1px solid var(--border2)',borderRadius:12,display:'flex',alignItems:'center',gap:16}}>
              <div style={{fontSize:32}}>📝</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,color:'var(--white)',marginBottom:4}}>{e.title}</div>
                <div style={{fontSize:13,color:'var(--muted)',marginBottom:6}}>{e.scheduledAt ? new Date(e.scheduledAt).toLocaleString('en-NG') : 'Date not set'}</div>
                <div style={{fontSize:12,color:'var(--teal2)'}}>📍 {e.venue || 'Venue not set'}</div>
              </div>
              <span className="badge badge-info">{e.className || 'All classes'}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{fontFamily:'var(--font-display)',fontWeight:600,color:'var(--white)',fontSize:15,marginBottom:12}}>Recent Results</div>
      <table className="data-table">
        <thead><tr><th>Exam</th><th>Class</th><th>Date</th><th>Avg Score</th><th>Pass Rate</th></tr></thead>
        <tbody>
          {loading && <tr><td colSpan={5} style={{textAlign:'center',padding:'24px 0',color:'var(--muted)'}}>Loading results…</td></tr>}
          {!loading && resultRows.length===0 && <tr><td colSpan={5} style={{textAlign:'center',padding:'24px 0',color:'var(--muted)'}}>No submitted exam results yet</td></tr>}
          {!loading && resultRows.map((r)=>(
            <tr key={`${r.exam}-${r.className}`}>
              <td>{r.exam}</td>
              <td>{r.className}</td>
              <td>{r.date ? new Date(r.date).toLocaleDateString('en-NG') : '—'}</td>
              <td><strong style={{color:r.avgScore>=50?'var(--success)':'var(--danger)'}}>{r.avgScore}%</strong></td>
              <td><strong style={{color:r.passRate>=70?'var(--gold)':'var(--muted)'}}>{r.passRate}%</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="divider mt-20 mb-16"></div>
      <div style={{fontFamily:'var(--font-display)',fontWeight:600,color:'var(--white)',fontSize:15,marginBottom:12}}>Practical Performance</div>
      <div className="stats-row" style={{gridTemplateColumns:'repeat(5,1fr)',marginBottom:16}}>
        <StatCard icon="🧪" value={practicalSummary.tasks} label="Practical Tasks" glowColor="#A78BFA" />
        <StatCard icon="📥" value={practicalSummary.submissions} label="Submissions" glowColor="var(--teal)" />
        <StatCard icon="✅" value={practicalSummary.graded} label="Graded" glowColor="var(--success)" />
        <StatCard icon="📈" value={`${practicalSummary.passRate}%`} label="Pass Rate" glowColor="var(--gold)" />
        <StatCard icon="⌛" value={practicalSummary.pending} label="Pending Grading" glowColor="var(--warning)" />
      </div>
      <table className="data-table">
        <thead><tr><th>Module Practical</th><th>Class</th><th>Submissions</th><th>Avg Score</th><th>Pass Rate</th></tr></thead>
        <tbody>
          {loading && <tr><td colSpan={5} style={{textAlign:'center',padding:'24px 0',color:'var(--muted)'}}>Loading practical performance…</td></tr>}
          {!loading && practicalModuleRows.length===0 && <tr><td colSpan={5} style={{textAlign:'center',padding:'24px 0',color:'var(--muted)'}}>No graded practical submissions yet</td></tr>}
          {!loading && practicalModuleRows.map((r)=>(
            <tr key={`${r.module}-${r.className}`}>
              <td>{r.module}</td>
              <td>{r.className}</td>
              <td>{r.submissions}</td>
              <td><strong style={{color:r.avgScore>=50?'var(--success)':'var(--danger)'}}>{r.avgScore}%</strong></td>
              <td><strong style={{color:r.passRate>=70?'var(--gold)':'var(--muted)'}}>{r.passRate}%</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────
// ── BULK UPLOAD ─────────────────────────────────────────────────────────
function BulkUpload({ school }: { school: any }) {
  const { data: tracksData } = useQuery({
    queryKey: ['admin', 'tracks-options'],
    queryFn: () => tracksApi.all(),
    staleTime: 60_000,
    retry: 1,
  })
  const trackOptions = (Array.isArray(tracksData) ? tracksData : [])
    .filter((t: any) => t.isActive !== false)
    .map((t: any) => ({ code: String(t.code), label: String(t.name || String(t.code).replace('TRACK_', 'Track ')) }))
  const [csv, setCsv] = useState('')
  const resolvedTermLabel = (() => {
    const y = String(school?.academicYearLabel || '').trim()
    const t = String(school?.currentTermLabel || '').trim()
    const joined = [y, t].filter(Boolean).join(' ').trim()
    return joined || '2025/2026 Term 2'
  })()
  const [defaults, setDefaults] = useState({ className: 'SS3A', track: '', termLabel: resolvedTermLabel })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [progress, setProgress] = useState<{ total: number; done: number; succeeded: number; failed: number } | null>(null)
  useEffect(() => {
    if (!trackOptions.length) return
    if (!trackOptions.some((t) => t.code === defaults.track)) {
      setDefaults((prev) => ({ ...prev, track: trackOptions[0].code }))
    }
  }, [JSON.stringify(trackOptions), defaults.track])
  useEffect(() => {
    setDefaults((prev) => ({ ...prev, termLabel: resolvedTermLabel }))
  }, [resolvedTermLabel])

  const run = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setResult(null); setProgress(null)
    try {
      // Upload in small batches so the UI can show progress.
      const lines = csv
        .trim()
        .split(/\r?\n/)
        .filter((l) => l.trim().length > 0)
      if (lines.length < 2) {
        notify.warning('CSV must include a header and at least one student row')
        setLoading(false)
        return
      }
      const header = lines[0]
      const rows = lines.slice(1)
      const total = rows.length
      const BATCH_SIZE = 20
      let done = 0
      let succeeded = 0
      let failed = 0
      const combinedResults: any[] = []
      setProgress({ total, done, succeeded, failed })

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE)
        const batchCsv = [header, ...batch].join('\n')
        const r = await bulkUploadApi.csv(batchCsv, school?.id || '', defaults)
        const batchSucceeded = typeof (r as any)?.succeeded === 'number' ? (r as any).succeeded : 0
        const batchFailed = typeof (r as any)?.failed === 'number' ? (r as any).failed : 0
        const batchResults = Array.isArray((r as any)?.results) ? (r as any).results : []
        combinedResults.push(...batchResults)
        done += batch.length
        succeeded += batchSucceeded
        failed += batchFailed
        setProgress({ total, done, succeeded, failed })
      }

      const final = { total, succeeded, failed, results: combinedResults }
      setResult(final)
      notify.success(succeeded > 0 ? `Uploaded ${succeeded} students successfully` : 'Bulk upload completed')
    } catch (e: any) {
      notify.fromError(e)
    }
    setLoading(false)
  }

  const TEMPLATE = 'fullName\nAli Chidera Samuel\nEmeka Chukwuemeka Okorie\nSafiya Maryam Mohammed'

  return (
    <div>
      <div className="flex-between mb-20"><div><h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Bulk Student Upload</h3><div className="text-muted text-sm">Upload multiple students from CSV — welcome emails sent automatically</div></div></div>
      <div className="content-grid">
        <div className="card">
          <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 15 }}>Upload CSV</div>
          <form onSubmit={run} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div><label className="form-label">Default Class</label>
                <select className="form-input" value={defaults.className} onChange={e => setDefaults({ ...defaults, className: e.target.value })} style={{ appearance: 'none' }}>
                  {['JSS1A','JSS1B','JSS2A','SS1A','SS1B','SS2A','SS3A','SS3B'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="form-label">Default Track</label>
                <select className="form-input" value={defaults.track} onChange={e => setDefaults({ ...defaults, track: e.target.value })} style={{ appearance: 'none' }}>
                  {(trackOptions.length ? trackOptions : [{ code: 'TRACK_1', label: 'Track 1' }, { code: 'TRACK_2', label: 'Track 2' }, { code: 'TRACK_3', label: 'Track 3' }]).map((t) => (
                    <option key={t.code} value={t.code}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div><label className="form-label">Term Label</label><input className="form-input" value={defaults.termLabel} onChange={e => setDefaults({ ...defaults, termLabel: e.target.value })} /></div>
            </div>
            <div>
              <label className="form-label">CSV Data</label>
              <textarea className="form-input" rows={10} required placeholder={TEMPLATE} value={csv} onChange={e => setCsv(e.target.value)} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' }} />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>CSV columns: fullName (recommended) or firstName,lastName. Optional: email, username, phone, className, track</div>
            </div>
            {progress && (
              <div className="text-muted text-xs" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span><strong style={{ color: 'var(--white)' }}>Progress:</strong> {progress.done}/{progress.total}</span>
                <span><strong style={{ color: 'var(--success)' }}>Succeeded:</strong> {progress.succeeded}</span>
                <span><strong style={{ color: 'var(--danger)' }}>Failed:</strong> {progress.failed}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? (progress ? `Uploading ${progress.done}/${progress.total}…` : 'Uploading…') : `Upload Students →`}
              </button>
              <button type="button" onClick={() => setCsv(TEMPLATE)} className="btn btn-ghost btn-sm">Load Example</button>
            </div>
          </form>
        </div>
        {result && (
          <div className="card">
            <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 15 }}>Upload Results</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[{ l: 'Total', v: result.total, c: 'var(--white)' }, { l: 'Succeeded', v: result.succeeded, c: 'var(--success)' }, { l: 'Failed', v: result.failed, c: 'var(--danger)' }].map(s => (
                <div key={s.l} style={{ textAlign: 'center', padding: 16, background: 'var(--muted3)', borderRadius: 10 }}><div style={{ fontSize: 24, fontFamily: 'var(--font-display)', fontWeight: 700, color: s.c }}>{s.v}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.l}</div></div>
              ))}
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {result.results?.map((r: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border2)' }}>
                  <span style={{ fontSize: 16 }}>{r.success ? '✅' : '❌'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--white)' }}>
                      {r.name || r.username || r.email || 'Student'}
                    </div>
                    {r.row && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Row {r.row}</div>}
                    {r.regNumber && <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--teal2)' }}>{r.regNumber}</div>}
                    {r.error && <div style={{ fontSize: 11, color: 'var(--danger)' }}>{r.error}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── PAYSTACK PAYMENTS ─────────────────────────────────────────────────────
function AdminPayments({ school }: { school: any }) {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState<string | null>(null)

  useEffect(() => {
    if (!school?.id) return
    paymentsApi.all({ schoolId: school.id }).then(d => setPayments(Array.isArray(d) ? d : [])).catch(() => setPayments([])).finally(() => setLoading(false))
  }, [school?.id])

  const pay = async (paymentId: string) => {
    setPaying(paymentId)
    try {
      const res = await paystackApi.initialize(paymentId)
      if (res?.data?.authorization_url) window.open(res.data.authorization_url, '_blank')
      else notify.info('Payment link: ' + JSON.stringify(res))
    } catch (e: any) { notify.fromError(e) }
    setPaying(null)
  }

  const total = payments.reduce((s, p) => s + p.amount, 0)
  const paid = payments.filter(p => p.isPaid).reduce((s, p) => s + p.amount, 0)

  return (
    <div>
      <div className="flex-between mb-20"><div><h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Payments</h3><div className="text-muted text-sm">School fee invoices from AdharaEdu</div></div></div>
      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 24 }}>
        {[{ glow: 'var(--gold)', icon: '💰', bg: 'rgba(212,168,83,0.15)', val: `₦${(total/1000).toFixed(0)}k`, label: 'Total Invoiced', trend: 'This term' },
          { glow: 'var(--success)', icon: '✅', bg: 'rgba(34,197,94,0.15)', val: `₦${(paid/1000).toFixed(0)}k`, label: 'Paid', trend: `${payments.filter(p => p.isPaid).length} invoices`, up: true },
          { glow: 'var(--danger)', icon: '⏳', bg: 'rgba(239,68,68,0.15)', val: `₦${((total-paid)/1000).toFixed(0)}k`, label: 'Outstanding', trend: `${payments.filter(p => !p.isPaid).length} invoices` },
        ].map(s => <div key={s.label} className="stat-card"><div className="stat-glow" style={{ background: s.glow }}></div><div className="stat-card-icon" style={{ background: s.bg }}>{s.icon}</div><div className="stat-card-value">{s.val}</div><div className="stat-card-label">{s.label}</div><span className={`stat-card-trend${s.up ? ' trend-up' : ''}`}>{s.trend}</span></div>)}
      </div>
      {loading ? <p className="text-muted text-sm" style={{ padding: 20 }}>Loading…</p> : (
        <div className="card">
          <table className="data-table">
            <thead><tr><th>Description</th><th>Term</th><th>Amount</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
            <tbody>
              {payments.map((p: any) => (
                <tr key={p.id}>
                  <td style={{ color: 'var(--white)' }}>{p.description}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{p.termLabel}</td>
                  <td><strong style={{ color: 'var(--white)' }}>₦{(p.amount||0).toLocaleString()}</strong></td>
                  <td><span className={`badge badge-${p.isPaid ? 'success' : 'warning'}`}>{p.isPaid ? 'Paid' : 'Pending'}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                  <td>{!p.isPaid && <button onClick={() => pay(p.id)} className="btn btn-primary btn-sm" style={{ fontSize: 11 }} disabled={paying === p.id}>{paying === p.id ? '...' : 'Pay via Paystack'}</button>}</td>
                </tr>
              ))}
              {payments.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>No invoices yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── CERTIFICATES MANAGEMENT (admin) ────────────────────────────────────────
function AdminCertificates({ school }: { school: any }) {
  const [certs, setCerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [issuing, setIssuing] = useState<string | null>(null)
  const [eligible, setEligible] = useState<any[]>([])
  const [loadingEligible, setLoadingEligible] = useState(true)

  useEffect(() => {
    if (!school?.id) return
    certificatesApi.bySchool(school.id).then(d => setCerts(Array.isArray(d) ? d : [])).catch(() => setCerts([])).finally(() => setLoading(false))
    // Get top students with completed modules
    schoolsApi.topStudents().then(d => setEligible(Array.isArray(d) ? d.filter((s: any) => s.averageScore >= 50) : [])).catch(() => setEligible([])).finally(() => setLoadingEligible(false))
  }, [school?.id])

  const issue = async (studentId: string, track: string) => {
    setIssuing(studentId)
    try { const c = await certificatesApi.issue(studentId, track); setCerts(prev => [c, ...prev]); notify.success('Certificate issued! ✓') } catch (e: any) { notify.fromError(e) }
    setIssuing(null)
  }

  return (
    <div>
      <div className="flex-between mb-20"><div><h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Certificates</h3><div className="text-muted text-sm">Issue and manage student completion certificates</div></div></div>
      <div className="content-grid">
        <div className="card">
          <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 15 }}>Eligible Students</div>
          {loadingEligible && <p className="text-muted text-sm">Loading…</p>}
          {eligible.map((s: any, i: number) => {
            const name = `${s.user?.firstName} ${s.user?.lastName}`
            const hasCert = certs.some((c: any) => c.studentId === s.id)
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border2)' }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--white)' }}>{name}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.averageScore}% avg · {s.track?.replace('TRACK_','Track ')}</div></div>
                {hasCert ? <span className="badge badge-success">✓ Issued</span> : <button onClick={() => issue(s.id, s.track)} className="btn btn-primary btn-sm" style={{ fontSize: 11 }} disabled={issuing === s.id}>{issuing === s.id ? '…' : 'Issue Cert'}</button>}
              </div>
            )
          })}
          {!loadingEligible && eligible.length === 0 && <p className="text-muted text-sm">No eligible students yet.</p>}
        </div>
        <div className="card">
          <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 15 }}>Issued Certificates</div>
          {loading && <p className="text-muted text-sm">Loading…</p>}
          {certs.map((c: any) => (
            <div key={c.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontWeight: 600, color: 'var(--white)', fontSize: 13 }}>{c.student?.user?.firstName} {c.student?.user?.lastName}</div>
                <span className={`badge badge-${c.isValid ? 'success' : 'danger'}`}>{c.isValid ? 'Valid' : 'Revoked'}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>{c.serialNumber}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{c.track?.replace('TRACK_','Track ')} · {c.score}% · {new Date(c.issueDate).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
            </div>
          ))}
          {!loading && certs.length === 0 && <p className="text-muted text-sm">No certificates issued yet.</p>}
        </div>
      </div>
    </div>
  )
}


function AdminDashboardInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [section, setSection] = useState('overview')
  const [school, setSchool] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [topStudents, setTopStudents] = useState<any[]>([])
  const [attendanceData, setAttendanceData] = useState<any[]>([])
  const [notices, setNotices] = useState<any[]>([])
  const [upcomingExams, setUpcomingExams] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const { data: adminPayments } = useQuery({
    queryKey: ['admin', 'payments-badge', school?.id],
    queryFn: () => paymentsApi.all({ schoolId: school?.id }),
    enabled: !!school?.id,
    staleTime: 30_000,
    retry: 1,
  })
  const { data: adminTutorsRaw, isLoading: loadingTutors } = useQuery({
    queryKey: ['admin', 'assigned-tutors', school?.id],
    queryFn: () => tutorsApi.all(),
    enabled: !!school?.id,
    staleTime: 30_000,
    retry: 1,
  })

  useEffect(()=>{
    const loadData = async () => {
      try {
        const s = await schoolsApi.mine(); setSchool(s)
        const st = await schoolsApi.myStats(); setStats(st)
        const ts = await schoolsApi.topStudents(); setTopStudents(ts||[])
        const n = await noticesApi.all(s.id); setNotices(n||[])
        const e = await examsApi.upcoming(s.id); setUpcomingExams(e||[])
      } catch(e) {
        setSchool(null)
        setStats(null)
        setTopStudents([])
        setNotices([])
        setUpcomingExams([])
      }
    }
    loadData()
  },[])

  useEffect(() => {
    const s = searchParams.get('section')
    if (s) setSection(s)
  }, [searchParams])

  const titles: Record<string,string> = {
    overview:'School Overview',students:'Students',classes:'Classes',attendance:'Attendance',
    results:'Results & Exams',payments:'Payments & Fees',tutors:'Tutors',
    payroll:'Tutor Payroll',announcements:'Announcements',certificates:'Certificates',
    reports:'Reports',settings:'Settings', 'bulk-upload':'Bulk Upload',
    'class-insights':'Class performance',
    'school-profile':'School profile',
  }

  const pendingPayments = Array.isArray(adminPayments) ? adminPayments.filter((p: any) => !p.isPaid).length : 0
  /** Backend returns only tutors assigned to this school (sanitized). */
  const assignedTutors = Array.isArray(adminTutorsRaw) ? adminTutorsRaw : []
  const navBadges = {
    students: stats?.totalStudents ?? null,
    payments: !school?.id ? null : pendingPayments,
    announcements: notices.length > 0 ? notices.length : null,
    tutors: !school?.id || loadingTutors ? null : assignedTutors.length,
  }

  const renderSection = () => {
    switch(section) {
      case 'students': return <StudentsSection school={school} selectedClass={selectedClass} onClearClass={()=>setSelectedClass(null)} onBackToClasses={()=>setSection('classes')}/>
      case 'classes': return <ClassesSection school={school} onOpenClass={(className)=>{ setSelectedClass(className); setSection('attendance') }}/>
      case 'attendance': return (
        <AttendanceSection
          school={school}
          selectedClass={selectedClass}
          onClearClass={()=>setSelectedClass(null)}
          onBackToClasses={()=>setSection('classes')}
        />
      )
      case 'payments': return <AdminPayments school={school}/>
      case 'announcements': return <AnnouncementsSection school={school}/>
      case 'certificates': return <AdminCertificates school={school}/>
      case 'bulk-upload': return <BulkUpload school={school}/>
      case 'reports': return <AdminReportsSection school={school}/>
      case 'school-profile': return <SchoolProfileView school={school} />
      case 'settings': return <SettingsSection school={school} onUpdated={setSchool}/>
      case 'tutors': return (
        <div>
          <div className="font-display fw-700 text-white mb-8" style={{ fontSize: 18 }}>Our tutors</div>
          <p className="text-muted text-sm mb-20" style={{ maxWidth: 560 }}>
            Tutors assigned to your school. Click a card for profile, classes, and verification summary (sensitive documents stay with AdharaEdu).
          </p>
          {loadingTutors && <div className="text-muted text-sm mb-12">Loading tutors…</div>}
          {!loadingTutors && assignedTutors.length === 0 && (
            <div className="card text-muted text-sm" style={{ padding: '32px 20px', textAlign: 'center' }}>No tutors assigned to this school yet.</div>
          )}
          {!loadingTutors && assignedTutors.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {assignedTutors.map((t: any) => {
                const name = `${t.user?.firstName || ''} ${t.user?.lastName || ''}`.trim() || 'Unnamed Tutor'
                const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                const asg = (t.assignments || []).filter((a: any) => a?.isActive !== false)
                const classesText = asg.map((a: any) => a.className).join(' · ') || '—'
                const tracksText = Array.from(new Set(asg.map((a: any) => String(a.track || '').replace('TRACK_', 'Track ')))).join(' / ') || '—'
                const onboard = t.onboardingStatus === 'COMPLETE' ? 'complete' : t.onboardingStatus === 'DRAFT' ? 'draft' : '—'
                return (
                  <div
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    className="card"
                    style={{ cursor: 'pointer', border: '1px solid var(--border2)' }}
                    onClick={() => router.push(`/dashboard/admin/tutors/${t.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        router.push(`/dashboard/admin/tutors/${t.id}`)
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
                      <div
                        className="stu-av"
                        style={{
                          width: 48,
                          height: 48,
                          fontSize: 16,
                          background: 'linear-gradient(135deg,rgba(212,168,83,0.35),rgba(26,127,212,0.35))',
                          color: 'var(--white)',
                          flexShrink: 0,
                        }}
                      >
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="font-display fw-700 text-white" style={{ fontSize: 15 }}>{name}</div>
                        <div className="text-xs text-muted" style={{ wordBreak: 'break-all' }}>{t.user?.email}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      <span className={`badge badge-${t.isVerified ? 'success' : 'warning'}`} style={{ fontSize: 10 }}>{t.isVerified ? 'Verified' : 'Pending'}</span>
                      {onboard === 'complete' && <span className="badge badge-teal" style={{ fontSize: 10 }}>Profile complete</span>}
                      {onboard === 'draft' && <span className="badge badge-warning" style={{ fontSize: 10 }}>Profile draft</span>}
                      <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 12 }}>★ {t.rating ?? '—'}</span>
                    </div>
                    <div className="text-xs text-muted mb-4">Classes at your school</div>
                    <div className="text-sm text-white mb-4">{classesText}</div>
                    <div className="text-xs text-muted">{tracksText}</div>
                    <div className="text-xs text-muted mt-12">Click for full profile</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )
      case 'results': return <AdminResultsSection school={school}/>
      case 'class-insights': return (
        <div>
          <div className="font-display fw-700 text-white mb-8" style={{ fontSize: 18 }}>Class performance</div>
          <p className="text-muted text-sm mb-20" style={{ maxWidth: 640, lineHeight: 1.5 }}>
            Roll-up for any class at your school: attendance, module progress, and graded work averages.
          </p>
          {school?.id ? <ClassPerformancePanel schoolIdForFetch={school.id} /> : <p className="text-muted text-sm">Loading school…</p>}
        </div>
      )
      default: return <Overview school={school} stats={stats} topStudents={topStudents} attendanceData={attendanceData} notices={notices} upcomingExams={upcomingExams} onAddStudent={()=>setShowAdd(true)}/>
    }
  }

  return (
    <DashboardShell role="admin" title={titles[section]||'Dashboard'} subtitle="Crown Heights Secondary School · Term 2, 2026" section={section} onSectionChange={setSection}
      navBadges={navBadges}
      topbarRight={
        section === 'school-profile' ? (
          <Link href="/dashboard/admin/complete-school-profile" className="btn btn-primary btn-sm">
            Edit full profile
          </Link>
        ) : null
      }>
      {renderSection()}
    </DashboardShell>
  )
}

export default function AdminDashboard() {
  return (
    <Suspense
      fallback={(
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy)' }}>
          <p className="text-muted">Loading…</p>
        </div>
      )}
    >
      <AdminDashboardInner />
    </Suspense>
  )
}
