'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { DashboardShell } from '@/components/DashboardShell'
import { ClassPerformancePanel } from '@/components/ClassPerformancePanel'
import type { ClassPerformanceChoice } from '@/components/ClassPerformancePanel'
import { TutorProfileDetail } from '@/components/TutorProfileDetail'
import {
  tutorsApi, attendanceApi, cbtApi, reportsApi,
  lessonsApi, messagesApi, studentsApi, usersApi, uploadsApi,
  sessionsApi, assignmentsApi, examSchedulesApi, payrollApi, bulkUploadApi, modulesApi, schoolClassesApi, tracksApi, practicalsApi
} from '@/lib/api'
import { notify } from '@/lib/notify'

// ─── types ───────────────────────────────────────────────────
interface Student { id: string; name: string; reg: string; className: string; avg: number; att: number; atRisk: boolean; init: string; c: string; tc: string }
interface TutorStats { activeSchools: number; totalStudents: number; submittedReports: number; pendingReports: number; cbtExams: number; rating: number }

// ─── helpers ─────────────────────────────────────────────────
function initials(name: string) { return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() }
const COLORS = ['rgba(212,168,83,0.2)','rgba(26,127,212,0.2)','rgba(139,92,246,0.2)','rgba(34,197,94,0.2)','rgba(239,68,68,0.2)','rgba(245,158,11,0.2)']
const TEXT_COLORS = ['var(--gold)','var(--teal2)','#A78BFA','#4ADE80','#F87171','#FCD34D']
function studentColor(i: number) {
  return {
    background: COLORS[i % COLORS.length],
    color: TEXT_COLORS[i % TEXT_COLORS.length],
  }
}

// ─── OVERVIEW ─────────────────────────────────────────────────
function TutorOverview({ stats, classes, onSection }: { stats: TutorStats | null; classes: any[]; onSection: (s: string) => void }) {
  const todayClass = classes[0]
  const students = classes.flatMap(c => c.students || [])
  const atRisk = students.filter((s: any) => {
    const scores = s.moduleProgress?.map((p: any) => p.score).filter(Boolean) || []
    const avg = scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0
    return avg < 50 && avg > 0
  }).slice(0, 3)

  return (<>
    <div className="stats-row">
      {[
        { glow: 'var(--gold)', icon: '👥', bg: 'rgba(212,168,83,0.15)', val: stats?.totalStudents ?? '—', label: 'My Students', trend: classes.map(c => c.className).join(' & ') || 'No classes yet' },
        { glow: 'var(--teal)', icon: '📅', bg: 'rgba(26,127,212,0.15)', val: stats?.activeSchools ?? '—', label: 'Active Schools', trend: 'This term', up: true },
        { glow: 'var(--success)', icon: '📊', bg: 'rgba(34,197,94,0.15)', val: stats?.rating ? `${stats.rating}/5` : '—', label: 'Tutor Rating', trend: 'AdharaEdu score', up: true },
        { glow: 'var(--warning)', icon: '📋', bg: 'rgba(245,158,11,0.15)', val: stats?.pendingReports ?? 0, label: 'Reports Due', trend: 'Submit before Friday' },
      ].map(s => (
        <div key={s.label} className="stat-card">
          <div className="stat-glow" style={{ background: s.glow }}></div>
          <div className="stat-card-icon" style={{ background: s.bg }}>{s.icon}</div>
          <div className="stat-card-value">{s.val}</div>
          <div className="stat-card-label">{s.label}</div>
          <span className={`stat-card-trend${s.up ? ' trend-up' : ''}`}>{s.trend}</span>
        </div>
      ))}
    </div>

    <div className="content-grid-3">
      <div className="card">
        <div className="flex-between mb-20">
          <div className="font-display fw-700 text-white" style={{ fontSize: 16 }}>Today&apos;s Sessions</div>
          <span className="badge badge-teal">{new Date().toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
        {classes.length === 0 && <p className="text-muted text-sm">No classes assigned yet.</p>}
        {classes.slice(0, 2).map((cls: any, i: number) => (
          <div key={i} style={{ border: `1px solid ${i === 0 ? 'var(--border)' : 'var(--border2)'}`, borderRadius: 'var(--radius-sm)', padding: 16, display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12, opacity: i === 0 ? 1 : 0.6 }}>
            <div style={{ textAlign: 'center', minWidth: 48 }}>
              <div className="font-display fw-700 text-gold" style={{ fontSize: 18 }}>{i === 0 ? '9' : '2'}</div>
              <div className="text-xs text-muted">{i === 0 ? 'AM' : 'PM'}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div className="text-sm fw-700 text-white mb-4">{cls.className} — {cls.track?.replace('TRACK_', 'Track ')}</div>
              <div className="text-xs text-muted">{cls.school?.name} · {cls.students?.length || 0} students</div>
            </div>
            <button onClick={() => onSection('tutor-attendance')} className={`btn btn-sm ${i === 0 ? 'btn-primary' : 'btn-ghost'}`}>{i === 0 ? 'Start Session' : 'Upcoming'}</button>
          </div>
        ))}
        <div className="divider"></div>
        <div className="font-display fw-700 text-white mb-12" style={{ fontSize: 14 }}>Quick Actions</div>
        {[
          { icon: '✅', label: "Mark Attendance", section: 'tutor-attendance', color: 'var(--success)' },
          { icon: '📝', label: 'Assignments', section: 'tutor-assignments', color: 'var(--gold)' },
          { icon: '🧪', label: 'Practical Assessments', section: 'tutor-practicals', color: '#A78BFA' },
          { icon: '🖥️', label: 'Build CBT Assessment', section: 'tutor-cbt', color: 'var(--teal2)' },
          { icon: '📋', label: 'Submit Weekly Report', section: 'tutor-report', color: 'var(--gold)' },
          { icon: '📚', label: 'Lesson Plans', section: 'tutor-lessons', color: '#A78BFA' },
        ].map(a => (
          <button key={a.label} onClick={() => onSection(a.section)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'var(--muted3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', marginBottom: 8, color: 'var(--white)', textAlign: 'left', transition: 'border-color 0.2s', fontSize: 13 }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = a.color)} onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border2)')}>
            <span style={{ fontSize: 16 }}>{a.icon}</span>{a.label}<span style={{ marginLeft: 'auto', color: 'var(--muted)' }}>→</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card">
          <div className="font-display fw-700 text-white mb-16" style={{ fontSize: 14 }}>⚠️ At-Risk Students</div>
          {atRisk.length === 0 && <p className="text-muted text-sm">No at-risk students — great work!</p>}
          {atRisk.map((s: any, i: number) => {
            const scores = s.moduleProgress?.map((p: any) => p.score).filter(Boolean) || []
            const avg = scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0
            const name = `${s.user?.firstName} ${s.user?.lastName}`
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border2)' }}>
                <div className="stu-av" style={{ ...studentColor(i), width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-display)', flexShrink: 0 }}>{initials(name)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--white)' }}>{name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{avg}% avg</div>
                </div>
                <button onClick={() => onSection('tutor-messages')} className="btn btn-ghost btn-sm" style={{ fontSize: 10 }}>Message</button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  </>)
}

function TutorClasses({
  classes,
  onClassesChange,
  onOpenClass,
}: {
  classes: any[]
  onClassesChange: React.Dispatch<React.SetStateAction<any[]>>
  onOpenClass: (className: string) => void
}) {
  const [showAddClass, setShowAddClass] = useState(false)
  const [savingClass, setSavingClass] = useState(false)
  const [classForm, setClassForm] = useState({ className: '', track: 'TRACK_1' })
  const { data: dynamicTracks } = useQuery({
    queryKey: ['tutor', 'tracks-options'],
    queryFn: () => tracksApi.all(),
    staleTime: 60_000,
    retry: 1,
  })
  const trackOptions = (Array.isArray(dynamicTracks) ? dynamicTracks : [])
    .filter((t: any) => t.isActive !== false)
    .map((t: any) => ({ code: String(t.code), label: String(t.name || String(t.code).replace('TRACK_', 'Track ')) }))
  useEffect(() => {
    if (!trackOptions.length) return
    if (!trackOptions.some((t) => t.code === classForm.track)) {
      setClassForm((prev) => ({ ...prev, track: trackOptions[0].code }))
    }
  }, [JSON.stringify(trackOptions), classForm.track])

  const resolveSchoolId = () => classes[0]?.schoolId || classes[0]?.school?.id || ''
  const grouped = classes.reduce((acc: Record<string, any>, c: any) => {
    const key = c.className || 'Unassigned'
    if (!acc[key]) {
      acc[key] = {
        className: key,
        total: 0,
        tracks: { TRACK_1: 0, TRACK_2: 0, TRACK_3: 0 },
        primaryTrack: c.track || 'TRACK_1',
      }
    }
    const classStudents = Array.isArray(c.students) ? c.students : []
    acc[key].total += classStudents.length
    if (c.track && acc[key].tracks[c.track] !== undefined) acc[key].tracks[c.track] += classStudents.length || 1
    return acc
  }, {})

  const classCards = Object.values(grouped)
    .map((c: any) => {
      const topTrack = (['TRACK_1', 'TRACK_2', 'TRACK_3'] as const).reduce((best, t) =>
        c.tracks[t] > c.tracks[best] ? t : best, 'TRACK_1')
      return { ...c, displayTrack: c.total > 0 ? topTrack : c.primaryTrack }
    })
    .sort((a: any, b: any) => a.className.localeCompare(b.className))

  const addClass = async (e: React.FormEvent) => {
    e.preventDefault()
    const className = classForm.className.trim().toUpperCase()
    if (!className) return
    if (classes.some((c: any) => c.className === className)) {
      notify.warning('Class already exists')
      return
    }
    setSavingClass(true)
    const schoolId = resolveSchoolId()
    if (!schoolId) {
      notify.warning('No school found for this tutor')
      setSavingClass(false)
      return
    }
    try {
      const created = await schoolClassesApi.create({
        schoolId,
        className,
        track: classForm.track,
      })
      const newClass = {
        id: created.id || `school-class-${created.className}`,
        className: created.className,
        track: created.track,
        schoolId,
        school: classes[0]?.school || null,
        students: [],
      }
      onClassesChange((prev) => [...prev, newClass])
      setClassForm({ className: '', track: classForm.track })
      setShowAddClass(false)
    } catch (e: any) {
      notify.error(e?.message || 'Failed to create class')
    }
    setSavingClass(false)
  }

  return (
    <div>
      <div className="flex-between mb-20">
        <div>
          <h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Classes</h3>
          <div className="text-muted text-sm">{classCards.length} classes assigned</div>
        </div>
        <button onClick={() => setShowAddClass((v) => !v)} className="btn btn-primary btn-sm">+ Add Class</button>
      </div>
      {showAddClass && (
        <div className="card mb-20">
          <div className="font-display fw-600 text-white mb-12" style={{ fontSize: 15 }}>Add Class</div>
          <form onSubmit={addClass} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12 }}>
            <div>
              <label className="form-label">Class Name</label>
              <input className="form-input" placeholder="e.g. SS2C" value={classForm.className} onChange={(e) => setClassForm({ ...classForm, className: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Track</label>
              <select className="form-input" value={classForm.track} onChange={(e) => setClassForm({ ...classForm, track: e.target.value })} style={{ appearance: 'none' }}>
                {(trackOptions.length ? trackOptions : [{ code: 'TRACK_1', label: 'Track 1' }, { code: 'TRACK_2', label: 'Track 2' }, { code: 'TRACK_3', label: 'Track 3' }]).map((t) => (
                  <option key={t.code} value={t.code}>{t.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={savingClass}>{savingClass ? 'Saving…' : 'Add Class'}</button>
            </div>
          </form>
        </div>
      )}
      <div className="content-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))' }}>
        {classCards.map((c: any) => (
          <button
            key={c.className}
            className="card"
            style={{ padding: 20, textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)' }}
            onClick={() => onOpenClass(c.className)}
            title={`View ${c.className} students`}
          >
            <div className="flex-between mb-8">
              <div className="font-display fw-700 text-white" style={{ fontSize: 18 }}>{c.className}</div>
              <span className={`badge ${c.displayTrack === 'TRACK_3' ? 'badge-info' : c.displayTrack === 'TRACK_2' ? 'badge-gold' : 'badge-teal'}`}>
                {c.displayTrack.replace('TRACK_', 'Track ')}
              </span>
            </div>
            <div style={{ fontSize: 28, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--gold)', marginBottom: 4 }}>{c.total}</div>
            <div className="text-muted text-sm" style={{ marginBottom: 12 }}>Total Students</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="badge badge-teal">T1: {c.tracks.TRACK_1}</span>
              <span className="badge badge-warning">T2: {c.tracks.TRACK_2}</span>
              <span className="badge badge-info">T3: {c.tracks.TRACK_3}</span>
            </div>
            <div className="text-muted text-xs" style={{ marginTop: 10 }}>Click card to view students →</div>
          </button>
        ))}
        {classCards.length === 0 && (
          <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>
            No classes available
          </div>
        )}
      </div>
    </div>
  )
}

// ─── MY STUDENTS ──────────────────────────────────────────────
function TutorStudents({
  classes,
  onClassesChange,
  selectedClass,
  onBackToClasses,
  onClearClass,
}: {
  classes: any[]
  onClassesChange: React.Dispatch<React.SetStateAction<any[]>>
  selectedClass?: string | null
  onBackToClasses?: () => void
  onClearClass?: () => void
}) {
  const [search, setSearch] = useState('')
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [savingStudent, setSavingStudent] = useState(false)
  const [savingBulk, setSavingBulk] = useState(false)
  const [studentForm, setStudentForm] = useState({ firstName: '', lastName: '', email: '', className: classes[0]?.className || '', track: classes[0]?.track || 'TRACK_1' })
  const [bulkForm, setBulkForm] = useState({ className: classes[0]?.className || '', termLabel: '2025/2026 Term 2', csv: '' })

  const classTrackMap = classes.reduce((acc: Record<string, string>, c: any) => {
    if (c?.className && c?.track) acc[c.className] = c.track
    return acc
  }, {})
  const classOptions = Array.from(new Set(classes.map((c: any) => c.className))).filter(Boolean).sort()
  const resolveSchoolId = (className?: string) =>
    classes.find((c: any) => c.className === className)?.schoolId ||
    classes.find((c: any) => c.className === className)?.school?.id ||
    classes[0]?.schoolId ||
    classes[0]?.school?.id ||
    ''

  useEffect(() => {
    if (!studentForm.className && classOptions.length) {
      const first = classOptions[0]
      setStudentForm((prev) => ({ ...prev, className: first, track: classTrackMap[first] || prev.track }))
    }
    if (!bulkForm.className && classOptions.length) {
      setBulkForm((prev) => ({ ...prev, className: classOptions[0] }))
    }
  }, [classOptions, classTrackMap, studentForm.className, bulkForm.className])

  const addStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    const schoolId = resolveSchoolId(studentForm.className)
    if (!schoolId) {
      notify.warning('No school found for selected class')
      return
    }
    setSavingStudent(true)
    const track = classTrackMap[studentForm.className] || studentForm.track
    try {
      const created = await studentsApi.create({
        firstName: studentForm.firstName,
        lastName: studentForm.lastName,
        email: studentForm.email,
        className: studentForm.className,
        track,
        schoolId,
        termLabel: '2025/2026 Term 2',
      })
      onClassesChange((prev) =>
        prev.map((c: any) =>
          c.className === studentForm.className
            ? { ...c, students: [...(c.students || []), created] }
            : c
        )
      )
      setStudentForm((prev) => ({ ...prev, firstName: '', lastName: '', email: '' }))
      setShowAddStudent(false)
    } catch (e: any) {
      notify.error(e?.message || 'Failed to add student')
    }
    setSavingStudent(false)
  }

  const bulkUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    const schoolId = resolveSchoolId(bulkForm.className)
    if (!schoolId) {
      notify.warning('No school found for selected class')
      return
    }
    if (!bulkForm.csv.trim()) {
      notify.warning('Paste CSV rows first')
      return
    }
    setSavingBulk(true)
    try {
      const track = classTrackMap[bulkForm.className] || 'TRACK_1'
      const res = await bulkUploadApi.csv(bulkForm.csv, schoolId, {
        className: bulkForm.className,
        track,
        termLabel: bulkForm.termLabel,
      })
      const createdCount =
        (typeof (res as any)?.succeeded === 'number' && (res as any).succeeded) ||
        (typeof (res as any)?.createdCount === 'number' && (res as any).createdCount) ||
        (Array.isArray((res as any)?.created) && (res as any).created.length) ||
        (Array.isArray((res as any)?.students) && (res as any).students.length) ||
        (typeof (res as any)?.count === 'number' && (res as any).count) ||
        0
      notify.success(createdCount > 0 ? `Uploaded ${createdCount} students successfully` : 'Bulk upload submitted successfully')
      setBulkForm((prev) => ({ ...prev, csv: '' }))
      setShowBulkUpload(false)
      const refreshed = await tutorsApi.myClasses().catch(() => null)
      if (Array.isArray(refreshed)) {
        onClassesChange(refreshed)
      }
    } catch (e: any) {
      notify.error(e?.message || 'Bulk upload failed')
    }
    setSavingBulk(false)
  }

  const filteredClasses = selectedClass ? classes.filter((c: any) => c.className === selectedClass) : classes
  const students = filteredClasses.flatMap((c: any, ci: number) =>
    (c.students || []).map((s: any, si: number) => {
      const scores = s.moduleProgress?.map((p: any) => p.score).filter(Boolean) || []
      const avg = scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0
      return { ...s, className: c.className, avg, colorIdx: ci * 8 + si }
    })
  ).filter((s: any) => {
    const name = `${s.user?.firstName} ${s.user?.lastName}`.toLowerCase()
    return !search || name.includes(search.toLowerCase()) || s.regNumber?.includes(search)
  })

  return (
    <div>
      <div className="flex-between mb-20">
        <div>
          <h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>My Students</h3>
          <div className="text-muted text-sm">
            {students.length} students
            {selectedClass ? ` in ${selectedClass}` : ` across ${classes.length} classes`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {selectedClass && <button onClick={onBackToClasses} className="btn btn-ghost btn-sm">Back to Classes</button>}
          {selectedClass && <button onClick={onClearClass} className="btn btn-ghost btn-sm">Clear Class Filter</button>}
          <button onClick={() => setShowAddStudent((v) => !v)} className="btn btn-primary btn-sm">+ Add Student</button>
          <button onClick={() => setShowBulkUpload((v) => !v)} className="btn btn-ghost btn-sm">📤 Bulk Upload</button>
        </div>
      </div>
      {showAddStudent && (
        <div className="card mb-16">
          <div className="font-display fw-600 text-white mb-12" style={{ fontSize: 15 }}>Add Student</div>
          <form onSubmit={addStudent} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label className="form-label">First Name</label><input className="form-input" required value={studentForm.firstName} onChange={(e) => setStudentForm({ ...studentForm, firstName: e.target.value })} /></div>
              <div><label className="form-label">Last Name</label><input className="form-input" required value={studentForm.lastName} onChange={(e) => setStudentForm({ ...studentForm, lastName: e.target.value })} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div><label className="form-label">Email</label><input type="email" className="form-input" required value={studentForm.email} onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })} /></div>
              <div>
                <label className="form-label">Class</label>
                <select
                  className="form-input"
                  required
                  value={studentForm.className}
                  onChange={(e) => {
                    const nextClass = e.target.value
                    setStudentForm((prev) => ({ ...prev, className: nextClass, track: classTrackMap[nextClass] || prev.track }))
                  }}
                  style={{ appearance: 'none' }}
                >
                  {classOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="form-label">Track</label><input className="form-input" value={(classTrackMap[studentForm.className] || studentForm.track).replace('TRACK_', 'Track ')} readOnly /></div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={savingStudent}>{savingStudent ? 'Adding…' : 'Create Student'}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAddStudent(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
      {showBulkUpload && (
        <div className="card mb-16">
          <div className="font-display fw-600 text-white mb-12" style={{ fontSize: 15 }}>Bulk Upload Students (CSV)</div>
          <form onSubmit={bulkUpload} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="form-label">Class</label>
                <select className="form-input" value={bulkForm.className} onChange={(e) => setBulkForm({ ...bulkForm, className: e.target.value })} style={{ appearance: 'none' }}>
                  {classOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="form-label">Term Label</label><input className="form-input" value={bulkForm.termLabel} onChange={(e) => setBulkForm({ ...bulkForm, termLabel: e.target.value })} /></div>
            </div>
            <div className="text-muted text-xs">CSV columns: <code>firstName,lastName,email</code> (header optional)</div>
            <textarea
              className="form-input"
              rows={6}
              placeholder={'firstName,lastName,email\nAisha,Okonkwo,aisha@example.com\nChidi,Uba,chidi@example.com'}
              value={bulkForm.csv}
              onChange={(e) => setBulkForm({ ...bulkForm, csv: e.target.value })}
              style={{ resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={savingBulk}>{savingBulk ? 'Uploading…' : 'Upload CSV'}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowBulkUpload(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
      <div style={{ marginBottom: 16 }}><input className="form-input" placeholder="Search by name or reg number…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 320 }} /></div>
      <div className="card">
        <table className="data-table">
          <thead><tr><th>#</th><th>Student</th><th>Reg No.</th><th>Class</th><th>Avg Score</th><th>Status</th></tr></thead>
          <tbody>
            {students.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 0' }}>No students found</td></tr>}
            {students.map((s: any, i: number) => {
              const name = `${s.user?.firstName} ${s.user?.lastName}`
              const { background, color } = studentColor(s.colorIdx)
              return (
                <tr key={s.id}>
                  <td style={{ color: i < 3 ? 'var(--gold)' : 'var(--muted)' }}>{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td>
                  <td><div className="student-name"><div className="stu-av" style={{ background, color }}>{initials(name)}</div>{name}</div></td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{s.regNumber}</td>
                  <td>{s.className}</td>
                  <td><strong style={{ color: s.avg >= 70 ? 'var(--success)' : s.avg >= 50 ? 'var(--warning)' : s.avg > 0 ? 'var(--danger)' : 'var(--muted)' }}>{s.avg > 0 ? `${s.avg}%` : '—'}</strong></td>
                  <td><span className={`badge badge-${s.avg >= 50 || s.avg === 0 ? 'success' : 'danger'}`}>{s.avg > 0 && s.avg < 50 ? 'At Risk' : 'Active'}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── ATTENDANCE ───────────────────────────────────────────────
function TutorAttendance({ classes, tutorId }: { classes: any[]; tutorId: string }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedClass, setSelectedClass] = useState('')
  const [mode, setMode] = useState<'cards' | 'record' | 'view'>('cards')
  const [openMenuClass, setOpenMenuClass] = useState<string | null>(null)
  const [records, setRecords] = useState<any[]>([])
  const [weekly, setWeekly] = useState<any[]>([])
  const [weeks, setWeeks] = useState(8)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingWeekly, setLoadingWeekly] = useState(false)

  const selectedClassObj = classes.find(c => c.className === selectedClass)
  const schoolId = selectedClassObj?.schoolId || selectedClassObj?.school?.id

  const loadRecordAttendance = useCallback(async () => {
    if (!selectedClass || !schoolId) return
    setLoading(true)
    try {
      const data = await attendanceApi.classView(schoolId, selectedClass, date)
      setRecords(data.map((r: any) => ({ ...r, status: r.status || 'PRESENT' })))
    } catch {
      const students = selectedClassObj?.students || []
      setRecords(students.map((s: any) => ({
        studentId: s.id,
        name: `${s.user?.firstName} ${s.user?.lastName}`,
        regNumber: s.regNumber,
        status: 'PRESENT',
      })))
    }
    setLoading(false)
    setSaved(false)
  }, [selectedClass, date, selectedClassObj, schoolId])

  const loadWeeklyAttendance = useCallback(async () => {
    if (!selectedClass || !schoolId) return
    setLoadingWeekly(true)
    try {
      const data = await attendanceApi.schoolWeekly(schoolId, weeks, selectedClass)
      setWeekly(Array.isArray(data) ? data : [])
    } catch {
      setWeekly([])
    }
    setLoadingWeekly(false)
  }, [schoolId, selectedClass, weeks])

  useEffect(() => {
    if (mode === 'record') loadRecordAttendance()
  }, [mode, loadRecordAttendance])

  useEffect(() => {
    if (mode === 'view') loadWeeklyAttendance()
  }, [mode, loadWeeklyAttendance])

  const toggle = (i: number, status: string) => {
    setSaved(false)
    setRecords(r => r.map((rec, j) => j === i ? { ...rec, status } : rec))
  }

  const save = async () => {
    setSaving(true)
    try {
      await attendanceApi.mark(
        records.map(r => ({ studentId: r.studentId, status: r.status })),
        date
      )
      setSaved(true)
    } catch (e: any) {
      notify.error(e.message || 'Failed to save')
    }
    setSaving(false)
  }

  if (mode === 'cards') {
    return (
      <div>
        <div className="flex-between mb-20">
          <div>
            <h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Attendance by Class</h3>
            <div className="text-muted text-sm mt-4">Pick a class and choose to record or view attendance.</div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,300px))',gap:14,justifyContent:'start'}}>
          {classes.map((c:any)=> {
            const track = c.track || 'TRACK_1'
            const studentCount = Array.isArray(c.students) ? c.students.length : 0
            return (
              <div key={c.className} className="card" style={{position:'relative',padding:16}}>
                <div className="flex-between mb-12" style={{alignItems:'flex-start'}}>
                  <div>
                    <div className="font-display fw-700 text-white" style={{fontSize:18}}>{c.className}</div>
                    <div className="text-muted text-xs mt-4">{String(track).replace('TRACK_', 'Track ')}</div>
                  </div>
                  <button
                    onClick={() => setOpenMenuClass(prev => prev === c.className ? null : c.className)}
                    className="btn btn-ghost btn-sm"
                    style={{padding:'4px 8px',minWidth:32}}
                    title="Attendance options"
                  >
                    ⋮
                  </button>
                </div>
                <div style={{fontSize:26,fontFamily:'var(--font-display)',fontWeight:800,color:'var(--gold)'}}>{studentCount}</div>
                <div className="text-muted text-sm">Students</div>
                {openMenuClass === c.className && (
                  <div style={{position:'absolute',top:44,right:12,zIndex:5,background:'var(--navy2)',border:'1px solid var(--border2)',borderRadius:10,padding:8,minWidth:180,display:'flex',flexDirection:'column',gap:6}}>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{justifyContent:'flex-start'}}
                      onClick={() => {
                        setSelectedClass(c.className)
                        setMode('view')
                        setOpenMenuClass(null)
                      }}
                    >
                      View Attendance
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{justifyContent:'flex-start'}}
                      onClick={() => {
                        setSelectedClass(c.className)
                        setMode('record')
                        setOpenMenuClass(null)
                      }}
                    >
                      Record Attendance
                    </button>
                  </div>
                )}
              </div>
            )
          })}
          {classes.length === 0 && (
            <div className="card" style={{textAlign:'center',color:'var(--muted)',padding:'32px 0'}}>No classes assigned yet.</div>
          )}
        </div>
      </div>
    )
  }

  if (mode === 'view') {
    const totals = weekly.reduce((acc: any, w: any) => ({
      present: acc.present + (w.present || 0),
      absent: acc.absent + (w.absent || 0),
      late: acc.late + (w.late || 0),
      excused: acc.excused + (w.excused || 0),
      total: acc.total + (w.total || 0),
    }), { present: 0, absent: 0, late: 0, excused: 0, total: 0 })
    const avgRate = totals.total ? Math.round((totals.present / totals.total) * 100) : null
    return (
      <div>
        <div className="flex-between mb-20">
          <div>
            <h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>View Attendance</h3>
            <div className="text-muted text-sm mt-4">Class: {selectedClass}</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={() => setMode('record')} className="btn btn-ghost btn-sm">Record For This Class</button>
            <button onClick={() => { setMode('cards'); setSelectedClass('') }} className="btn btn-ghost btn-sm">Back to Class Cards</button>
          </div>
        </div>
        <div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap'}}>
          <div><label className="form-label">Weeks</label>
            <select className="form-input" value={weeks} onChange={e => setWeeks(Number(e.target.value))} style={{appearance:'none',width:160}}>
              {[4,8,12,16].map(w => <option key={w} value={w}>Last {w} Weeks</option>)}
            </select>
          </div>
          <div className="badge badge-info" style={{alignSelf:'flex-end'}}>Avg Rate: {avgRate != null ? `${avgRate}%` : '—'}</div>
        </div>
        <div className="card">
          <table className="data-table">
            <thead><tr><th>Week</th><th>Present</th><th>Absent</th><th>Late</th><th>Excused</th><th>Rate</th><th>Marked Days</th></tr></thead>
            <tbody>
              {loadingWeekly && <tr><td colSpan={7} style={{textAlign:'center',color:'var(--muted)',padding:'24px 0'}}>Loading attendance…</td></tr>}
              {!loadingWeekly && weekly.map((w:any, i:number)=>(
                <tr key={`${w.weekLabel}-${i}`}>
                  <td style={{fontWeight:600,color:'var(--white)'}}>{w.weekLabel}</td>
                  <td>{w.present}</td>
                  <td>{w.absent}</td>
                  <td>{w.late}</td>
                  <td>{w.excused}</td>
                  <td><strong style={{color:w.rate>=75?'var(--success)':w.rate>=50?'var(--warning)':'var(--danger)'}}>{w.rate != null ? `${w.rate}%` : '—'}</strong></td>
                  <td>{w.markedDays || 0}</td>
                </tr>
              ))}
              {!loadingWeekly && weekly.length === 0 && <tr><td colSpan={7} style={{textAlign:'center',color:'var(--muted)',padding:'24px 0'}}>No attendance records found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex-between mb-20">
        <div>
          <h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Record Attendance</h3>
          <div className="text-muted text-sm mt-4">Class: {selectedClass}</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={() => setMode('view')} className="btn btn-ghost btn-sm">View This Class</button>
          <button onClick={save} className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Attendance'}</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div><label className="form-label">Date</label><input type="date" className="form-input" value={date} onChange={e => { setDate(e.target.value); setSaved(false) }} style={{ width: 180 }} /></div>
        <div><label className="form-label">Class</label>
          <select className="form-input" value={selectedClass} onChange={e => setSelectedClass(e.target.value)} style={{ appearance: 'none', width: 160 }}>
            {classes.map(c => <option key={c.className}>{c.className}</option>)}
            {classes.length === 0 && <option>No classes</option>}
          </select>
        </div>
        <button className="btn btn-ghost btn-sm" style={{alignSelf:'flex-end'}} onClick={() => { setMode('cards'); setSelectedClass('') }}>Back to Class Cards</button>
      </div>
      <div className="card">
        <div className="flex-between mb-16">
          <div className="font-display fw-600 text-white">{selectedClass} · {new Date(date + 'T00:00:00').toLocaleDateString('en-NG', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <div style={{ fontSize: 13, display: 'flex', gap: 16 }}>
            <span style={{ color: 'var(--success)' }}>✓ {records.filter(r => r.status === 'PRESENT').length} Present</span>
            <span style={{ color: 'var(--warning)' }}>⏰ {records.filter(r => r.status === 'LATE').length} Late</span>
            <span style={{ color: 'var(--danger)' }}>✗ {records.filter(r => r.status === 'ABSENT').length} Absent</span>
          </div>
        </div>
        {loading ? <p className="text-muted text-sm">Loading students…</p> : (
          <table className="data-table">
            <thead><tr><th>Student</th><th>Reg No.</th><th>Status</th><th>Mark</th></tr></thead>
            <tbody>
              {records.map((r: any, i: number) => (
                <tr key={r.studentId}>
                  <td><div className="student-name"><div className="stu-av" style={{ ...studentColor(i) }}>{initials(r.name || 'UN')}</div>{r.name}</div></td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{r.regNumber}</td>
                  <td><span className={`badge badge-${r.status === 'PRESENT' ? 'success' : r.status === 'LATE' ? 'warning' : 'danger'}`}>{r.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['PRESENT', 'LATE', 'ABSENT'] as const).map(st => (
                        <button key={st} onClick={() => toggle(i, st)} style={{ padding: '5px 10px', fontSize: 11, borderRadius: 6, cursor: 'pointer', border: `1px solid ${r.status === st ? (st === 'PRESENT' ? 'rgba(34,197,94,0.5)' : st === 'LATE' ? 'rgba(245,158,11,0.5)' : 'rgba(239,68,68,0.5)') : 'var(--border2)'}`, background: r.status === st ? (st === 'PRESENT' ? 'rgba(34,197,94,0.15)' : st === 'LATE' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)') : 'transparent', color: r.status === st ? (st === 'PRESENT' ? '#4ADE80' : st === 'LATE' ? '#FCD34D' : '#F87171') : 'var(--muted)' }}>
                          {st === 'PRESENT' ? '✓ P' : st === 'LATE' ? '⏰ L' : '✗ A'}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {records.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>No students in this class</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── MARK RESULTS ─────────────────────────────────────────────
function TutorResults({ classes }: { classes: any[] }) {
  const [selectedClass, setSelectedClass] = useState(classes[0]?.className || '')
  const students = (classes.find(c => c.className === selectedClass)?.students || [])
  const [scores, setScores] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [classProgress, setClassProgress] = useState<any>(null)
  const [loadingProgress, setLoadingProgress] = useState(false)

  const grade = (v: string) => { const n = +v; if (!v || isNaN(n)) return '—'; if (n >= 90) return 'A+'; if (n >= 80) return 'A'; if (n >= 70) return 'B+'; if (n >= 60) return 'B'; if (n >= 50) return 'C'; return 'F' }
  const gc = (v: string) => { const n = +v; if (!v || isNaN(n)) return 'warning'; return n >= 70 ? 'success' : n >= 50 ? 'warning' : 'danger' }
  const selectedClassObj = classes.find((c: any) => c.className === selectedClass)
  const schoolId = selectedClassObj?.schoolId || selectedClassObj?.school?.id || ''

  const loadClassProgress = useCallback(async () => {
    if (!schoolId || !selectedClass) {
      setClassProgress(null)
      return
    }
    setLoadingProgress(true)
    try {
      const data = await modulesApi.classProgress(schoolId, selectedClass)
      setClassProgress(data)
    } catch {
      setClassProgress(null)
    }
    setLoadingProgress(false)
  }, [schoolId, selectedClass])

  useEffect(() => {
    setSaved(false)
    loadClassProgress()
  }, [selectedClass, loadClassProgress])

  const saveAll = async () => {
    if (!classProgress?.currentModule?.id) {
      notify.warning('No active module set for this class')
      return
    }
    if (!schoolId) {
      notify.warning('No school found for selected class')
      return
    }
    const payloadScores = Object.entries(scores)
      .filter(([, score]) => score !== '' && !Number.isNaN(Number(score)))
      .map(([studentId, score]) => ({ studentId, score: Number(score) }))
    if (!payloadScores.length) {
      notify.warning('Enter at least one score')
      return
    }
    setSaving(true)
    try {
      await modulesApi.updateClassScores({
        schoolId,
        className: selectedClass,
        moduleId: classProgress.currentModule.id,
        scores: payloadScores,
      })
      setSaved(true)
    } catch (e: any) { notify.fromError(e) }
    setSaving(false)
  }

  const advanceClassModule = async () => {
    if (!classProgress?.currentModule?.id || !schoolId) return
    setAdvancing(true)
    try {
      await modulesApi.advanceClass({
        schoolId,
        className: selectedClass,
        moduleId: classProgress.currentModule.id,
      })
      setScores({})
      setSaved(false)
      await loadClassProgress()
      notify.success('Class advanced to next module')
    } catch (e: any) {
      notify.error(e?.message || 'Failed to advance class module')
    }
    setAdvancing(false)
  }

  return (
    <div>
      <div className="flex-between mb-20">
        <div>
          <h3 className="font-display fw-700 text-white" style={{ fontSize: 18 }}>Mark Results</h3>
          <div className="text-muted text-xs mt-4">Class-paced module flow: score individually, advance by class.</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select className="form-input" value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSaved(false) }} style={{ appearance: 'none', width: 120 }}>
            {classes.map(c => <option key={c.className}>{c.className}</option>)}
          </select>
          <button onClick={saveAll} className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : saved ? '✓ Saved' : 'Save All Scores'}</button>
          <button onClick={advanceClassModule} className="btn btn-ghost btn-sm" disabled={advancing || !classProgress?.currentModule}>{advancing ? 'Advancing…' : 'Advance Class Module →'}</button>
        </div>
      </div>
      <div className="card mb-16">
        {loadingProgress ? (
          <div className="text-muted text-sm">Loading class module state…</div>
        ) : classProgress?.currentModule ? (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="badge badge-info">Current: Module {classProgress.currentModule.number}</span>
            <span style={{ color: 'var(--white)', fontWeight: 600 }}>{classProgress.currentModule.title}</span>
            <span className="text-muted text-xs">{classProgress.studentCount} students in class</span>
          </div>
        ) : (
          <div className="text-muted text-sm">No active module found for this class</div>
        )}
      </div>
      <div className="card">
        <table className="data-table">
          <thead><tr><th>Student</th><th>Current Module</th><th>Score (0–100)</th><th>Grade</th></tr></thead>
          <tbody>
            {students.map((s: any, i: number) => {
              const name = `${s.user?.firstName} ${s.user?.lastName}`
              return (
                <tr key={s.id}>
                  <td><div className="student-name"><div className="stu-av" style={{ ...studentColor(i) }}>{initials(name)}</div>{name}</div></td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{classProgress?.currentModule?.title || 'No active module'}</td>
                  <td><input type="number" min={0} max={100} value={scores[s.id] || ''} onChange={e => { setScores(sc => ({ ...sc, [s.id]: e.target.value })); setSaved(false) }} style={{ width: 64, background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--white)', textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 700 }} /></td>
                  <td><span className={`badge badge-${gc(scores[s.id] || '')}`}>{grade(scores[s.id] || '')}</span></td>
                </tr>
              )
            })}
            {students.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>No students in selected class</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── LESSON PLANS ─────────────────────────────────────────────
function LessonPlans({ classes }: { classes: any[] }) {
  const DEFAULT_STEP_TEMPLATE = [
    { title: 'Intro', desc: 'Recap previous module key points', mins: 5 },
    { title: 'Theory', desc: 'Explain core lesson concepts', mins: 20 },
    { title: 'Practical', desc: 'Hands-on student activity', mins: 40 },
    { title: 'Wrap-up', desc: 'Q&A and assign homework', mins: 10 },
  ]
  const DEFAULT_STEP_TITLES = ['Intro', 'Theory', 'Practical', 'Wrap-up']
  const classOptions = Array.from(
    new Map(
      (Array.isArray(classes) ? classes : [])
        .filter((c: any) => c?.className)
        .map((c: any) => [c.className, { className: c.className, track: c.track || 'TRACK_1' }])
    ).values()
  ) as Array<{ className: string; track: string }>
  const { data: dynamicTracks } = useQuery({
    queryKey: ['tutor', 'tracks-options'],
    queryFn: () => tracksApi.all(),
    staleTime: 60_000,
    retry: 1,
  })
  const classTrackCodes = Array.from(new Set(classOptions.map((c) => c.track)))
  const activeTrackChoices = (Array.isArray(dynamicTracks) ? dynamicTracks : [])
    .filter((t: any) => t.isActive !== false)
    .map((t: any) => ({ code: String(t.code), label: String(t.name || String(t.code).replace('TRACK_', 'Track ')) }))
  const trackChoices = (activeTrackChoices.length ? activeTrackChoices : classTrackCodes.map((code) => ({ code, label: String(code).replace('TRACK_', 'Track ') })))
  const defaultTrack = trackChoices[0]?.code || 'TRACK_1'
  const buildDefaultForm = () => ({
    title: '',
    track: defaultTrack,
    className: classOptions[0]?.className || 'SS3A',
    classNames: classOptions.filter((c) => c.track === defaultTrack).map((c) => c.className),
    moduleId: '',
    durationMins: 75,
    venue: 'Computer Lab B',
    scheduledAt: '',
    steps: DEFAULT_STEP_TITLES.map((title) => ({ title, desc: '', mins: 0 })),
  })
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [modulesForTrack, setModulesForTrack] = useState<any[]>([])
  const [loadingModules, setLoadingModules] = useState(false)
  const [materialFile, setMaterialFile] = useState<File | null>(null)
  const [attachmentsByPlan, setAttachmentsByPlan] = useState<Record<string, any[]>>({})
  const [form, setForm] = useState(buildDefaultForm)
  useEffect(() => {
    if (!trackChoices.length) return
    if (!form.track || !trackChoices.some((t) => t.code === form.track)) {
      const nextTrack = trackChoices[0].code
      const nextClasses = classOptions.filter((c) => c.track === nextTrack).map((c) => c.className)
      setForm((prev) => ({ ...prev, track: nextTrack, classNames: nextClasses, className: nextClasses[0] || '', moduleId: '' }))
    }
  }, [JSON.stringify(trackChoices), JSON.stringify(classOptions), form.track])

  useEffect(() => {
    const loadModules = async () => {
      if (!showNew || !form.track) return
      setLoadingModules(true)
      try {
        const data = await modulesApi.all(form.track)
        const list = Array.isArray(data) ? data : []
        setModulesForTrack(list)
        setForm((f: any) => {
          if (f.moduleId && list.some((m: any) => m.id === f.moduleId)) return f
          return { ...f, moduleId: list[0]?.id || '' }
        })
      } catch {
        setModulesForTrack([])
        setForm((f: any) => ({ ...f, moduleId: '' }))
      }
      setLoadingModules(false)
    }
    loadModules()
  }, [showNew, form.track])
  const selectedModule = modulesForTrack.find((m: any) => m.id === form.moduleId)
  const generatedTitle = selectedModule ? `Module ${selectedModule.number}: ${selectedModule.title}` : ''
  useEffect(() => {
    if (!showNew) return
    if (form.title !== generatedTitle) {
      setForm((f: any) => ({ ...f, title: generatedTitle }))
    }
  }, [generatedTitle, showNew])

  useEffect(() => {
    lessonsApi.mine().then(setPlans).catch(() => setPlans([])).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!plans.length) {
      setAttachmentsByPlan({})
      return
    }
    let active = true
    Promise.all(
      plans.map(async (plan: any) => {
        const files = await uploadsApi.byEntity('lesson-plan', plan.id).catch(() => [])
        return [plan.id, Array.isArray(files) ? files : []] as const
      })
    ).then((entries) => {
      if (!active) return
      const next: Record<string, any[]> = {}
      entries.forEach(([planId, files]) => {
        next[planId] = files
      })
      setAttachmentsByPlan(next)
    })
    return () => {
      active = false
    }
  }, [plans])

  const addStep = () => setForm(f => ({ ...f, steps: [...f.steps, { title: '', desc: '', mins: 0 }] }))
  const applySuggestedSteps = () => {
    setForm(f => ({ ...f, steps: DEFAULT_STEP_TEMPLATE.map((s) => ({ ...s })) }))
  }
  const removeStep = (index: number) => {
    setForm(f => ({ ...f, steps: f.steps.filter((_, i) => i !== index) }))
  }
  const setStep = (i: number, k: 'title' | 'desc' | 'mins', v: string | number) => {
    setForm(f => ({ ...f, steps: f.steps.map((s, j) => j === i ? { ...s, [k]: v } : s) }))
  }
  const classesForTrack = classOptions.filter((c) => c.track === form.track)
  const toggleClassTarget = (className: string) => {
    setForm((f: any) => {
      const exists = f.classNames.includes(className)
      const nextClassNames = exists ? f.classNames.filter((c: string) => c !== className) : [...f.classNames, className]
      return {
        ...f,
        classNames: nextClassNames,
        className: nextClassNames[0] || className,
      }
    })
  }
  const allocatedMins = form.steps.reduce((sum, step) => sum + Math.max(0, Number(step.mins) || 0), 0)
  const minsDelta = allocatedMins - (Number(form.durationMins) || 0)

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      if ((Number(form.durationMins) || 0) <= 0) {
        notify.warning('Set a valid total duration in minutes')
        setSaving(false)
        return
      }
      if (!form.moduleId) {
        notify.warning('Select a module for this lesson plan')
        setSaving(false)
        return
      }
      if (minsDelta !== 0) {
        notify.warning(`Step minutes must match total duration. Difference: ${minsDelta > 0 ? '+' : ''}${minsDelta} min`)
        setSaving(false)
        return
      }
      const targetClassNames = Array.from(new Set((form.classNames || []).filter(Boolean)))
      if (!targetClassNames.length) {
        notify.warning('Select at least one class for this lesson plan')
        setSaving(false)
        return
      }
      const cleanedSteps = form.steps
        .map((s) => ({ ...s, title: (s.title || '').trim(), desc: (s.desc || '').trim(), mins: Math.max(0, Number(s.mins) || 0) }))
        .filter((s) => s.title || s.desc || s.mins > 0)
      const schoolId = classes[0]?.schoolId || classes[0]?.school?.id || ''
      const payload = {
        className: targetClassNames[0],
        classNames: targetClassNames,
        moduleId: form.moduleId,
        title: generatedTitle,
        durationMins: form.durationMins,
        venue: form.venue,
        scheduledAt: form.scheduledAt,
        schoolId,
        steps: cleanedSteps.map(s => ({ ...s, color: 'var(--gold)' })),
      }
      if (editingPlanId) {
        await lessonsApi.update(editingPlanId, payload)
        if (materialFile) await uploadsApi.lessonPlan(materialFile, editingPlanId).catch(() => null)
      } else {
        const created = await lessonsApi.create(payload)
        const createdPlans = Array.isArray(created) ? created : [created]
        if (materialFile) {
          await Promise.all(
            createdPlans.map((plan: any) => uploadsApi.lessonPlan(materialFile, plan.id).catch(() => null))
          )
        }
      }
      const refreshedPlans = await lessonsApi.mine().catch(() => null)
      if (Array.isArray(refreshedPlans)) setPlans(refreshedPlans)
      setShowNew(false)
      setEditingPlanId(null)
      setForm(buildDefaultForm())
      setMaterialFile(null)
    } catch (e: any) { notify.fromError(e) }
    setSaving(false)
  }

  const del = async (id: string) => {
    if (!confirm('Delete this lesson plan?')) return
    try { await lessonsApi.delete(id); setPlans(p => p.filter(x => x.id !== id)) } catch (e: any) { notify.fromError(e) }
  }
  const startEdit = (plan: any) => {
    const trackFromClass = classOptions.find((c) => c.className === plan.className)?.track || defaultTrack
    const normalizeDate = (v: any) => (v ? new Date(v).toISOString().slice(0, 16) : '')
    const siblingClassNames = plans
      .filter((p: any) =>
        p?.id !== plan?.id &&
        p?.moduleId === plan?.moduleId &&
        String(p?.title || '') === String(plan?.title || '') &&
        String(p?.venue || '') === String(plan?.venue || '') &&
        Number(p?.durationMins || 0) === Number(plan?.durationMins || 0) &&
        normalizeDate(p?.scheduledAt) === normalizeDate(plan?.scheduledAt)
      )
      .map((p: any) => String(p?.className || '').trim())
      .filter(Boolean)
    const targetClassNames = Array.from(new Set([String(plan?.className || '').trim(), ...siblingClassNames].filter(Boolean)))
    const allTrackClassNames = classOptions.filter((c) => c.track === trackFromClass).map((c) => c.className)
    const resolvedClassNames = targetClassNames.length > 1 ? targetClassNames : allTrackClassNames
    const steps = Array.isArray(plan.steps)
      ? plan.steps.map((s: any) => ({
          title: String(s?.title || ''),
          desc: String(s?.desc || ''),
          mins: Number(s?.mins || 0),
        }))
      : DEFAULT_STEP_TITLES.map((title) => ({ title, desc: '', mins: 0 }))
    setForm({
      title: plan.title || '',
      track: trackFromClass,
      className: plan.className || '',
      classNames: resolvedClassNames,
      moduleId: plan.moduleId || '',
      durationMins: plan.durationMins || 75,
      venue: plan.venue || 'Computer Lab B',
      scheduledAt: plan.scheduledAt ? new Date(plan.scheduledAt).toISOString().slice(0, 16) : '',
      steps,
    })
    setEditingPlanId(plan.id)
    setMaterialFile(null)
    setShowNew(true)
  }

  return (
    <div>
      <div className="flex-between mb-20">
        <div><h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Lesson Plans</h3><div className="text-muted text-sm">Structured session guides for your classes</div></div>
        <button
          onClick={() => {
            setShowNew((prev) => {
              const next = !prev
              if (next) {
                setForm(buildDefaultForm())
                setMaterialFile(null)
                setEditingPlanId(null)
              }
              return next
            })
          }}
          className="btn btn-primary btn-sm"
        >
          + New Plan
        </button>
      </div>
      {showNew && (
        <div className="card mb-20">
          <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 16 }}>
            {editingPlanId ? 'Edit Lesson Plan' : 'Create Lesson Plan'}
          </div>
          <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
              <div>
                <label className="form-label">Lesson Title</label>
                <input
                  className="form-input"
                  value={generatedTitle || 'Select a module to generate title'}
                  readOnly
                  disabled
                />
              </div>
              <div><label className="form-label">Track</label>
                <select
                  className="form-input"
                  value={form.track}
                  onChange={e => {
                    const nextTrack = e.target.value
                    const nextClasses = classOptions.filter((c) => c.track === nextTrack).map((c) => c.className)
                    setForm({ ...form, track: nextTrack, classNames: nextClasses, className: nextClasses[0] || '', moduleId: '', title: '' })
                  }}
                  style={{ appearance: 'none' }}
                >
                  {trackChoices.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
                  {trackChoices.length === 0 && <option value="TRACK_1">Track 1</option>}
                </select>
              </div>
              <div><label className="form-label">Module</label>
                <select
                  className="form-input"
                  required
                  value={form.moduleId || ''}
                  onChange={e => {
                    const nextModuleId = e.target.value
                    const nextModule = modulesForTrack.find((m: any) => m.id === nextModuleId)
                    setForm({
                      ...form,
                      moduleId: nextModuleId,
                      title: nextModule ? `Module ${nextModule.number}: ${nextModule.title}` : '',
                    })
                  }}
                  style={{ appearance: 'none' }}
                  disabled={loadingModules}
                >
                  <option value="">{loadingModules ? 'Loading modules…' : 'Select module…'}</option>
                  {modulesForTrack.map((m: any) => (
                    <option key={m.id} value={m.id}>{`Module ${m.number}: ${m.title}`}</option>
                  ))}
                </select>
              </div>
              <div><label className="form-label">Duration (min)</label><input type="number" className="form-input" value={form.durationMins} onChange={e => setForm({ ...form, durationMins: +e.target.value })} /></div>
            </div>
            <div>
              <label className="form-label">Target Classes (same track/module)</label>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,220px))',gap:8}}>
                {classesForTrack.map((c) => (
                  <label key={c.className} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',border:'1px solid var(--border2)',borderRadius:8,cursor:'pointer',background:'var(--muted3)'}}>
                    <input
                      type="checkbox"
                      checked={form.classNames.includes(c.className)}
                      onChange={() => toggleClassTarget(c.className)}
                      style={{accentColor:'var(--teal)'}}
                    />
                    <span style={{fontSize:13,color:'var(--white)'}}>{c.className}</span>
                  </label>
                ))}
              </div>
              {classesForTrack.length === 0 && (
                <div className="text-muted text-xs mt-4">No classes found for selected track.</div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label className="form-label">Venue</label><input className="form-input" value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} /></div>
              <div><label className="form-label">Scheduled Date</label><input type="datetime-local" className="form-input" value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} /></div>
            </div>
            <div>
              <label className="form-label">Module Material (optional)</label>
              <input
                type="file"
                className="form-input"
                onChange={e => setMaterialFile(e.target.files?.[0] || null)}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.png,.jpg,.jpeg"
              />
              <div className="text-muted text-xs mt-4">
                {editingPlanId ? 'You can replace existing material by uploading a new file.' : 'Upload one supporting file for this lesson plan.'}
              </div>
            </div>
            <div>
              <div className="flex-between mb-10">
                <label className="form-label">Lesson Steps</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={applySuggestedSteps} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>Use Suggested Steps</button>
                  <button type="button" onClick={addStep} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>+ Add Step</button>
                </div>
              </div>
              <div style={{ marginBottom: 10, fontSize: 12, color: minsDelta === 0 ? 'var(--success)' : 'var(--warning)' }}>
                Allocated: {allocatedMins} / {form.durationMins || 0} min
                {minsDelta !== 0 ? ` (${minsDelta > 0 ? '+' : ''}${minsDelta} min)` : ' (balanced)'}
              </div>
              {form.steps.map((step, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 2fr auto', gap: 10, marginBottom: 8 }}>
                  <input className="form-input" placeholder={`Step ${i + 1} title`} value={step.title} onChange={e => setStep(i, 'title', e.target.value)} />
                  <input type="number" min={0} className="form-input" placeholder="Mins" value={step.mins ?? 0} onChange={e => setStep(i, 'mins', Number(e.target.value))} />
                  <input className="form-input" placeholder="Description" value={step.desc} onChange={e => setStep(i, 'desc', e.target.value)} />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeStep(i)} style={{ whiteSpace: 'nowrap' }}>Remove</button>
                </div>
              ))}
              {form.steps.length === 0 && (
                <div className="text-muted text-xs">No steps yet. Add one or use suggested steps.</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? 'Saving…' : editingPlanId ? 'Update Plan →' : 'Save Plan →'}
              </button>
              <button type="button" onClick={() => { setShowNew(false); setEditingPlanId(null) }} className="btn btn-ghost btn-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}
      {loading && <p className="text-muted text-sm" style={{ padding: 20 }}>Loading lesson plans…</p>}
      <div className="card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {plans.map((plan: any) => (
            <div key={plan.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20 }}>
              <div className="flex-between mb-8">
                <div className="font-display fw-700 text-white">{plan.title}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {plan.scheduledAt && <span className="badge badge-teal">{new Date(plan.scheduledAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}</span>}
                  <button onClick={() => del(plan.id)} className="btn btn-danger btn-sm" style={{ padding: '4px 8px', fontSize: 11 }}>Delete</button>
                </div>
              </div>
              <div className="text-muted text-sm mb-12">{plan.className} · {plan.durationMins} minutes · {plan.venue}</div>
              {Array.isArray(plan.steps) && plan.steps.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, marginBottom: 12 }}>
                  {plan.steps.map((step: any, j: number) => (
                    <div key={j} style={{ display: 'flex', gap: 10 }}>
                      <div style={{ width: 6, height: 6, background: step.color || 'var(--gold)', borderRadius: '50%', marginTop: 5, flexShrink: 0 }}></div>
                      <div>
                        <div style={{ color: 'var(--white)' }}>
                          {step.title || `Step ${j + 1}`}
                          {typeof step.mins === 'number' ? ` (${step.mins} min)` : ''}
                        </div>
                        <div className="text-muted">{step.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => startEdit(plan)}>Edit Plan</button>
                {(attachmentsByPlan[plan.id] || []).length > 0 && (
                  <a
                    href={attachmentsByPlan[plan.id][0].url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-ghost btn-sm"
                  >
                    ⬇ Download Material
                  </a>
                )}
              </div>
            </div>
          ))}
          {!loading && plans.length === 0 && <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 0' }}>No lesson plans yet. Create your first plan above.</div>}
        </div>
      </div>
    </div>
  )
}

// ─── ASSIGNMENTS ───────────────────────────────────────────────
function TutorAssignments({ classes }: { classes: any[] }) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [materialFile, setMaterialFile] = useState<File | null>(null)
  const [modulesForTrack, setModulesForTrack] = useState<Array<{ value: string; label: string; moduleId: string }>>([])
  const [loadingModules, setLoadingModules] = useState(false)
  const classOptions = Array.from(
    new Map(
      (Array.isArray(classes) ? classes : [])
        .filter((c: any) => c?.className)
        .map((c: any) => [
          c.className,
          { className: c.className, track: c.track || 'TRACK_1', schoolId: c.schoolId || c.school?.id || '' },
        ])
    ).values()
  ) as Array<{ className: string; track: string; schoolId: string }>
  const { data: dynamicTracks } = useQuery({
    queryKey: ['tutor', 'tracks-options'],
    queryFn: () => tracksApi.all(),
    staleTime: 60_000,
    retry: 1,
  })
  const classTrackCodes = Array.from(new Set(classOptions.map((c) => c.track)))
  const activeTrackChoices = (Array.isArray(dynamicTracks) ? dynamicTracks : [])
    .filter((t: any) => t.isActive !== false)
    .map((t: any) => ({ code: String(t.code), label: String(t.name || String(t.code).replace('TRACK_', 'Track ')) }))
  const trackChoices = (activeTrackChoices.length ? activeTrackChoices : classTrackCodes.map((code) => ({ code, label: String(code).replace('TRACK_', 'Track ') })))
  const defaultTrack = trackChoices[0]?.code || 'TRACK_1'
  const [form, setForm] = useState({
    track: defaultTrack,
    classNames: classOptions.filter((c) => c.track === defaultTrack).map((c) => c.className),
    title: '',
    description: '',
    dueDate: '',
    moduleId: '',
  })
  useEffect(() => {
    if (!trackChoices.length) return
    if (!form.track || !trackChoices.some((t) => t.code === form.track)) {
      const nextTrack = trackChoices[0].code
      setForm((prev) => ({
        ...prev,
        track: nextTrack,
        classNames: classOptions.filter((c) => c.track === nextTrack).map((c) => c.className),
        moduleId: '',
      }))
    }
  }, [JSON.stringify(trackChoices), JSON.stringify(classOptions), form.track])

  useEffect(() => {
    const loadModules = async () => {
      if (!form.track) {
        setModulesForTrack([])
        return
      }

      setLoadingModules(true)
      try {
        const data = await modulesApi.all(form.track)
        const rows = Array.isArray(data) ? data : []
        const options = rows.map((m: any) => ({
          value: String(m.id),
          moduleId: String(m.id),
          label: `Module ${m.number}: ${m.title}`,
        }))
        setModulesForTrack(options)
        setForm((f: any) => {
          if (f.moduleId && options.some((m: any) => m.value === f.moduleId)) return f
          return { ...f, moduleId: options[0]?.value || '' }
        })
      } catch {
        setModulesForTrack([])
        setForm((f: any) => ({ ...f, moduleId: '' }))
      }
      setLoadingModules(false)
    }
    loadModules()
  }, [form.track])

  const loadAssignments = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await Promise.all(
        classOptions.map(async (c) => {
          if (!c.schoolId) return []
          const data = await assignmentsApi.forClass(c.schoolId, c.className).catch(() => [])
          return (Array.isArray(data) ? data : []).map((x: any) => ({ ...x, className: x.className || c.className }))
        })
      )
      const merged = rows.flat()
      const seen = new Set<string>()
      const deduped = merged.filter((x: any) => {
        if (!x?.id || seen.has(x.id)) return false
        seen.add(x.id)
        return true
      })
      deduped.sort((a: any, b: any) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime())
      setItems(deduped)
    } catch {
      setItems([])
    }
    setLoading(false)
  }, [JSON.stringify(classOptions)])

  useEffect(() => {
    loadAssignments()
  }, [loadAssignments])

  const classesForTrack = classOptions.filter((c) => c.track === form.track)
  const toggleClassTarget = (className: string) => {
    setForm((f: any) => {
      const exists = f.classNames.includes(className)
      const classNames = exists ? f.classNames.filter((c: string) => c !== className) : [...f.classNames, className]
      return { ...f, classNames }
    })
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const targetClassNames = Array.from(new Set((form.classNames || []).filter(Boolean)))
      if (!targetClassNames.length) {
        notify.warning('Select at least one class')
        setSaving(false)
        return
      }
      if (!form.moduleId) {
        notify.warning('Select a module')
        setSaving(false)
        return
      }
      const firstClass = classOptions.find((c) => c.className === targetClassNames[0])
      const schoolId = firstClass?.schoolId || classOptions[0]?.schoolId || ''
      if (!schoolId) {
        notify.warning('No school found for selected classes')
        setSaving(false)
        return
      }
      const created = await assignmentsApi.create({
        schoolId,
        className: targetClassNames[0],
        classNames: targetClassNames,
        moduleId: form.moduleId,
        title: form.title,
        description: form.description,
        dueDate: form.dueDate,
      })
      if (materialFile) {
        const createdRows = Array.isArray(created) ? created : [created]
        await Promise.all(
          createdRows
            .filter((row: any) => row?.id)
            .map((row: any) => uploadsApi.assignment(materialFile, row.id).catch(() => null))
        )
      }
      setShowNew(false)
      setForm({
        track: defaultTrack,
        classNames: classOptions.filter((c) => c.track === defaultTrack).map((c) => c.className),
        title: '',
        description: '',
        dueDate: '',
        moduleId: '',
      })
      setMaterialFile(null)
      await loadAssignments()
    } catch (e: any) {
      notify.error(e?.message || 'Failed to create assignment')
    }
    setSaving(false)
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this assignment?')) return
    try {
      await assignmentsApi.delete(id)
      setItems((prev) => prev.filter((x: any) => x.id !== id))
    } catch (e: any) {
      notify.error(e?.message || 'Failed to delete assignment')
    }
  }

  return (
    <div>
      <div className="flex-between mb-20">
        <div>
          <h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Assignments</h3>
          <div className="text-muted text-sm">Create one assignment and assign to multiple classes on the same track</div>
        </div>
        <button onClick={() => setShowNew((v) => !v)} className="btn btn-primary btn-sm">+ New Assignment</button>
      </div>

      {showNew && (
        <div className="card mb-20">
          <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 16 }}>Create Assignment</div>
          <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
              <div><label className="form-label">Title</label><input required className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Module 5 Practical Task" /></div>
              <div><label className="form-label">Track</label>
                <select
                  className="form-input"
                  value={form.track}
                  onChange={e => {
                    const nextTrack = e.target.value
                    const nextClasses = classOptions.filter((c) => c.track === nextTrack).map((c) => c.className)
                    setForm({ ...form, track: nextTrack, classNames: nextClasses, moduleId: '' })
                  }}
                  style={{ appearance: 'none' }}
                >
                  {trackChoices.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
                  {trackChoices.length === 0 && <option value="TRACK_1">Track 1</option>}
                </select>
              </div>
              <div><label className="form-label">Due Date</label><input required type="datetime-local" className="form-input" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></div>
            </div>
            <div>
              <label className="form-label">Target Classes</label>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,220px))',gap:8}}>
                {classesForTrack.map((c) => (
                  <label key={c.className} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',border:'1px solid var(--border2)',borderRadius:8,cursor:'pointer',background:'var(--muted3)'}}>
                    <input
                      type="checkbox"
                      checked={form.classNames.includes(c.className)}
                      onChange={() => toggleClassTarget(c.className)}
                      style={{accentColor:'var(--teal)'}}
                    />
                    <span style={{fontSize:13,color:'var(--white)'}}>{c.className}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="form-label">Module</label>
              <select
                className="form-input"
                value={form.moduleId}
                onChange={e => setForm({ ...form, moduleId: e.target.value })}
                style={{ appearance: 'none' }}
                disabled={loadingModules}
                required
              >
                <option value="">{loadingModules ? 'Loading modules…' : 'Select module…'}</option>
                {modulesForTrack.map((m: any, i: number) => (
                  <option key={`${m.value}-${i}`} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div><label className="form-label">Description</label><textarea required rows={4} className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ resize: 'vertical' }} /></div>
            <div>
              <label className="form-label">Assignment File (optional)</label>
              <input type="file" onChange={e => setMaterialFile(e.target.files?.[0] || null)} />
              <div className="text-xs text-muted mt-4">Students can download this from their Assignment page.</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Create Assignment →'}</button>
              <button type="button" onClick={() => setShowNew(false)} className="btn btn-ghost btn-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p className="text-muted text-sm" style={{ padding: 20 }}>Loading assignments…</p> : (
        <div className="card">
          <table className="data-table">
            <thead><tr><th>Title</th><th>Class</th><th>Track</th><th>Due</th><th>Submissions</th><th>Action</th></tr></thead>
            <tbody>
              {items.map((a: any) => {
                const classTrack = classOptions.find((c) => c.className === a.className)?.track || ''
                return (
                  <tr key={a.id}>
                    <td>
                      <div style={{fontWeight:600,color:'var(--white)'}}>{a.title}</div>
                      <div style={{fontSize:12,color:'var(--muted)'}}>{a.description}</div>
                    </td>
                    <td>{a.className}</td>
                    <td>{classTrack ? String(classTrack).replace('TRACK_', 'Track ') : '—'}</td>
                    <td>{a.dueDate ? new Date(a.dueDate).toLocaleString('en-NG') : '—'}</td>
                    <td>{a._count?.submissions ?? 0}</td>
                    <td><button onClick={() => remove(a.id)} className="btn btn-danger btn-sm" style={{fontSize:11,padding:'4px 8px'}}>Delete</button></td>
                  </tr>
                )
              })}
              {items.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>No assignments yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── PRACTICALS ────────────────────────────────────────────────
function TutorPracticals({ classes }: { classes: any[] }) {
  const [tasks, setTasks] = useState<any[]>([])
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [savingTask, setSavingTask] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)
  const [grading, setGrading] = useState(false)
  const [scoreBySubmission, setScoreBySubmission] = useState<Record<string, string>>({})
  const [feedbackBySubmission, setFeedbackBySubmission] = useState<Record<string, string>>({})
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<string[]>([])
  const [bulkScore, setBulkScore] = useState('')
  const [bulkFeedback, setBulkFeedback] = useState('')
  const classOptions = Array.from(
    new Map(
      (Array.isArray(classes) ? classes : [])
        .filter((c: any) => c?.className)
        .map((c: any) => [
          c.className,
          { className: c.className, track: c.track || 'TRACK_1', schoolId: c.schoolId || c.school?.id || '' },
        ])
    ).values()
  ) as Array<{ className: string; track: string; schoolId: string }>
  const { data: dynamicTracks } = useQuery({
    queryKey: ['tutor', 'tracks-options'],
    queryFn: () => tracksApi.all(),
    staleTime: 60_000,
    retry: 1,
  })
  const classTrackCodes = Array.from(new Set(classOptions.map((c) => c.track)))
  const activeTrackChoices = (Array.isArray(dynamicTracks) ? dynamicTracks : [])
    .filter((t: any) => t.isActive !== false)
    .map((t: any) => ({ code: String(t.code), label: String(t.name || String(t.code).replace('TRACK_', 'Track ')) }))
  const trackChoices = (activeTrackChoices.length ? activeTrackChoices : classTrackCodes.map((code) => ({ code, label: String(code).replace('TRACK_', 'Track ') })))
  const defaultTrack = trackChoices[0]?.code || 'TRACK_1'
  const [modulesForTrack, setModulesForTrack] = useState<any[]>([])
  const [loadingModules, setLoadingModules] = useState(false)
  const [form, setForm] = useState({
    title: '',
    track: defaultTrack,
    classNames: classOptions.filter((c) => c.track === defaultTrack).map((c) => c.className),
    moduleId: '',
    description: '',
    instructions: '',
    dueDate: '',
    maxScore: 100,
    passScore: 50,
    rubricText: '',
  })

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true)
    try {
      const data = await practicalsApi.listTasks()
      setTasks(Array.isArray(data) ? data : [])
    } catch {
      setTasks([])
    }
    setLoadingTasks(false)
  }, [])

  useEffect(() => { loadTasks() }, [loadTasks])
  useEffect(() => {
    if (!trackChoices.length) return
    if (!form.track || !trackChoices.some((t) => t.code === form.track)) {
      const nextTrack = trackChoices[0].code
      setForm((prev) => ({
        ...prev,
        track: nextTrack,
        classNames: classOptions.filter((c) => c.track === nextTrack).map((c) => c.className),
        moduleId: '',
      }))
    }
  }, [JSON.stringify(trackChoices), JSON.stringify(classOptions), form.track])
  useEffect(() => {
    const loadModules = async () => {
      if (!showNew || !form.track) return
      setLoadingModules(true)
      try {
        const data = await modulesApi.all(form.track)
        const list = Array.isArray(data) ? data : []
        setModulesForTrack(list)
        setForm((f: any) => {
          if (f.moduleId && list.some((m: any) => m.id === f.moduleId)) return f
          return { ...f, moduleId: list[0]?.id || '' }
        })
      } catch {
        setModulesForTrack([])
        setForm((f: any) => ({ ...f, moduleId: '' }))
      }
      setLoadingModules(false)
    }
    loadModules()
  }, [showNew, form.track])

  const classesForTrack = classOptions.filter((c) => c.track === form.track)
  const toggleClassTarget = (className: string) => {
    setForm((f: any) => ({
      ...f,
      classNames: f.classNames.includes(className)
        ? f.classNames.filter((c: string) => c !== className)
        : [...f.classNames, className],
    }))
  }
  const selectedModule = modulesForTrack.find((m: any) => m.id === form.moduleId)
  useEffect(() => {
    if (!showNew) return
    const generated = selectedModule ? `Practical: Module ${selectedModule.number} — ${selectedModule.title}` : ''
    if (generated && form.title !== generated) setForm((f: any) => ({ ...f, title: generated }))
  }, [showNew, form.moduleId, JSON.stringify(modulesForTrack), form.title])

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingTask(true)
    try {
      const targetClassNames = Array.from(new Set((form.classNames || []).filter(Boolean)))
      if (!targetClassNames.length) {
        notify.warning('Select at least one class')
        setSavingTask(false)
        return
      }
      if (!form.moduleId) {
        notify.warning('Select module')
        setSavingTask(false)
        return
      }
      const firstClass = classOptions.find((c) => c.className === targetClassNames[0])
      const schoolId = firstClass?.schoolId || classOptions[0]?.schoolId || ''
      if (!schoolId) {
        notify.warning('No school found for selected classes')
        setSavingTask(false)
        return
      }
      let rubric: any = undefined
      if (form.rubricText.trim()) {
        try { rubric = JSON.parse(form.rubricText) } catch { notify.warning('Rubric must be valid JSON if provided'); setSavingTask(false); return }
      }
      await practicalsApi.createTask({
        schoolId,
        className: targetClassNames[0],
        classNames: targetClassNames,
        moduleId: form.moduleId,
        title: form.title,
        description: form.description,
        instructions: form.instructions,
        dueDate: form.dueDate || undefined,
        maxScore: Number(form.maxScore) || 100,
        passScore: Number(form.passScore) || 50,
        rubric,
      })
      setShowNew(false)
      setForm({
        title: '',
        track: defaultTrack,
        classNames: classOptions.filter((c) => c.track === defaultTrack).map((c) => c.className),
        moduleId: '',
        description: '',
        instructions: '',
        dueDate: '',
        maxScore: 100,
        passScore: 50,
        rubricText: '',
      })
      await loadTasks()
    } catch (e: any) {
      notify.error(e?.message || 'Failed to create practical task')
    }
    setSavingTask(false)
  }

  const openTask = async (taskId: string) => {
    setSelectedTaskId(taskId)
    setSelectedSubmissionIds([])
    setBulkScore('')
    setBulkFeedback('')
    setLoadingSubmissions(true)
    try {
      const data = await practicalsApi.submissions(taskId)
      const rows = Array.isArray(data) ? data : []
      setSubmissions(rows)
      setScoreBySubmission(rows.reduce((acc: Record<string, string>, s: any) => ({ ...acc, [s.id]: s.totalScore != null ? String(s.totalScore) : '' }), {}))
      setFeedbackBySubmission(rows.reduce((acc: Record<string, string>, s: any) => ({ ...acc, [s.id]: s.feedback || '' }), {}))
    } catch {
      setSubmissions([])
    }
    setLoadingSubmissions(false)
  }

  const gradeOne = async (submissionId: string) => {
    const totalScore = Number(scoreBySubmission[submissionId])
    if (!Number.isFinite(totalScore)) {
      notify.warning('Enter a valid score before grading')
      return
    }
    setGrading(true)
    try {
      await practicalsApi.grade(submissionId, { totalScore, feedback: feedbackBySubmission[submissionId] || '' })
      if (selectedTaskId) await openTask(selectedTaskId)
    } catch (e: any) {
      notify.error(e?.message || 'Failed to grade submission')
    }
    setGrading(false)
  }

  const toggleSubmission = (id: string) => {
    setSelectedSubmissionIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const applyBulkGrade = async () => {
    if (!selectedTaskId) return
    const totalScore = Number(bulkScore)
    if (!Number.isFinite(totalScore)) {
      notify.warning('Enter a valid bulk score')
      return
    }
    const targetCount = selectedSubmissionIds.length || submissions.length
    if (!targetCount) {
      notify.warning('No submissions available to grade')
      return
    }
    if (!confirm(`Apply bulk score to ${targetCount} submission(s)?`)) return
    setGrading(true)
    try {
      await practicalsApi.bulkGrade(selectedTaskId, {
        submissionIds: selectedSubmissionIds.length ? selectedSubmissionIds : undefined,
        totalScore,
        feedback: bulkFeedback || undefined,
      })
      await openTask(selectedTaskId)
    } catch (e: any) {
      notify.error(e?.message || 'Failed to bulk grade')
    }
    setGrading(false)
  }

  return (
    <div>
      <div className="flex-between mb-20">
        <div>
          <h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Practical Assessments</h3>
          <div className="text-muted text-sm">Create module practical tasks, review submissions, and bulk grade safely</div>
        </div>
        <button onClick={() => setShowNew((v) => !v)} className="btn btn-primary btn-sm">+ New Practical Task</button>
      </div>

      {showNew && (
        <div className="card mb-20">
          <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 16 }}>Create Practical Task</div>
          <form onSubmit={createTask} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
              <div><label className="form-label">Title</label><input className="form-input" value={form.title} readOnly disabled /></div>
              <div><label className="form-label">Track</label>
                <select className="form-input" value={form.track} onChange={e => {
                  const nextTrack = e.target.value
                  const nextClasses = classOptions.filter((c) => c.track === nextTrack).map((c) => c.className)
                  setForm({ ...form, track: nextTrack, classNames: nextClasses, moduleId: '', title: '' })
                }} style={{ appearance: 'none' }}>
                  {trackChoices.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
                  {trackChoices.length === 0 && <option value="TRACK_1">Track 1</option>}
                </select>
              </div>
              <div><label className="form-label">Module</label>
                <select className="form-input" required value={form.moduleId} onChange={e => setForm({ ...form, moduleId: e.target.value })} style={{ appearance: 'none' }} disabled={loadingModules}>
                  <option value="">{loadingModules ? 'Loading modules…' : 'Select module…'}</option>
                  {modulesForTrack.map((m: any) => <option key={m.id} value={m.id}>{`Module ${m.number}: ${m.title}`}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="form-label">Target Classes</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,220px))', gap: 8 }}>
                {classesForTrack.map((c) => (
                  <label key={c.className} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--border2)', borderRadius: 8, cursor: 'pointer', background: 'var(--muted3)' }}>
                    <input type="checkbox" checked={form.classNames.includes(c.className)} onChange={() => toggleClassTarget(c.className)} style={{ accentColor: 'var(--teal)' }} />
                    <span style={{ fontSize: 13, color: 'var(--white)' }}>{c.className}</span>
                  </label>
                ))}
              </div>
            </div>
            <div><label className="form-label">Description</label><textarea className="form-input" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ resize: 'vertical' }} /></div>
            <div><label className="form-label">Instructions</label><textarea className="form-input" rows={3} value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} style={{ resize: 'vertical' }} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', gap: 12 }}>
              <div><label className="form-label">Due Date (optional)</label><input type="datetime-local" className="form-input" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></div>
              <div><label className="form-label">Max Score</label><input type="number" className="form-input" min={1} value={form.maxScore} onChange={e => setForm({ ...form, maxScore: +e.target.value })} /></div>
              <div><label className="form-label">Pass Score</label><input type="number" className="form-input" min={0} value={form.passScore} onChange={e => setForm({ ...form, passScore: +e.target.value })} /></div>
            </div>
            <div>
              <label className="form-label">Rubric JSON (optional)</label>
              <textarea className="form-input" rows={3} placeholder='[{"criterion":"Game logic","weight":30}]' value={form.rubricText} onChange={e => setForm({ ...form, rubricText: e.target.value })} style={{ resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 12 }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={savingTask}>{savingTask ? 'Saving…' : 'Create Practical Task →'}</button>
              <button type="button" onClick={() => setShowNew(false)} className="btn btn-ghost btn-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="content-grid" style={{ gridTemplateColumns: '1.1fr 1fr' }}>
        <div className="card">
          <div className="font-display fw-600 text-white mb-16">Practical Tasks</div>
          {loadingTasks ? <p className="text-muted text-sm">Loading tasks…</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tasks.map((t: any) => (
                <button key={t.id} onClick={() => openTask(t.id)} className="btn btn-ghost btn-sm" style={{ justifyContent: 'space-between', textAlign: 'left', border: selectedTaskId === t.id ? '1px solid var(--gold)' : '1px solid var(--border2)', padding: '10px 12px' }}>
                  <div>
                    <div style={{ color: 'var(--white)', fontWeight: 600 }}>{t.title}</div>
                    <div className="text-muted text-xs">{t.className} · {t.module ? `Module ${t.module.number}` : 'Module'} · Due {t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-NG') : '—'}</div>
                  </div>
                  <span className="badge badge-info">{t._count?.submissions ?? 0}</span>
                </button>
              ))}
              {tasks.length === 0 && <div className="text-muted text-sm">No practical tasks yet.</div>}
            </div>
          )}
        </div>

        <div className="card">
          <div className="font-display fw-600 text-white mb-16">Submissions & Grading</div>
          {!selectedTaskId ? (
            <div className="text-muted text-sm">Select a practical task to view submissions.</div>
          ) : loadingSubmissions ? (
            <div className="text-muted text-sm">Loading submissions…</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 8, marginBottom: 10 }}>
                <input type="number" className="form-input" placeholder="Bulk score" value={bulkScore} onChange={(e) => setBulkScore(e.target.value)} />
                <input className="form-input" placeholder="Bulk feedback (optional)" value={bulkFeedback} onChange={(e) => setBulkFeedback(e.target.value)} />
                <button className="btn btn-primary btn-sm" onClick={applyBulkGrade} disabled={grading}>{grading ? 'Applying…' : 'Bulk Grade'}</button>
              </div>
              <table className="data-table">
                <thead><tr><th></th><th>Student</th><th>Evidence</th><th>Score</th><th>Feedback</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {submissions.map((s: any) => (
                    <tr key={s.id}>
                      <td><input type="checkbox" checked={selectedSubmissionIds.includes(s.id)} onChange={() => toggleSubmission(s.id)} /></td>
                      <td>{s.student ? `${s.student.user?.firstName || ''} ${s.student.user?.lastName || ''}`.trim() : s.studentId}</td>
                      <td>
                        {s.evidenceUrl ? <a href={s.evidenceUrl} target="_blank" rel="noreferrer">Open</a> : '—'}
                        {s.evidenceText ? <div className="text-muted text-xs">{s.evidenceText.slice(0, 60)}{s.evidenceText.length > 60 ? '…' : ''}</div> : null}
                      </td>
                      <td><input className="form-input" style={{ width: 84 }} value={scoreBySubmission[s.id] ?? ''} onChange={(e) => setScoreBySubmission((prev) => ({ ...prev, [s.id]: e.target.value }))} /></td>
                      <td><input className="form-input" value={feedbackBySubmission[s.id] ?? ''} onChange={(e) => setFeedbackBySubmission((prev) => ({ ...prev, [s.id]: e.target.value }))} /></td>
                      <td><span className={`badge badge-${s.status === 'PASSED' ? 'success' : s.status === 'REWORK_REQUIRED' ? 'warning' : 'info'}`}>{s.status}</span></td>
                      <td><button className="btn btn-ghost btn-sm" onClick={() => gradeOne(s.id)} disabled={grading}>Grade</button></td>
                    </tr>
                  ))}
                  {submissions.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: '22px 0' }}>No submissions yet for this task.</td></tr>}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── MESSAGES ─────────────────────────────────────────────────
function TutorMessages({ classes }: { classes: any[] }) {
  const [conversations, setConversations] = useState<any[]>([])
  const [active, setActive] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadConvos = useCallback(async () => {
    try {
      const data = await messagesApi.conversations()
      setConversations(Array.isArray(data) ? data : [])
    } catch {
      setConversations([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadConvos() }, [loadConvos])

  const openConversation = async (convo: any) => {
    setActive(convo)
    try {
      const msgs = await messagesApi.getMessages(convo.id)
      setMessages(Array.isArray(msgs) ? msgs : [])
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      // refresh unread count
      setConversations(cs => cs.map(c => c.id === convo.id ? { ...c, unreadCount: 0 } : c))
    } catch { setMessages([]) }
  }

  const send = async () => {
    if (!input.trim() || !active) return
    setSending(true)
    try {
      const msg = await messagesApi.send(active.id, input)
      setMessages(m => [...m, msg]); setInput('')
      setConversations(cs => cs.map(c => c.id === active.id ? { ...c, lastMessage: input, lastMessageAt: new Date() } : c))
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (e: any) { notify.fromError(e) }
    setSending(false)
  }

  const startNew = async (studentId: string, schoolId: string) => {
    try {
      const convo = await messagesApi.start(studentId, schoolId)
      setConversations(cs => cs.find(c => c.id === convo.id) ? cs : [convo, ...cs])
      openConversation(convo)
    } catch (e: any) { notify.fromError(e) }
  }

  const userId = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('adhara_user') || '{}').id || '' : ''

  return (
    <div>
      <div className="flex-between mb-20"><div><h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Messages</h3><div className="text-muted text-sm">{conversations.filter(c => c.unreadCount > 0).length} unread conversations</div></div></div>
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, height: 540 }}>
        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border2)', fontSize: 12, fontWeight: 600, color: 'var(--muted)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Conversations</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && <p className="text-muted text-sm" style={{ padding: 16 }}>Loading…</p>}
            {!loading && conversations.length === 0 && (
              <div style={{ padding: 16 }}>
                <p className="text-muted text-sm mb-12">No conversations yet.</p>
                {classes.slice(0, 1).flatMap(c => (c.students || []).slice(0, 3)).map((s: any, i: number) => {
                  const name = `${s.user?.firstName} ${s.user?.lastName}`
                  return (
                    <button key={i} onClick={() => startNew(s.id, s.schoolId)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'var(--muted3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', marginBottom: 6, color: 'var(--white)', textAlign: 'left', fontSize: 12 }}>
                      <div className="stu-av" style={{ ...studentColor(i), width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{initials(name)}</div>
                      Message {s.user?.firstName}
                    </button>
                  )
                })}
              </div>
            )}
            {conversations.map((c: any, i: number) => {
              const other = c.student
              const name = `${other?.firstName} ${other?.lastName}`
              return (
                <div key={c.id} onClick={() => openConversation(c)} style={{ padding: '12px 14px', background: active?.id === c.id ? 'rgba(212,168,83,0.07)' : 'transparent', borderBottom: '1px solid var(--border2)', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start', borderLeft: active?.id === c.id ? '3px solid var(--gold)' : '3px solid transparent' }}>
                  <div className="stu-av" style={{ ...studentColor(i), width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-display)', flexShrink: 0 }}>{initials(name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 13, fontWeight: 600, color: 'var(--white)' }}>{name}</span>{c.unreadCount > 0 && <span style={{ background: 'var(--gold)', color: 'var(--navy)', fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 10 }}>{c.unreadCount}</span>}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{c.lastMessage || 'Start conversation'}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        {/* Chat */}
        {active ? (
          <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border2)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="stu-av" style={{ ...studentColor(0), width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{initials(`${active.student?.firstName} ${active.student?.lastName}`)}</div>
              <div><div style={{ fontWeight: 600, color: 'var(--white)', fontSize: 14 }}>{active.student?.firstName} {active.student?.lastName}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>Student · Track 3</div></div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.map((msg: any, i: number) => {
                const isMe = msg.senderId === userId || msg.sender?.id === userId
                const studentLabel =
                  `${active?.student?.firstName || ''}`.trim() || 'Student'
                const whoLabel = isMe ? 'You' : studentLabel
                return (
                  <div
                    key={msg.id || i}
                    className={isMe ? 'chat-msg-row chat-msg-row--me' : 'chat-msg-row chat-msg-row--them'}
                  >
                    <div className={isMe ? 'chat-bubble chat-bubble--me' : 'chat-bubble chat-bubble--them'}>
                      <div className="chat-bubble__who">{whoLabel}</div>
                      <div className="chat-bubble__body">{msg.body}</div>
                      <div className="chat-bubble__time">
                        {new Date(msg.createdAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border2)', display: 'flex', gap: 8 }}>
              <input style={{ flex: 1, background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--white)', fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none' }}
                placeholder={`Message ${active.student?.firstName}…`} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())} />
              <button onClick={send} className="btn btn-primary btn-sm" disabled={sending}>{sending ? '…' : 'Send'}</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', color: 'var(--muted)', fontSize: 14 }}>Select a conversation to start messaging</div>
        )}
      </div>
    </div>
  )
}

// ─── CBT BUILDER ──────────────────────────────────────────────
function CBTBuilder({ classes }: { classes: any[] }) {
  const [view, setView] = useState<'list' | 'create'>('list')
  const [exams, setExams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')
  const [modulesForTrack, setModulesForTrack] = useState<any[]>([])
  const [loadingModules, setLoadingModules] = useState(false)
  const [form, setForm] = useState({ title: '', track: '', moduleId: '', className: classes[0]?.className || 'SS3A', durationMins: 30, questions: [{ q: '', options: ['', '', '', ''], correct: 0, explanation: '' }] })
  const { data: dynamicTracks } = useQuery({
    queryKey: ['tutor', 'tracks-options'],
    queryFn: () => tracksApi.all(),
    staleTime: 60_000,
    retry: 1,
  })
  const trackOptions = (Array.isArray(dynamicTracks) ? dynamicTracks : [])
    .filter((t: any) => t.isActive !== false)
    .map((t: any) => ({ code: String(t.code), label: String(t.name || String(t.code).replace('TRACK_', 'Track ')) }))

  useEffect(() => {
    cbtApi.myExams().then(d => setExams(Array.isArray(d) ? d : [])).catch(() => setExams([])).finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    if (!trackOptions.length) return
    if (!form.track || !trackOptions.some((t) => t.code === form.track)) {
      setForm((prev) => ({ ...prev, track: trackOptions[0].code }))
    }
  }, [JSON.stringify(trackOptions), form.track])
  useEffect(() => {
    const loadModules = async () => {
      if (!form.track || view !== 'create') return
      setLoadingModules(true)
      try {
        const data = await modulesApi.all(form.track)
        const list = Array.isArray(data) ? data : []
        setModulesForTrack(list)
        setForm((f: any) => {
          if (f.moduleId && list.some((m: any) => m.id === f.moduleId)) return f
          return { ...f, moduleId: list[0]?.id || '' }
        })
      } catch {
        setModulesForTrack([])
        setForm((f: any) => ({ ...f, moduleId: '' }))
      }
      setLoadingModules(false)
    }
    loadModules()
  }, [form.track, view])
  const selectedModule = modulesForTrack.find((m: any) => m.id === form.moduleId)
  const generatedTitle = selectedModule ? `Module ${selectedModule.number}: ${selectedModule.title} Assessment` : ''
  useEffect(() => {
    if (view !== 'create') return
    if (form.title !== generatedTitle) {
      setForm((prev) => ({ ...prev, title: generatedTitle }))
    }
  }, [generatedTitle, view])

  const addQ = () => setForm(f => ({ ...f, questions: [...f.questions, { q: '', options: ['', '', '', ''], correct: 0, explanation: '' }] }))
  const removeQ = (i: number) => setForm(f => ({ ...f, questions: f.questions.filter((_, j) => j !== i) }))
  const setQ = (i: number, field: string, val: any) => setForm(f => ({ ...f, questions: f.questions.map((q, j) => j === i ? { ...q, [field]: val } : q) }))
  const setOpt = (qi: number, oi: number, val: string) => setForm(f => ({ ...f, questions: f.questions.map((q, j) => j === qi ? { ...q, options: q.options.map((o: string, k: number) => k === oi ? val : o) } : q) }))

  const saveExam = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      if (!form.moduleId) {
        notify.warning('Select a module for this assessment')
        setSaving(false)
        return
      }
      const newExam = await cbtApi.create({
        title: generatedTitle,
        moduleId: form.moduleId,
        track: form.track,
        durationMins: form.durationMins,
        questions: form.questions.map((q, i) => ({ questionText: q.q, options: q.options, correctIndex: q.correct, explanation: q.explanation, number: i + 1 })),
      })
      setExams(ex => [newExam, ...ex])
      setSaved(newExam.id); setView('list')
    } catch (e: any) { notify.fromError(e) }
    setSaving(false)
  }

  const statusInfo = (e: any) => {
    if (e.isVetted && e.isPublished) return { label: 'Approved · Live', bg: 'rgba(34,197,94,0.15)', color: '#4ADE80', border: 'rgba(34,197,94,0.3)' }
    if (e.isVetted) return { label: 'Vetted · Unpublished', bg: 'rgba(26,127,212,0.15)', color: 'var(--teal2)', border: 'rgba(26,127,212,0.3)' }
    return { label: 'Awaiting Approval', bg: 'rgba(245,158,11,0.15)', color: '#FCD34D', border: 'rgba(245,158,11,0.3)' }
  }

  if (view === 'create') return (
    <div>
      <div className="flex-between mb-20"><div><h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>New CBT Assessment</h3><div className="text-muted text-sm">After saving, it goes to Super Admin for vetting before going live</div></div><button onClick={() => setView('list')} className="btn btn-ghost btn-sm">← Back</button></div>
      <form onSubmit={saveExam}>
        <div className="card mb-16">
          <div className="font-display fw-600 text-white mb-16">Assessment Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 16 }}>
            <div><label className="form-label">Title</label><input className="form-input" value={generatedTitle || 'Select module to generate title'} readOnly disabled /></div>
            <div><label className="form-label">Track</label>
              <select className="form-input" value={form.track} onChange={e => setForm({ ...form, track: e.target.value, moduleId: '', title: '' })} style={{ appearance: 'none' }}>
                {(trackOptions.length ? trackOptions : [{ code: 'TRACK_1', label: 'Track 1' }, { code: 'TRACK_2', label: 'Track 2' }, { code: 'TRACK_3', label: 'Track 3' }]).map((t) => (
                  <option key={t.code} value={t.code}>{t.label}</option>
                ))}
              </select>
            </div>
            <div><label className="form-label">Module</label>
              <select
                className="form-input"
                required
                value={form.moduleId || ''}
                onChange={e => setForm({ ...form, moduleId: e.target.value })}
                style={{ appearance: 'none' }}
                disabled={loadingModules}
              >
                <option value="">{loadingModules ? 'Loading modules…' : 'Select module…'}</option>
                {modulesForTrack.map((m: any) => (
                  <option key={m.id} value={m.id}>{`Module ${m.number}: ${m.title}`}</option>
                ))}
              </select>
            </div>
            <div><label className="form-label">Duration (min)</label><input type="number" className="form-input" min={5} max={120} value={form.durationMins} onChange={e => setForm({ ...form, durationMins: +e.target.value })} /></div>
          </div>
        </div>
        {form.questions.map((q, qi) => (
          <div key={qi} className="question-block" style={{ marginBottom: 12 }}>
            <div className="flex-between mb-12"><span style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>Q{qi + 1}</span>{form.questions.length > 1 && <button type="button" onClick={() => removeQ(qi)} className="btn btn-danger btn-sm" style={{ padding: '4px 10px', fontSize: 11 }}>Remove</button>}</div>
            <div style={{ marginBottom: 12 }}><label className="form-label">Question</label><textarea className="form-input" rows={2} required value={q.q} onChange={e => setQ(qi, 'q', e.target.value)} style={{ resize: 'vertical' }} /></div>
            <label className="form-label" style={{ display: 'block', marginBottom: 8 }}>Options (mark correct)</label>
            {q.options.map((o: string, oi: number) => (
              <div key={oi} className="option-input-row" style={{ marginBottom: 8 }}>
                <div className="option-letter-badge">{String.fromCharCode(65 + oi)}</div>
                <input className="form-input" style={{ flex: 1 }} value={o} onChange={e => setOpt(qi, oi, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + oi)}`} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                  <input type="radio" name={`correct-${qi}`} checked={q.correct === oi} onChange={() => setQ(qi, 'correct', oi)} style={{ accentColor: 'var(--success)' }} /> Correct
                </label>
              </div>
            ))}
            <div style={{ marginTop: 8 }}><label className="form-label">Explanation</label><input className="form-input" value={q.explanation} onChange={e => setQ(qi, 'explanation', e.target.value)} placeholder="Why this answer is correct…" /></div>
          </div>
        ))}
        <button type="button" onClick={addQ} className="btn btn-ghost btn-sm" style={{ marginBottom: 20 }}>+ Add Question</button>
        <div style={{ display: 'flex', gap: 12 }}><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save & Submit for Vetting →'}</button><button type="button" className="btn btn-ghost" onClick={() => setView('list')}>Cancel</button></div>
      </form>
    </div>
  )

  return (
    <div>
      <div className="card mb-20"><div className="flex-between mb-4"><div><div className="font-display fw-700 text-white mb-4" style={{ fontSize: 18 }}>CBT Assessment Builder</div><div className="text-muted text-sm">Create, manage & submit assessments for student testing</div></div><button onClick={() => { setView('create'); setSaved('') }} className="btn btn-primary btn-sm">+ New Assessment</button></div></div>
      {saved && <div style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#4ADE80' }}>✓ Assessment submitted for vetting by Super Admin</div>}
      {loading ? <p className="text-muted text-sm" style={{ padding: 20 }}>Loading assessments…</p> : (
        <div className="card">
          <table className="data-table">
            <thead><tr><th>Title</th><th>Track</th><th>Questions</th><th>Duration</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {exams.map((e: any) => {
                const si = statusInfo(e)
                return (
                  <tr key={e.id}>
                    <td><strong style={{ color: 'var(--white)' }}>{e.title}</strong></td>
                    <td><span className="badge badge-info">{e.track?.replace('TRACK_', 'Track ')}</span></td>
                    <td>{e.totalQuestions || e._count?.questions || 0}</td>
                    <td>{e.durationMins} min</td>
                    <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: si.bg, color: si.color, border: `1px solid ${si.border}` }}>{si.label}</span></td>
                    <td><button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>View</button></td>
                  </tr>
                )
              })}
              {exams.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>No assessments yet. Create your first one above.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── WEEKLY REPORT ────────────────────────────────────────────
function WeeklyReport({ classes, tutorId }: { classes: any[]; tutorId: string }) {
  const [past, setPast] = useState<any[]>([])
  const [form, setForm] = useState({ weekStart: '', weekEnd: '', attendanceRate: 90, topicsA: '', topicsB: '', highlights: '', challenges: '', nextWeekPlan: '', supportNeeded: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { reportsApi.mine().then(d => setPast(Array.isArray(d) ? d : [])).catch(() => {}) }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      const schoolId = classes[0]?.schoolId || classes[0]?.school?.id || ''
      const className = classes[0]?.className || 'SS3A'
      const track = classes[0]?.track || 'TRACK_3'
      const report = await reportsApi.create({
        schoolId, className, track,
        weekStart: form.weekStart, weekEnd: form.weekEnd,
        attendanceRate: form.attendanceRate,
        topics: [...form.topicsA.split('\n'), ...form.topicsB.split('\n')].filter(Boolean),
        highlights: form.highlights, challenges: form.challenges,
        nextWeekPlan: form.nextWeekPlan,
      })
      await reportsApi.submit(report.id)
      setPast(p => [report, ...p]); setSaved(true)
    } catch (e: any) { notify.fromError(e) }
    setSaving(false)
  }

  return (
    <div>
      <div className="flex-between mb-20">
        <div><div className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Weekly Progress Report</div><div className="text-muted text-sm">Submit weekly · Required for payroll processing by AdharaEdu</div></div>
        {saved && <span className="badge badge-success">✓ Submitted</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { val: past.filter(r => r.status === 'SUBMITTED' || r.status === 'REVIEWED').length, label: 'Reports Submitted', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)', color: 'var(--success)' },
          { val: past.filter(r => r.status === 'DRAFT').length, label: 'Drafts Pending', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', color: 'var(--warning)' },
          { val: past.filter(r => r.status === 'REVIEWED').length, label: 'Reviewed', bg: 'rgba(26,127,212,0.08)', border: 'rgba(26,127,212,0.2)', color: 'var(--teal2)' },
          { val: past.length, label: 'Total This Term', bg: 'rgba(212,168,83,0.08)', border: 'rgba(212,168,83,0.2)', color: 'var(--gold)' },
        ].map(s => (
          <div key={s.label} style={{ padding: 16, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 'var(--radius)', textAlign: 'center' }}>
            <div className="font-display fw-700" style={{ fontSize: 22, color: s.color }}>{s.val}</div>
            <div className="text-muted text-xs mt-4">{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20 }}>⚠️</span>
        <div style={{ flex: 1 }}><div className="fw-700 text-white mb-4">Weekly report required for payroll</div><div className="text-muted text-sm">AdharaEdu processes tutor payroll only after reports are submitted. Submit before end of each week.</div></div>
      </div>
      <div className="card">
        <div className="font-display fw-600 text-white mb-4">New Weekly Report</div>
        <div className="text-muted text-sm mb-20">Covers classes: {classes.map(c => c.className).join(', ') || 'No classes assigned'}</div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div><label className="form-label">Week Start</label><input type="date" className="form-input" required value={form.weekStart} onChange={e => setForm({ ...form, weekStart: e.target.value })} /></div>
            <div><label className="form-label">Week End</label><input type="date" className="form-input" required value={form.weekEnd} onChange={e => setForm({ ...form, weekEnd: e.target.value })} /></div>
            <div><label className="form-label">Attendance Rate %</label><input type="number" className="form-input" min={0} max={100} value={form.attendanceRate} onChange={e => setForm({ ...form, attendanceRate: +e.target.value })} /></div>
          </div>
          <div><label className="form-label">Topics Covered — {classes[0]?.className || 'Class A'}</label><textarea className="form-input" rows={3} placeholder="One topic per line…" value={form.topicsA} onChange={e => setForm({ ...form, topicsA: e.target.value })} style={{ resize: 'vertical' }} /></div>
          {classes[1] && <div><label className="form-label">Topics Covered — {classes[1].className}</label><textarea className="form-input" rows={3} placeholder="One topic per line…" value={form.topicsB} onChange={e => setForm({ ...form, topicsB: e.target.value })} style={{ resize: 'vertical' }} /></div>}
          <div><label className="form-label">Highlights & Student Achievements</label><textarea className="form-input" rows={3} value={form.highlights} onChange={e => setForm({ ...form, highlights: e.target.value })} style={{ resize: 'vertical' }} /></div>
          <div><label className="form-label">Challenges Encountered</label><textarea className="form-input" rows={3} value={form.challenges} onChange={e => setForm({ ...form, challenges: e.target.value })} style={{ resize: 'vertical' }} /></div>
          <div><label className="form-label">Next Week Plan</label><textarea className="form-input" rows={3} value={form.nextWeekPlan} onChange={e => setForm({ ...form, nextWeekPlan: e.target.value })} style={{ resize: 'vertical' }} /></div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" className="btn btn-primary" disabled={saving || saved}>{saving ? 'Submitting…' : saved ? '✓ Submitted' : 'Submit Report →'}</button>
            <button type="button" className="btn btn-ghost">Save as Draft</button>
          </div>
        </form>
      </div>
      {past.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 15 }}>Past Reports</div>
          <table className="data-table">
            <thead><tr><th>Week</th><th>School</th><th>Attendance</th><th>Status</th></tr></thead>
            <tbody>
              {past.map((r: any) => (
                <tr key={r.id}>
                  <td style={{ fontSize: 12 }}>{new Date(r.weekStart).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })} – {new Date(r.weekEnd).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}</td>
                  <td>{r.school?.name || '—'}</td>
                  <td><strong style={{ color: r.attendanceRate >= 85 ? 'var(--success)' : 'var(--warning)' }}>{r.attendanceRate}%</strong></td>
                  <td><span className={`badge badge-${r.status === 'REVIEWED' ? 'success' : r.status === 'SUBMITTED' ? 'teal' : 'warning'}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── PROFILE & SETTINGS ───────────────────────────────────────
function userNotifyPrefs(u: any) {
  return {
    notifyNewMessage: typeof u?.notifyNewMessage === 'boolean' ? u.notifyNewMessage : true,
    notifyReportDeadline: typeof u?.notifyReportDeadline === 'boolean' ? u.notifyReportDeadline : true,
    notifyExamResults: typeof u?.notifyExamResults === 'boolean' ? u.notifyExamResults : false,
  }
}

function TutorSettings({ tutor, onTutorRefresh }: { tutor: any; onTutorRefresh?: () => Promise<void> }) {
  const specToStr = (arr: unknown) => (Array.isArray(arr) ? arr.join(', ') : '')
  const [form, setForm] = useState({
    firstName: tutor?.user?.firstName || '',
    lastName: tutor?.user?.lastName || '',
    email: tutor?.user?.email || '',
    phone: tutor?.user?.phone || '',
    bio: tutor?.bio || '',
    specializations: specToStr(tutor?.specializations),
    bankName: tutor?.bankName || '',
    bankAccount: tutor?.bankAccount || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [notif, setNotif] = useState(() => userNotifyPrefs(tutor?.user))
  const [savingNotif, setSavingNotif] = useState(false)
  const [savedNotif, setSavedNotif] = useState(false)

  useEffect(() => {
    setNotif(userNotifyPrefs(tutor?.user))
  }, [tutor?.user?.notifyNewMessage, tutor?.user?.notifyReportDeadline, tutor?.user?.notifyExamResults])

  useEffect(() => {
    setForm({
      firstName: tutor?.user?.firstName || '',
      lastName: tutor?.user?.lastName || '',
      email: tutor?.user?.email || '',
      phone: tutor?.user?.phone || '',
      bio: tutor?.bio || '',
      specializations: specToStr(tutor?.specializations),
      bankName: tutor?.bankName || '',
      bankAccount: tutor?.bankAccount || '',
    })
  }, [
    tutor?.user?.firstName,
    tutor?.user?.lastName,
    tutor?.user?.email,
    tutor?.user?.phone,
    tutor?.bio,
    tutor?.specializations,
    tutor?.bankName,
    tutor?.bankAccount,
  ])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await usersApi.updateProfile({ firstName: form.firstName, lastName: form.lastName, phone: form.phone })
      const specializations = form.specializations
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      await tutorsApi.patchMyProfile({
        bio: form.bio.trim() || undefined,
        specializations,
        bankName: form.bankName.trim() || undefined,
        bankAccount: form.bankAccount.trim() || undefined,
      })
      await onTutorRefresh?.()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: any) {
      notify.fromError(e)
    }
    setSaving(false)
  }

  const saveNotifications = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingNotif(true)
    try {
      await usersApi.updateProfile({
        notifyNewMessage: notif.notifyNewMessage,
        notifyReportDeadline: notif.notifyReportDeadline,
        notifyExamResults: notif.notifyExamResults,
      })
      await onTutorRefresh?.()
      setSavedNotif(true)
      setTimeout(() => setSavedNotif(false), 2500)
    } catch (e: any) {
      notify.fromError(e)
    }
    setSavingNotif(false)
  }

  return (
    <div>
      <h3 className="font-display fw-700 text-white mb-8" style={{ fontSize: 20 }}>My profile</h3>
      <p className="text-muted text-sm mb-20" style={{ maxWidth: 720, lineHeight: 1.5 }}>
        Update how you appear to schools and HQ. Program <strong>tracks</strong> are set by Super Admin. To change ID documents or guarantors after onboarding, contact support or use{' '}
        <strong>Complete your profile</strong> from onboarding if still in draft.
      </p>

      <div className="card mb-24" style={{ maxWidth: 920, border: '1px solid rgba(26,127,212,0.35)' }}>
        <div className="flex-between mb-16" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div>
            <div className="font-display fw-600 text-white" style={{ fontSize: 17 }}>Edit profile</div>
            <div className="text-muted text-xs mt-4">Save once — updates name, bio, skills, contact & payroll.</div>
          </div>
          <span className="badge badge-teal" style={{ fontSize: 10 }}>Editable</span>
        </div>
        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="sidebar-avatar" style={{ width: 56, height: 56, fontSize: 18 }}>
              {(form.firstName[0] || '') + (form.lastName[0] || '')}
            </div>
            <div>
              <div className="font-display fw-700 text-white">{form.firstName} {form.lastName}</div>
              <div className="text-xs text-muted">AdharaEdu Tutor</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <label className="form-label">First name</label>
              <input className="form-input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            </div>
            <div>
              <label className="form-label">Last name</label>
              <input className="form-input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
            </div>
            <div>
              <label className="form-label">Phone</label>
              <input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input className="form-input" value={form.email} readOnly style={{ opacity: 0.65 }} title="Email cannot be changed here" />
            </div>
          </div>
          <div>
            <label className="form-label">Bio</label>
            <textarea
              className="form-input"
              rows={4}
              placeholder="Short professional summary for your profile…"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Specializations (comma separated)</label>
            <input
              className="form-input"
              placeholder="e.g. Python, Web development, Data literacy"
              value={form.specializations}
              onChange={(e) => setForm({ ...form, specializations: e.target.value })}
            />
          </div>
          <div style={{ borderTop: '1px solid var(--border2)', paddingTop: 16 }}>
            <div className="font-display fw-600 text-white mb-12" style={{ fontSize: 14 }}>Payroll (bank)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              <div>
                <label className="form-label">Bank name</label>
                <input className="form-input" placeholder="e.g. First Bank" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Account number</label>
                <input className="form-input" placeholder="Account number" value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} />
              </div>
            </div>
          </div>
          <div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'Saving…' : saved ? '✓ Profile saved' : 'Save profile'}
            </button>
          </div>
        </form>
      </div>

      <div className="card mb-20" style={{ maxWidth: 920 }}>
        <div className="font-display fw-600 text-white mb-12" style={{ fontSize: 15 }}>Notification preferences</div>
        <p className="text-muted text-xs mb-12">Choose what we can notify you about (saved on your account). Delivery by email/SMS when those channels are enabled.</p>
        <form onSubmit={saveNotifications}>
          {(
            [
              ['notifyNewMessage', 'New message from student', notif.notifyNewMessage],
              ['notifyReportDeadline', 'Report deadline reminder', notif.notifyReportDeadline],
              ['notifyExamResults', 'Exam results published', notif.notifyExamResults],
            ] as const
          ).map(([key, label, checked]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setNotif({ ...notif, [key]: e.target.checked })}
                style={{ accentColor: 'var(--teal)' }}
              />
              <span style={{ fontSize: 14, color: 'var(--muted)' }}>{label}</span>
            </label>
          ))}
          <div className="mt-12">
            <button type="submit" className="btn btn-primary btn-sm" disabled={savingNotif}>
              {savingNotif ? 'Saving…' : savedNotif ? '✓ Preferences saved' : 'Save notification preferences'}
            </button>
          </div>
        </form>
      </div>

      <h4 className="font-display fw-600 text-white mb-16" style={{ fontSize: 16 }}>Full record on file</h4>
      <p className="text-muted text-sm mb-16" style={{ maxWidth: 640 }}>
        Read-only view including verification documents and assignments (matches what admins see where applicable).
      </p>
      <TutorProfileDetail tutor={tutor} />
    </div>
  )
}

// ─── SESSION LOGGER ──────────────────────────────────────────
function SessionLogger({ classes }: { classes: any[] }) {
  const [active, setActive] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [modules, setModules] = useState<any[]>([])
  const [modulePick, setModulePick] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<any>(null)

  useEffect(() => {
    modulesApi.all().then((d) => setModules(Array.isArray(d) ? d : [])).catch(() => setModules([]))
  }, [])

  useEffect(() => {
    Promise.all([sessionsApi.active(), sessionsApi.myHistory()])
      .then(([a, h]) => { setActive(a?.id ? a : null); setHistory(Array.isArray(h) ? h : []) })
      .catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (active) {
      const startTime = new Date(active.startedAt).getTime()
      timerRef.current = setInterval(() => setElapsed(Math.round((Date.now() - startTime) / 60000)), 5000)
      setElapsed(Math.round((Date.now() - new Date(active.startedAt).getTime()) / 60000))
    } else {
      clearInterval(timerRef.current); setElapsed(0)
    }
    return () => clearInterval(timerRef.current)
  }, [active?.id])

  const modulesForTrack = (track: string) =>
    modules.filter((m: any) => String(m.track) === String(track))

  const startSession = async (assignment: any) => {
    const schoolId = assignment.schoolId || assignment.school?.id
    const className = assignment.className
    const track = assignment.track
    const tutorAssignmentId = assignment.id
    const moduleId = modulePick[tutorAssignmentId]?.trim() || undefined
    setStarting(true)
    try {
      const s = await sessionsApi.start({
        className,
        schoolId,
        track,
        tutorAssignmentId,
        moduleId,
      })
      setActive(s)
    } catch (e: any) { notify.fromError(e) }
    setStarting(false)
  }

  const endSession = async (notes?: string) => {
    if (!active) return
    try {
      await sessionsApi.end(active.id, notes)
      setActive(null)
      const h = await sessionsApi.myHistory().catch(() => [])
      setHistory(Array.isArray(h) ? h : [])
    } catch (e: any) { notify.fromError(e) }
  }

  return (
    <div>
      <div className="flex-between mb-20"><div><h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Session Log</h3><div className="text-muted text-sm">Start a session for each class — tied to your school assignment; optionally tag the <strong>module</strong> you’re focusing on (for payroll and HQ reports). Student progress still lives in Modules / Results.</div></div></div>
      {active ? (
        <div style={{ background: 'linear-gradient(135deg,rgba(34,197,94,0.12),rgba(26,127,212,0.08))', border: '1px solid rgba(34,197,94,0.35)', borderRadius: 'var(--radius-lg)', padding: 28, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--success)', animation: 'timerPulse 1s ease-in-out infinite', flexShrink: 0 }}></div>
            <div style={{ flex: 1 }}>
              <div className="font-display fw-700 text-white" style={{ fontSize: 18 }}>Session in progress — {active.className}</div>
              {active.module?.title && (
                <div className="text-muted text-sm mt-6">Module: <span style={{ color: 'var(--white)' }}>Mod {active.module.number}: {active.module.title}</span></div>
              )}
              <div className="text-muted text-sm mt-4">Started {new Date(active.startedAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })} · {elapsed} min elapsed</div>
            </div>
            <button onClick={() => endSession()} className="btn btn-danger btn-sm">End Session</button>
          </div>
        </div>
      ) : (
        <div className="card mb-20">
          <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 15 }}>Start a Session</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {classes.map((c: any) => (
              <div
                key={c.id}
                className="card"
                style={{
                  padding: 16,
                  minWidth: 220,
                  maxWidth: 320,
                  border: '1px solid var(--border2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--white)' }}>{c.className}</div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4, color: 'var(--muted)' }}>{c.school?.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{String(c.track || '').replace(/^TRACK_/i, 'Track ')}</div>
                  {c.weeklySessionExpectation && (
                    <div className="mt-8" style={{ fontSize: 11 }}>
                      <span
                        className={`badge ${c.weeklySessionExpectation.metExpectation ? 'badge-success' : 'badge-warning'}`}
                        style={{ fontSize: 10 }}
                      >
                        This week (UTC): {c.weeklySessionExpectation.deliveredThisWeek}/{c.weeklySessionExpectation.expected} sessions
                      </span>
                      {!c.weeklySessionExpectation.metExpectation && c.weeklySessionExpectation.shortBy > 0 && (
                        <span className="text-muted" style={{ marginLeft: 6 }}>({c.weeklySessionExpectation.shortBy} short)</span>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 11 }}>Module focus (optional)</label>
                  <select
                    className="form-input"
                    style={{ fontSize: 13 }}
                    value={modulePick[c.id] || ''}
                    onChange={(e) => setModulePick((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  >
                    <option value="">— Not specified —</option>
                    {modulesForTrack(c.track).map((m: any) => (
                      <option key={m.id} value={m.id}>
                        Mod {m.number}: {m.title}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" onClick={() => startSession(c)} className="btn btn-primary btn-sm" disabled={starting}>
                  Start session
                </button>
              </div>
            ))}
            {classes.length === 0 && <p className="text-muted text-sm">No classes assigned yet.</p>}
          </div>
        </div>
      )}
      <div className="card">
        <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 15 }}>Session History</div>
        {loading ? <p className="text-muted text-sm">Loading…</p> : (
          <table className="data-table">
            <thead><tr><th>Class</th><th>School</th><th>Module</th><th>Started</th><th>Duration</th><th>Attendance</th></tr></thead>
            <tbody>
              {history.map((s: any, i: number) => (
                <tr key={s.id || i}>
                  <td style={{ fontWeight: 600, color: 'var(--white)' }}>{s.className}</td>
                  <td style={{ fontSize: 12 }}>{s.school?.name}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{s.module ? `Mod ${s.module.number}: ${s.module.title}` : '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(s.startedAt).toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' })} {new Date(s.startedAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{s.durationMins ? `${s.durationMins} min` : '—'}</td>
                  <td><span className={`badge badge-${s.attendanceMarked ? 'success' : 'warning'}`}>{s.attendanceMarked ? 'Marked' : 'Pending'}</span></td>
                </tr>
              ))}
              {history.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>No sessions logged yet</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── MY PAYROLL ───────────────────────────────────────────────
function TutorPayrollView() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { payrollApi.mine().then(d => setData(Array.isArray(d) ? d : [])).catch(() => setData([])).finally(() => setLoading(false)) }, [])
  const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return (
    <div>
      <div className="flex-between mb-20"><div><h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>My Payroll</h3><div className="text-muted text-sm">Monthly payroll calculated by AdharaEdu based on sessions taught</div></div></div>
      {loading ? <p className="text-muted text-sm" style={{ padding: 20 }}>Loading…</p> : (
        <div className="card">
          <table className="data-table">
            <thead><tr><th>School</th><th>Period</th><th>Sessions</th><th>Rate/Session</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              {data.map((p: any) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600, color: 'var(--white)' }}>{p.school?.name}</td>
                  <td>{MONTHS[p.month]} {p.year}</td>
                  <td>{p.sessionsTaught}</td>
                  <td>₦{(p.ratePerSession||0).toLocaleString()}</td>
                  <td><strong style={{ color: 'var(--gold)' }}>₦{(p.totalAmount||0).toLocaleString()}</strong></td>
                  <td><span className={`badge badge-${p.isPaid ? 'success' : 'warning'}`}>{p.isPaid ? `Paid ${new Date(p.paidAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}` : 'Pending'}</span></td>
                </tr>
              ))}
              {data.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>No payroll records yet. AdharaEdu calculates based on logged sessions.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── EXAM SCHEDULER ───────────────────────────────────────────
function TutorExamScheduler({ classes }: { classes: any[] }) {
  const [exams, setExams] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    cbtExamId: '',
    className: classes[0]?.className || '',
    classNames: classes[0]?.className ? [classes[0].className] : [],
    scheduledAt: '',
    venue: 'Computer Lab B',
    durationMins: 60,
  })
  const [saving, setSaving] = useState(false)
  const selectedExam = exams.find((e: any) => e.id === form.cbtExamId)
  const targetClasses = selectedExam?.track
    ? classes.filter((c: any) => c.track === selectedExam.track)
    : classes

  const toggleClassTarget = (className: string) => {
    setForm((f: any) => {
      const exists = f.classNames.includes(className)
      const classNames = exists ? f.classNames.filter((c: string) => c !== className) : [...f.classNames, className]
      return { ...f, classNames, className: classNames[0] || className }
    })
  }

  useEffect(() => {
    Promise.all([
      cbtApi.myExams().catch(() => []),
      classes[0]?.schoolId ? examSchedulesApi.all(classes[0].schoolId).catch(() => []) : Promise.resolve([]),
    ]).then(([e, s]) => { setExams(Array.isArray(e) ? e : []); setSchedules(Array.isArray(s) ? s : []) }).finally(() => setLoading(false))
  }, [])

  const schedule = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      const classTargets = Array.from(new Set((form.classNames || []).filter(Boolean)))
      if (!classTargets.length) {
        notify.warning('Select at least one class')
        setSaving(false)
        return
      }
      const schoolId = classes.find(c => c.className === classTargets[0])?.schoolId || classes[0]?.school?.id || ''
      const s = await examSchedulesApi.create({
        ...form,
        className: classTargets[0],
        classNames: classTargets,
        schoolId,
      })
      const next = Array.isArray(s) ? s : [s]
      setSchedules(prev => [...next, ...prev])
      setForm(f => ({ ...f, cbtExamId: '', classNames: [], scheduledAt: '' }))
    } catch (e: any) { notify.fromError(e) }
    setSaving(false)
  }

  return (
    <div>
      <div className="flex-between mb-20"><div><h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Schedule Exams</h3><div className="text-muted text-sm">Assign one approved CBT exam to one or multiple classes on the same track</div></div></div>
      <div className="card mb-20">
        <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 15 }}>Create Schedule</div>
        <form onSubmit={schedule} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <div><label className="form-label">Approved Exam</label>
            <select className="form-input" required value={form.cbtExamId} onChange={e => setForm({ ...form, cbtExamId: e.target.value })} style={{ appearance: 'none' }}>
              <option value="">Select exam…</option>
              {exams.filter((e: any) => e.isVetted || e.isPublished).map((e: any) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Target Classes</label>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:8,padding:'8px',background:'var(--muted3)',border:'1px solid var(--border2)',borderRadius:8,maxHeight:132,overflowY:'auto'}}>
              {targetClasses.map((c: any) => (
                <label key={c.className} style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'var(--white)',cursor:'pointer'}}>
                  <input
                    type="checkbox"
                    checked={form.classNames.includes(c.className)}
                    onChange={() => toggleClassTarget(c.className)}
                    style={{accentColor:'var(--teal)'}}
                  />
                  <span>{c.className}</span>
                </label>
              ))}
            </div>
          </div>
          <div><label className="form-label">Date & Time</label><input type="datetime-local" className="form-input" required value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} /></div>
          <div><label className="form-label">Venue</label><input className="form-input" value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} /></div>
          <div><label className="form-label">Duration (min)</label><input type="number" className="form-input" value={form.durationMins} onChange={e => setForm({ ...form, durationMins: +e.target.value })} /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}><button type="submit" className="btn btn-primary btn-sm" style={{ width: '100%' }} disabled={saving}>{saving ? 'Scheduling…' : 'Schedule Exam →'}</button></div>
        </form>
        {exams.filter((e: any) => e.isVetted || e.isPublished).length === 0 && <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, fontSize: 13, color: '#FCD34D' }}>⚠️ You need at least one approved CBT exam before scheduling. Create one in CBT Builder.</div>}
      </div>
      {loading ? <p className="text-muted text-sm" style={{ padding: 20 }}>Loading…</p> : (
        <div className="card">
          <div className="font-display fw-600 text-white mb-16">Scheduled Exams</div>
          <table className="data-table">
            <thead><tr><th>Exam</th><th>Class</th><th>Date & Time</th><th>Venue</th><th>Status</th></tr></thead>
            <tbody>
              {schedules.map((s: any) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600, color: 'var(--white)', fontSize: 13 }}>{s.cbtExam?.title}</td>
                  <td>{s.className}</td>
                  <td style={{ fontSize: 12 }}>{new Date(s.scheduledAt).toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' })} {new Date(s.scheduledAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{s.venue}</td>
                  <td><span className={`badge badge-${s.status === 'SCHEDULED' ? 'info' : s.status === 'CANCELLED' ? 'danger' : 'success'}`}>{s.status}</span></td>
                </tr>
              ))}
              {schedules.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>No exams scheduled yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


// ─── MAIN PAGE ────────────────────────────────────────────────
export default function TutorDashboard() {
  const router = useRouter()
  const [section, setSection] = useState('tutor-dashboard')
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [tutor, setTutor] = useState<any>(null)
  const [stats, setStats] = useState<TutorStats | null>(null)
  const [classes, setClasses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { data: unreadMessagesData } = useQuery({
    queryKey: ['tutor', 'messages-unread'],
    queryFn: () => messagesApi.unreadCount(),
    staleTime: 30_000,
    retry: 1,
    enabled: !loading,
  })

  useEffect(() => {
    if (!localStorage.getItem('adhara_token')) { router.push('/auth/login'); return }
    const init = async () => {
      try {
        const t = await tutorsApi.me()
        if (t?.onboardingStatus === 'DRAFT') {
          router.replace('/dashboard/tutor/onboarding')
          setLoading(false)
          return
        }
        const [s, c] = await Promise.all([tutorsApi.myStats(), tutorsApi.myClasses()])
        const backendClasses = Array.isArray(c) ? c : []
        const schoolIds = Array.from(new Set(backendClasses.map((x: any) => x.schoolId || x.school?.id).filter(Boolean)))
        const savedClassArrays = await Promise.all(schoolIds.map((schoolId) => schoolClassesApi.all(schoolId).catch(() => [])))
        const savedClasses = savedClassArrays.flat().map((sc: any) => ({
          id: sc.id || `school-class-${sc.className}`,
          className: sc.className,
          track: sc.track,
          schoolId: sc.schoolId,
          school: backendClasses.find((b: any) => (b.schoolId || b.school?.id) === sc.schoolId)?.school || null,
          students: [],
        }))
        const merged = [...backendClasses]
        savedClasses.forEach((m: any) => {
          if (!m?.className) return
          if (!merged.some((x: any) => x.className === m.className && (x.schoolId || x.school?.id) === m.schoolId)) {
            merged.push(m)
          }
        })
        setTutor(t); setStats(s); setClasses(merged)
      } catch (e) {
        // Auth failed
        router.push('/auth/login')
      }
      setLoading(false)
    }
    init()
  }, [])

  const titles: Record<string, string> = {
    'tutor-dashboard': 'Tutor Dashboard', 'tutor-students': 'My Students', 'tutor-classes': 'Classes',
    'tutor-attendance': 'Attendance', 'tutor-results': 'Mark Results',
    'tutor-assignments': 'Assignments',
    'tutor-practicals': 'Practical Assessments',
    'tutor-lessons': 'Lesson Plans', 'tutor-messages': 'Messages',
    'tutor-cbt': 'CBT Builder', 'tutor-report': 'Weekly Report', 'tutor-settings': 'My profile', 'tutor-sessions': 'Session Log', 'tutor-payroll': 'My Payroll', 'tutor-exam-schedule': 'Schedule Exams',
    'class-insights': 'Class performance',
  }

  const classPerformanceChoices = useMemo<ClassPerformanceChoice[]>(() => {
    const byKey = new Map<string, ClassPerformanceChoice>()
    for (const c of classes) {
      const schoolId = String(c.schoolId || c.school?.id || '').trim()
      const className = String(c.className || '').trim()
      if (!schoolId || !className) continue
      const track = String(c.track || '').trim()
      const k = `${schoolId}::${track}::${className}`
      if (byKey.has(k)) continue
      const schoolName = c.school?.name || 'School'
      const trLabel = track ? track.replace(/^TRACK_/i, 'Track ') + ' · ' : ''
      byKey.set(k, {
        schoolId,
        className,
        track,
        label: `${className} · ${trLabel}${schoolName}`.replace(/ · $/, ''),
      })
    }
    return Array.from(byKey.values())
  }, [classes])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy)' }}>
      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 48, animation: 'float 2s ease-in-out infinite' }}>🎓</div><p style={{ color: 'var(--muted)', marginTop: 16 }}>Loading your portal…</p></div>
    </div>
  )

  const tutorId = tutor?.user?.id || ''
  const totalStudents = classes.reduce((sum, c: any) => sum + ((c.students || []).length), 0)
  const unreadMessages =
    typeof unreadMessagesData === 'number'
      ? unreadMessagesData
      : ((unreadMessagesData as any)?.count ?? (unreadMessagesData as any)?.unreadCount ?? 0)
  const navBadges = {
    'tutor-students': totalStudents > 0 ? totalStudents : null,
    'tutor-classes': classes.length > 0 ? classes.length : null,
    'tutor-assignments': null,
    'tutor-practicals': null,
    'tutor-messages': unreadMessages > 0 ? unreadMessages : null,
  }

  const render = () => {
    switch (section) {
      case 'tutor-students':
        return (
          <TutorStudents
            classes={classes}
            onClassesChange={setClasses}
            selectedClass={selectedClass}
            onBackToClasses={() => setSection('tutor-classes')}
            onClearClass={() => setSelectedClass(null)}
          />
        )
      case 'tutor-classes':
        return (
          <TutorClasses
            classes={classes}
            onClassesChange={setClasses}
            onOpenClass={(className) => {
              setSelectedClass(className)
              setSection('tutor-students')
            }}
          />
        )
      case 'tutor-attendance': return <TutorAttendance classes={classes} tutorId={tutorId} />
      case 'tutor-results': return <TutorResults classes={classes} />
      case 'tutor-assignments': return <TutorAssignments classes={classes} />
      case 'tutor-practicals': return <TutorPracticals classes={classes} />
      case 'tutor-lessons': return <LessonPlans classes={classes} />
      case 'tutor-messages': return <TutorMessages classes={classes} />
      case 'tutor-cbt': return <CBTBuilder classes={classes} />
      case 'tutor-report': return <WeeklyReport classes={classes} tutorId={tutorId} />
      case 'tutor-settings': return (
        <TutorSettings
          tutor={tutor}
          onTutorRefresh={async () => {
            const t = await tutorsApi.me()
            setTutor(t)
          }}
        />
      )
      case 'tutor-sessions': return <SessionLogger classes={classes} />
      case 'tutor-payroll': return <TutorPayrollView />
      case 'tutor-exam-schedule': return <TutorExamScheduler classes={classes} />
      case 'class-insights':
        return (
          <div>
            <div className="font-display fw-700 text-white mb-8" style={{ fontSize: 18 }}>Class performance</div>
            <p className="text-muted text-sm mb-20" style={{ maxWidth: 640, lineHeight: 1.5 }}>
              Attendance, module progress, and graded work for classes you are assigned to.
            </p>
            <ClassPerformancePanel presetChoices={classPerformanceChoices} />
          </div>
        )
      default: return <TutorOverview stats={stats} classes={classes} onSection={setSection} />
    }
  }

  return (
    <DashboardShell role="tutor" title={titles[section] || 'Dashboard'}
      subtitle={section === 'tutor-dashboard' ? `${classes.map(c => c.school?.name).filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'No schools assigned'} · Term 2, 2026` : undefined}
      section={section} onSectionChange={setSection} navBadges={navBadges}>
      {render()}
    </DashboardShell>
  )
}
