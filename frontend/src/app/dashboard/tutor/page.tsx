'use client'
import { useState, useEffect, useRef, useCallback, useMemo, useId } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { DashboardShell } from '@/components/DashboardShell'
import { ClassPerformancePanel } from '@/components/ClassPerformancePanel'
import { TutorLessonActivitiesPanel } from '@/components/learning/TutorLessonActivitiesPanel'
import type { ClassPerformanceChoice } from '@/components/ClassPerformancePanel'
import { TutorProfileDetail } from '@/components/TutorProfileDetail'
import {
  tutorsApi, attendanceApi, cbtApi, reportsApi,
  lessonsApi, messagesApi, studentsApi, usersApi, uploadsApi,
  sessionsApi, assignmentsApi, examSchedulesApi, bulkUploadApi, modulesApi, schoolClassesApi, tracksApi, practicalsApi,
  curriculumApi, tutorAttendanceApi,
  typingApi,
} from '@/lib/api'
import { notify } from '@/lib/notify'
import { LeaderboardPage } from '@/components/leaderboard/LeaderboardPage'

function parseExtensionList(raw?: string): string[] | undefined {
  const list = String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return list.length ? list : undefined
}
import { MaterialPreview } from '@/components/learning'
import { SubmissionGradingProposal, SubmissionTypeFields } from '@/components/grading/SubmissionGradingPanel'
import { SubmissionEvidenceLinks } from '@/components/grading/SubmissionEvidenceLinks'
import {
  AiReviewQueueCard,
  AiReviewItem,
  PENDING_AI_REVIEW_KEY,
  consumePendingAiReview,
  useUnifiedAiReviewQueue,
} from '@/components/grading/AiReviewQueueCard'
import { StructuredRubricBuilder } from '@/components/grading/StructuredRubricBuilder'
import type { StructuredRubric } from '@/components/grading/structured-rubric-defaults'

function Modal({
  open,
  onClose,
  title,
  children,
  /** Wider panels for dense dashboards; keeps within viewport on small screens */
  panelMaxWidth = 720,
  overlayZIndex = 1200,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  panelMaxWidth?: number | string
  overlayZIndex?: number
}) {
  const titleId = useId()
  if (!open) return null
  const maxW =
    typeof panelMaxWidth === 'number' ? `${panelMaxWidth}px` : (panelMaxWidth as string)
  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: overlayZIndex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: `min(${maxW}, calc(100vw - 24px))`,
          maxHeight: 'min(92vh, 92dvh)',
          background: 'var(--navy2)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
          <h3 id={titleId} style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--white)', lineHeight: 1.25, paddingRight: 8 }}>{title}</h3>
          <button type="button" aria-label="Close" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, flexShrink: 0 }}>✕</button>
        </div>
        <div style={{ padding: 16, overflow: 'auto', WebkitOverflowScrolling: 'touch', minHeight: 0 }}>{children}</div>
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
    <Modal open={open} onClose={onClose} title={title} overlayZIndex={1300}>
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

// ─── types ───────────────────────────────────────────────────
interface Student { id: string; name: string; reg: string; className: string; avg: number; att: number; atRisk: boolean; init: string; c: string; tc: string }
interface TutorStats { activeSchools: number; totalStudents: number; submittedReports: number; pendingReports: number; cbtExams: number; rating: number }

// ─── helpers ─────────────────────────────────────────────────
/** Same merge as tutor dashboard init — assignment rows from API + school registry classes. */
async function fetchMergedTutorClasses(): Promise<any[]> {
  const c = await tutorsApi.myClasses()
  const backendClasses = Array.isArray(c) ? c : []
  const norm = (v: any) => String(v || '').trim().toUpperCase()
  const keyOf = (row: any) => {
    const schoolId = String(row?.schoolId || row?.school?.id || '').trim()
    return `${schoolId}::${norm(row?.className)}::${norm(row?.track)}`
  }
  const schoolIds = Array.from(new Set(backendClasses.map((x: any) => x.schoolId || x.school?.id).filter(Boolean)))
  const savedClassArrays = await Promise.all(schoolIds.map((schoolId) => schoolClassesApi.all(schoolId).catch(() => [])))
  const savedClasses = savedClassArrays.flat().map((sc: any) => ({
    id: sc.id || `school-class-${sc.className}`,
    className: String(sc.className || '').trim(),
    track: sc.track,
    schoolId: sc.schoolId,
    school: backendClasses.find((b: any) => (b.schoolId || b.school?.id) === sc.schoolId)?.school || null,
    students: [],
  }))
  // De-dupe by (schoolId, className, track). Prefer backend rows (they include real students).
  const byKey = new Map<string, any>()
  for (const row of backendClasses) {
    const k = keyOf(row)
    if (!k.startsWith('::')) byKey.set(k, row)
  }
  for (const row of savedClasses) {
    const k = keyOf(row)
    if (!k.startsWith('::') && !byKey.has(k)) byKey.set(k, row)
  }
  return Array.from(byKey.values())
}

function tutorAssignmentKey(c: any) {
  const schoolId = String(c?.schoolId || c?.school?.id || '').trim()
  const track = String(c?.track || '').trim()
  const className = String(c?.className || '').trim()
  return `${schoolId}::${track}::${className}`
}

function tutorAssignmentLabel(c: any) {
  const className = String(c?.className || '').trim()
  const track = String(c?.track || 'TRACK_1').replace(/^TRACK_/i, 'Track ')
  const schoolName = String(c?.school?.name || '').trim()
  return schoolName ? `${className} · ${track} · ${schoolName}` : `${className} · ${track}`
}

/** One row per school + class + track (tutors may teach the same class name at multiple schools). */
function dedupeTutorAssignments(classes: any[]) {
  const seen = new Set<string>()
  const rows: any[] = []
  for (const c of Array.isArray(classes) ? classes : []) {
    const schoolId = String(c?.schoolId || c?.school?.id || '').trim()
    const className = String(c?.className || '').trim()
    const track = String(c?.track || '').trim()
    if (!schoolId || !className || !track) continue
    const key = tutorAssignmentKey(c)
    if (seen.has(key)) continue
    seen.add(key)
    rows.push(c)
  }
  return rows.sort((a, b) => {
    const byClass = String(a.className).localeCompare(String(b.className))
    if (byClass !== 0) return byClass
    return String(a?.school?.name || '').localeCompare(String(b?.school?.name || ''))
  })
}

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
  const { items, reload } = useUnifiedAiReviewQueue()
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const handleApproveFromQueue = async (item: AiReviewItem) => {
    setApprovingId(item.id)
    try {
      if (item.kind === 'assignment') await assignmentsApi.approveAiGrade(item.id, {})
      else await practicalsApi.approveAiGrade(item.id, {})
      notify.success('AI grade approved')
      reload()
    } catch (e: any) {
      notify.error(e?.message || 'Failed to approve AI grade')
    }
    setApprovingId(null)
  }
  const handleAiReview = (item: AiReviewItem) => {
    sessionStorage.setItem(PENDING_AI_REVIEW_KEY, JSON.stringify(item))
    onSection(item.kind === 'assignment' ? 'tutor-assignments' : 'tutor-practicals')
  }
  const todayClass = classes[0]
  const students = classes.flatMap(c => c.students || [])
  const atRisk = students.filter((s: any) => {
    const scores = s.moduleProgress?.map((p: any) => p.score).filter(Boolean) || []
    const avg = scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0
    return avg < 50 && avg > 0
  }).slice(0, 3)

  return (<>
    <AiReviewQueueCard items={items} onReview={handleAiReview} onApprove={handleApproveFromQueue} approvingId={approvingId} />
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
  onOpenClass: (assignmentKey: string) => void
}) {
  const assignmentCards = useMemo(() => dedupeTutorAssignments(classes), [classes])

  return (
    <div>
      <div className="flex-between mb-20">
        <div>
          <h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Classes</h3>
          <div className="text-muted text-sm">{assignmentCards.length} classes assigned</div>
        </div>
      </div>
      <div className="content-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))' }}>
        {assignmentCards.map((c: any) => {
          const key = tutorAssignmentKey(c)
          const track = c.track || 'TRACK_1'
          const schoolName = String(c?.school?.name || '').trim()
          const studentCount = Array.isArray(c.students) ? c.students.length : 0
          return (
          <button
            key={key}
            className="card"
            style={{ padding: 20, textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)' }}
            onClick={() => onOpenClass(key)}
            title={`View ${tutorAssignmentLabel(c)} students`}
          >
            <div className="flex-between mb-8">
              <div className="font-display fw-700 text-white" style={{ fontSize: 18 }}>{c.className}</div>
              <span className={`badge ${track === 'TRACK_3' ? 'badge-info' : track === 'TRACK_2' ? 'badge-gold' : 'badge-teal'}`}>
                {String(track).replace('TRACK_', 'Track ')}
              </span>
            </div>
            {schoolName && (
              <div className="text-muted text-xs" style={{ marginBottom: 8 }}>{schoolName}</div>
            )}
            <div style={{ fontSize: 28, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--gold)', marginBottom: 4 }}>{studentCount}</div>
            <div className="text-muted text-sm" style={{ marginBottom: 12 }}>Students</div>
            <div className="text-muted text-xs" style={{ marginTop: 10 }}>Click card to view students →</div>
          </button>
          )
        })}
        {assignmentCards.length === 0 && (
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
  selectedClassKey,
  onBackToClasses,
  onClearClass,
}: {
  classes: any[]
  onClassesChange: React.Dispatch<React.SetStateAction<any[]>>
  selectedClassKey?: string | null
  onBackToClasses?: () => void
  onClearClass?: () => void
}) {
  const [search, setSearch] = useState('')
  // NOTE: School Admin owns student creation (single + bulk) for billing control.
  const [selectedStudentIds, setSelectedStudentIds] = useState<Record<string, boolean>>({})
  const [bulkDeactivating, setBulkDeactivating] = useState(false)
  const [bulkDeactivateProgress, setBulkDeactivateProgress] = useState<{ total: number; done: number; succeeded: number; failed: number } | null>(null)
  const [tempPwByStudentId, setTempPwByStudentId] = useState<Record<string, string>>({})
  const [revealPwByStudentId, setRevealPwByStudentId] = useState<Record<string, boolean>>({})
  const [resettingPwByStudentId, setResettingPwByStudentId] = useState<Record<string, boolean>>({})
  const [confirm, setConfirm] = useState<null | { title: string; message: React.ReactNode; danger?: boolean; onConfirm: () => void }>(null)
  const [studentForm, setStudentForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    className: classes[0]?.className || '',
    track: classes[0]?.track || 'TRACK_1',
  })
  const [bulkForm, setBulkForm] = useState({ className: classes[0]?.className || '', termLabel: '2025/2026 Term 2', csv: '' })

  const classTrackMap = classes.reduce((acc: Record<string, string>, c: any) => {
    if (c?.className && c?.track) acc[c.className] = c.track
    return acc
  }, {})
  // Only show classes the tutor is actually assigned to.
  // `fetchMergedTutorClasses()` also merges in school registry classes (ids like "school-class-SS3A"),
  // which the tutor is NOT necessarily assigned to and the backend will forbid bulk upload for.
  const assignedClasses = classes.filter((c: any) => !String(c?.id || '').startsWith('school-class-'))
  const assignmentOptions = useMemo(() => dedupeTutorAssignments(assignedClasses), [assignedClasses])
  const selectedAssignment = useMemo(
    () => (selectedClassKey ? assignmentOptions.find((c: any) => tutorAssignmentKey(c) === selectedClassKey) : null),
    [assignmentOptions, selectedClassKey],
  )
  const selectedClassLabel = selectedAssignment ? tutorAssignmentLabel(selectedAssignment) : ''
  const resolveSchoolId = (assignmentKey?: string) => {
    const row = assignmentKey
      ? assignmentOptions.find((c: any) => tutorAssignmentKey(c) === assignmentKey)
      : selectedAssignment
    return row?.schoolId || row?.school?.id || assignedClasses[0]?.schoolId || assignedClasses[0]?.school?.id || ''
  }

  useEffect(() => {
    if (!studentForm.className && assignmentOptions.length) {
      const first = assignmentOptions[0]
      setStudentForm((prev) => ({
        ...prev,
        className: first.className,
        track: first.track || classTrackMap[first.className] || prev.track,
      }))
    }
    if (!bulkForm.className && assignmentOptions.length) {
      setBulkForm((prev) => ({ ...prev, className: assignmentOptions[0].className }))
    }
  }, [assignmentOptions, classTrackMap, studentForm.className, bulkForm.className])


  const filteredClasses = selectedClassKey
    ? classes.filter((c: any) => tutorAssignmentKey(c) === selectedClassKey)
    : classes
  const students = filteredClasses.flatMap((c: any, ci: number) =>
    (c.students || []).map((s: any, si: number) => {
      const scores = s.moduleProgress?.map((p: any) => p.score).filter(Boolean) || []
      const avg = scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0
      return { ...s, className: c.className, avg, colorIdx: ci * 8 + si }
    })
  ).filter((s: any) => {
    const name = `${s.user?.firstName} ${s.user?.lastName}`.toLowerCase()
    return (
      !search ||
      name.includes(search.toLowerCase()) ||
      s.regNumber?.includes(search) ||
      (s.user?.username && String(s.user.username).toLowerCase().includes(search.toLowerCase()))
    )
  })

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

  const deactivateStudent = async (studentId: string) => {
    setConfirm({
      title: 'Deactivate student?',
      danger: true,
      message: 'They will no longer be able to sign in.',
      onConfirm: async () => {
        setConfirm(null)
        try {
          await studentsApi.deactivate(studentId)
          notify.success('Student deactivated')
          onClassesChange((prev) =>
            prev.map((c: any) => ({
              ...c,
              students: (c.students || []).filter((s: any) => s.id !== studentId),
            }))
          )
          setSelectedStudentIds((prev) => {
            if (!prev[studentId]) return prev
            const next = { ...prev }
            delete next[studentId]
            return next
          })
        } catch (e: any) {
          notify.fromError(e, 'Could not deactivate student')
        }
      },
    })
    return
  }

  const editStudentName = async (student: any) => {
    const current = `${student?.user?.firstName || ''} ${student?.user?.lastName || ''}`.trim()
    const fullName = window.prompt('Update student full name', current)
    if (fullName == null) return
    const cleaned = String(fullName).trim().replace(/\s+/g, ' ')
    if (!cleaned) {
      notify.warning('Full name cannot be empty')
      return
    }
    try {
      await studentsApi.tutorUpdate(student.id, { fullName: cleaned })
      const parts = cleaned.split(' ')
      const firstName = parts[0]
      const lastName = parts.slice(1).join(' ') || 'Student'
      onClassesChange((prev) =>
        prev.map((c: any) => ({
          ...c,
          students: (c.students || []).map((s: any) =>
            s.id === student.id
              ? { ...s, user: { ...(s.user || {}), firstName, lastName } }
              : s
          ),
        }))
      )
      notify.success('Student updated')
    } catch (e: any) {
      notify.fromError(e, 'Could not update student')
    }
  }

  const selectedIds = Object.keys(selectedStudentIds).filter((id) => selectedStudentIds[id])

  const toggleSelected = (studentId: string) => {
    setSelectedStudentIds((prev) => ({ ...prev, [studentId]: !prev[studentId] }))
  }

  const setAllSelected = (value: boolean) => {
    const next: Record<string, boolean> = {}
    students.forEach((s: any) => { next[s.id] = value })
    setSelectedStudentIds(next)
  }

  const bulkDeactivateSelected = async () => {
    const ids = selectedIds
    if (!ids.length) return
    setConfirm({
      title: `Deactivate ${ids.length} selected student${ids.length === 1 ? '' : 's'}?`,
      danger: true,
      message: 'They will no longer be able to sign in.',
      onConfirm: async () => {
        setConfirm(null)
        setBulkDeactivating(true)
        setBulkDeactivateProgress({ total: ids.length, done: 0, succeeded: 0, failed: 0 })
        let succeeded = 0
        let failed = 0
        for (let i = 0; i < ids.length; i++) {
          const id = ids[i]
          try {
            await studentsApi.deactivate(id)
            succeeded++
            // remove from UI immediately
            onClassesChange((prev) =>
              prev.map((c: any) => ({
                ...c,
                students: (c.students || []).filter((s: any) => s.id !== id),
              }))
            )
            setSelectedStudentIds((prev) => {
              if (!prev[id]) return prev
              const next = { ...prev }
              delete next[id]
              return next
            })
          } catch {
            failed++
          }
          setBulkDeactivateProgress({ total: ids.length, done: i + 1, succeeded, failed })
        }
        if (succeeded > 0) notify.success(`Deactivated ${succeeded} student${succeeded === 1 ? '' : 's'}`)
        if (failed > 0) notify.warning(`${failed} student${failed === 1 ? '' : 's'} could not be deactivated`)
        setBulkDeactivating(false)
        setBulkDeactivateProgress(null)
      },
    })
    return
  }

  return (
    <div>
      <ConfirmModal
        open={!!confirm}
        title={confirm?.title || 'Confirm'}
        message={confirm?.message || ''}
        confirmText={confirm?.danger ? 'Yes, deactivate' : 'Confirm'}
        cancelText="Cancel"
        danger={!!confirm?.danger}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm?.onConfirm?.()}
      />
      <div className="flex-between mb-20">
        <div>
          <h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>My Students</h3>
          <div className="text-muted text-sm">
            {students.length} students
            {selectedClassKey ? ` in ${selectedClassLabel}` : ` across ${assignmentOptions.length} classes`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {selectedClassKey && <button onClick={onBackToClasses} className="btn btn-ghost btn-sm">Back to Classes</button>}
          {selectedClassKey && <button onClick={onClearClass} className="btn btn-ghost btn-sm">Clear Class Filter</button>}
        </div>
      </div>
      <div style={{ marginBottom: 16 }}><input className="form-input" placeholder="Search by name or reg number…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 320 }} /></div>
      {selectedIds.length > 0 && (
        <div className="card mb-12" style={{ padding: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="text-muted text-sm">
            <strong style={{ color: 'var(--white)' }}>{selectedIds.length}</strong> selected
          </span>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            disabled={bulkDeactivating}
            onClick={bulkDeactivateSelected}
          >
            {bulkDeactivating && bulkDeactivateProgress
              ? `Deactivating ${bulkDeactivateProgress.done}/${bulkDeactivateProgress.total}…`
              : `Deactivate selected (${selectedIds.length})`}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={bulkDeactivating}
            onClick={() => setAllSelected(false)}
          >
            Clear selection
          </button>
          {bulkDeactivating && bulkDeactivateProgress && (
            <span className="text-muted text-xs" style={{ marginLeft: 'auto' }}>
              <strong style={{ color: 'var(--success)' }}>OK:</strong> {bulkDeactivateProgress.succeeded} ·{' '}
              <strong style={{ color: 'var(--danger)' }}>Fail:</strong> {bulkDeactivateProgress.failed}
            </span>
          )}
        </div>
      )}
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 28 }}>
                <input
                  type="checkbox"
                  checked={students.length > 0 && selectedIds.length === students.length}
                  onChange={(e) => setAllSelected(e.target.checked)}
                  aria-label="Select all students"
                />
              </th>
              <th>#</th><th>Student</th><th>Reg No.</th><th>Class</th><th>Avg Score</th><th>Password</th><th>Status</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 0' }}>No students found</td></tr>}
            {students.map((s: any, i: number) => {
              const name = `${s.user?.firstName} ${s.user?.lastName}`
              const { background, color } = studentColor(s.colorIdx)
              const pw = tempPwByStudentId[s.id]
              const revealing = !!revealPwByStudentId[s.id]
              const resetting = !!resettingPwByStudentId[s.id]
              const checked = !!selectedStudentIds[s.id]
              return (
                <tr key={s.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelected(s.id)}
                      aria-label={`Select ${name}`}
                    />
                  </td>
                  <td style={{ color: i < 3 ? 'var(--gold)' : 'var(--muted)' }}>{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td>
                  <td><div className="student-name"><div className="stu-av" style={{ background, color }}>{initials(name)}</div>{name}</div></td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{s.regNumber}</td>
                  <td>{s.className}</td>
                  <td><strong style={{ color: s.avg >= 70 ? 'var(--success)' : s.avg >= 50 ? 'var(--warning)' : s.avg > 0 ? 'var(--danger)' : 'var(--muted)' }}>{s.avg > 0 ? `${s.avg}%` : '—'}</strong></td>
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
                  <td><span className={`badge badge-${s.avg >= 50 || s.avg === 0 ? 'success' : 'danger'}`}>{s.avg > 0 && s.avg < 50 ? 'At Risk' : 'Active'}</span></td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 10, padding: '6px 10px', marginRight: 8 }}
                      disabled={bulkDeactivating}
                      onClick={() => editStudentName(s)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ fontSize: 10, padding: '6px 10px' }}
                      disabled={bulkDeactivating}
                      onClick={() => deactivateStudent(s.id)}
                    >
                      Deactivate
                    </button>
                  </td>
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
  const [selectedClassKey, setSelectedClassKey] = useState('')
  const [mode, setMode] = useState<'cards' | 'record' | 'view'>('cards')
  const [openMenuClassKey, setOpenMenuClassKey] = useState<string | null>(null)
  const [records, setRecords] = useState<any[]>([])
  const [weekly, setWeekly] = useState<any[]>([])
  const [weeks, setWeeks] = useState(8)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingWeekly, setLoadingWeekly] = useState(false)

  const assignmentCards = useMemo(() => dedupeTutorAssignments(classes), [classes])
  const selectedAssignment = useMemo(
    () => assignmentCards.find((c: any) => tutorAssignmentKey(c) === selectedClassKey) || null,
    [assignmentCards, selectedClassKey],
  )
  const selectedClass = selectedAssignment?.className || ''
  const selectedLabel = selectedAssignment ? tutorAssignmentLabel(selectedAssignment) : ''
  const schoolId = selectedAssignment?.schoolId || selectedAssignment?.school?.id

  const loadRecordAttendance = useCallback(async () => {
    if (!selectedAssignment || !schoolId || !selectedClass) return
    setLoading(true)
    try {
      const data = await attendanceApi.classView(schoolId, selectedClass, date)
      setRecords(data.map((r: any) => ({ ...r, status: r.status || 'PRESENT' })))
    } catch {
      const students = selectedAssignment.students || []
      setRecords(students.map((s: any) => ({
        studentId: s.id,
        name: `${s.user?.firstName} ${s.user?.lastName}`,
        regNumber: s.regNumber,
        status: 'PRESENT',
      })))
    }
    setLoading(false)
    setSaved(false)
  }, [selectedAssignment, schoolId, selectedClass, date])

  const loadWeeklyAttendance = useCallback(async () => {
    if (!selectedAssignment || !schoolId || !selectedClass) return
    setLoadingWeekly(true)
    try {
      const data = await attendanceApi.schoolWeekly(schoolId, weeks, selectedClass)
      setWeekly(Array.isArray(data) ? data : [])
    } catch {
      setWeekly([])
    }
    setLoadingWeekly(false)
  }, [selectedAssignment, schoolId, selectedClass, weeks])

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
          {assignmentCards.map((c:any)=> {
            const key = tutorAssignmentKey(c)
            const track = c.track || 'TRACK_1'
            const schoolName = String(c?.school?.name || '').trim()
            const studentCount = Array.isArray(c.students) ? c.students.length : 0
            return (
              <div key={key} className="card" style={{position:'relative',padding:16}}>
                <div className="flex-between mb-12" style={{alignItems:'flex-start'}}>
                  <div>
                    <div className="font-display fw-700 text-white" style={{fontSize:18}}>{c.className}</div>
                    <div className="text-muted text-xs mt-4">{String(track).replace('TRACK_', 'Track ')}</div>
                    {schoolName && <div className="text-muted text-xs mt-4">{schoolName}</div>}
                  </div>
                  <button
                    onClick={() => setOpenMenuClassKey(prev => prev === key ? null : key)}
                    className="btn btn-ghost btn-sm"
                    style={{padding:'4px 8px',minWidth:32}}
                    title="Attendance options"
                  >
                    ⋮
                  </button>
                </div>
                <div style={{fontSize:26,fontFamily:'var(--font-display)',fontWeight:800,color:'var(--gold)'}}>{studentCount}</div>
                <div className="text-muted text-sm">Students</div>
                {openMenuClassKey === key && (
                  <div style={{position:'absolute',top:44,right:12,zIndex:5,background:'var(--navy2)',border:'1px solid var(--border2)',borderRadius:10,padding:8,minWidth:180,display:'flex',flexDirection:'column',gap:6}}>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{justifyContent:'flex-start'}}
                      onClick={() => {
                        setSelectedClassKey(key)
                        setMode('view')
                        setOpenMenuClassKey(null)
                      }}
                    >
                      View Attendance
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{justifyContent:'flex-start'}}
                      onClick={() => {
                        setSelectedClassKey(key)
                        setMode('record')
                        setOpenMenuClassKey(null)
                      }}
                    >
                      Record Attendance
                    </button>
                  </div>
                )}
              </div>
            )
          })}
          {assignmentCards.length === 0 && (
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
            <div className="text-muted text-sm mt-4">{selectedLabel || `Class: ${selectedClass}`}</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={() => setMode('record')} className="btn btn-ghost btn-sm">Record For This Class</button>
            <button onClick={() => { setMode('cards'); setSelectedClassKey('') }} className="btn btn-ghost btn-sm">Back to Class Cards</button>
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
          <div className="text-muted text-sm mt-4">{selectedLabel || `Class: ${selectedClass}`}</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={() => setMode('view')} className="btn btn-ghost btn-sm">View This Class</button>
          <button onClick={save} className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Attendance'}</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div><label className="form-label">Date</label><input type="date" className="form-input" value={date} onChange={e => { setDate(e.target.value); setSaved(false) }} style={{ width: 180 }} /></div>
        <div><label className="form-label">Class</label>
          <select className="form-input" value={selectedClassKey} onChange={e => setSelectedClassKey(e.target.value)} style={{ appearance: 'none', minWidth: 220, maxWidth: 360 }}>
            {assignmentCards.map(c => {
              const key = tutorAssignmentKey(c)
              return <option key={key} value={key}>{tutorAssignmentLabel(c)}</option>
            })}
            {assignmentCards.length === 0 && <option>No classes</option>}
          </select>
        </div>
        <button className="btn btn-ghost btn-sm" style={{alignSelf:'flex-end'}} onClick={() => { setMode('cards'); setSelectedClassKey('') }}>Back to Class Cards</button>
      </div>
      <div className="card">
        <div className="flex-between mb-16">
          <div className="font-display fw-600 text-white">{selectedLabel || selectedClass} · {new Date(date + 'T00:00:00').toLocaleDateString('en-NG', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
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
function TutorResults({
  classes,
  onRefreshClasses,
}: {
  classes: any[]
  onRefreshClasses?: () => Promise<void>
}) {
  const classKey = useCallback((c: any) => {
    const schoolId = String(c?.schoolId || c?.school?.id || '').trim()
    const track = String(c?.track || '').trim()
    const className = String(c?.className || '').trim()
    return `${schoolId}::${track}::${className}`
  }, [])

  const classChoices = useMemo(() => {
    const seen = new Set<string>()
    const opts: Array<{ key: string; label: string; className: string }> = []
    for (const c of Array.isArray(classes) ? classes : []) {
      const schoolId = String(c?.schoolId || c?.school?.id || '').trim()
      const className = String(c?.className || '').trim()
      const track = String(c?.track || '').trim()
      if (!schoolId || !className || !track) continue
      const key = classKey(c)
      if (seen.has(key)) continue
      seen.add(key)
      const schoolName = String(c?.school?.name || '').trim() || 'School'
      const trackLabel = track.replace(/^TRACK_/i, 'Track ')
      opts.push({
        key,
        className,
        label: `${className} · ${trackLabel} · ${schoolName}`,
      })
    }
    return opts
  }, [classes, classKey])

  const [selectedClassKey, setSelectedClassKey] = useState<string>(() => classChoices[0]?.key || '')

  // Keep selection valid if class list changes.
  useEffect(() => {
    if (!classChoices.length) {
      setSelectedClassKey('')
      return
    }
    if (!selectedClassKey || !classChoices.some((c) => c.key === selectedClassKey)) {
      setSelectedClassKey(classChoices[0].key)
    }
  }, [selectedClassKey, classChoices])

  const selectedClassObj = useMemo(
    () => (Array.isArray(classes) ? classes.find((c: any) => classKey(c) === selectedClassKey) : null),
    [classes, classKey, selectedClassKey],
  )

  const selectedClass = selectedClassObj?.className || ''
  const students = (selectedClassObj?.students || [])
  const [scores, setScores] = useState<Record<string, string>>({})
  const [scoresLoading, setScoresLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [classProgress, setClassProgress] = useState<any>(null)
  const [loadingProgress, setLoadingProgress] = useState(false)
  const [retakeStudentId, setRetakeStudentId] = useState<string>('')
  const [retakeModuleId, setRetakeModuleId] = useState<string>('')
  const [retakeStatus, setRetakeStatus] = useState<any>(null)
  const [checkingRetake, setCheckingRetake] = useState(false)
  const [applyingRetake, setApplyingRetake] = useState(false)
  /** Best module CBT % and best practical % per student (from suggested-scores; mirrors how practicals show per-task scores). */
  const [markBreakdown, setMarkBreakdown] = useState<Record<string, { cbtBest: number | null; pracBest: number | null }>>({})
  const [lessonFormative, setLessonFormative] = useState<Record<string, { averageScore: number | null; attemptedCount: number; assignedCount: number }>>({})
  const [typingSummary, setTypingSummary] = useState<Record<string, { labUnlocked?: boolean; practiceSessions: number; bestFormalWpm: number | null; bestFormalAccuracy: number | null }>>({})

  const fmtMarkComponent = (v: number | null | undefined) =>
    v != null && !Number.isNaN(Number(v)) ? String(Math.round(Number(v))) : '—'

  const grade = (v: string) => { const n = +v; if (!v || isNaN(n)) return '—'; if (n >= 90) return 'A+'; if (n >= 80) return 'A'; if (n >= 70) return 'B+'; if (n >= 60) return 'B'; if (n >= 50) return 'C'; return 'F' }
  const gc = (v: string) => { const n = +v; if (!v || isNaN(n)) return 'warning'; return n >= 70 ? 'success' : n >= 50 ? 'warning' : 'danger' }
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

  useEffect(() => {
    const mid = classProgress?.currentModule?.id
    if (!schoolId || !selectedClass || !mid) {
      setLessonFormative({})
      return
    }
    let cancelled = false
    curriculumApi
      .lessonFormativeSummary(schoolId, selectedClass, mid)
      .then((rows) => {
        if (cancelled) return
        const map: Record<string, { averageScore: number | null; attemptedCount: number; assignedCount: number }> = {}
        ;(Array.isArray(rows) ? rows : []).forEach((r: any) => {
          if (r?.studentId) {
            map[r.studentId] = {
              averageScore: r.averageScore ?? null,
              attemptedCount: r.attemptedCount ?? 0,
              assignedCount: r.assignedCount ?? 0,
            }
          }
        })
        setLessonFormative(map)
      })
      .catch(() => {
        if (!cancelled) setLessonFormative({})
      })
    return () => {
      cancelled = true
    }
  }, [schoolId, selectedClass, classProgress?.currentModule?.id])

  const showTypingCol = classProgress?.track === 'TRACK_1'

  useEffect(() => {
    if (!showTypingCol || !schoolId || !selectedClass) {
      setTypingSummary({})
      return
    }
    let cancelled = false
    typingApi
      .classSummary(schoolId, selectedClass)
      .then((rows) => {
        if (cancelled) return
        const map: Record<string, { labUnlocked?: boolean; practiceSessions: number; bestFormalWpm: number | null; bestFormalAccuracy: number | null }> = {}
        ;(Array.isArray(rows) ? rows : []).forEach((r: any) => {
          if (r?.studentId) {
            map[r.studentId] = {
              labUnlocked: r.labUnlocked,
              practiceSessions: r.practiceSessions ?? 0,
              bestFormalWpm: r.bestFormalWpm ?? null,
              bestFormalAccuracy: r.bestFormalAccuracy ?? null,
            }
          }
        })
        setTypingSummary(map)
      })
      .catch(() => {
        if (!cancelled) setTypingSummary({})
      })
    return () => {
      cancelled = true
    }
  }, [showTypingCol, schoolId, selectedClass])

  // Reset retake selection when class changes
  useEffect(() => {
    setRetakeStudentId('')
    setRetakeModuleId('')
    setRetakeStatus(null)
  }, [selectedClass])

  /**
   * One pipeline: saved `moduleProgress.score` wins; otherwise suggested from CBT ± practical.
   * (Previously two effects raced: the DB-only effect could run after suggested-scores and wipe composites → all "—".)
   */
  useEffect(() => {
    if (loadingProgress) return
    const mid = classProgress?.currentModule?.id
    if (!mid) {
      setScores({})
      return
    }
    const st = (classes.find((c: any) => c.className === selectedClass)?.students || []) as any[]
    if (!st.length) {
      setScores({})
      return
    }
    let cancelled = false
    ;(async () => {
      setScoresLoading(true)
      const next: Record<string, string> = {}
      for (const s of st) {
        const row = (s.moduleProgress || []).find((p: any) => p.moduleId === mid || p.module?.id === mid)
        if (row?.score != null && row.score !== '') {
          next[s.id] = String(Math.round(Number(row.score)))
        }
      }
      if (schoolId && selectedClass) {
        try {
          const rows = await modulesApi.suggestedScores(schoolId, selectedClass, mid, 50).catch(() => [])
          if (cancelled) return
          const byStudent = new Map<string, any>()
          ;(Array.isArray(rows) ? rows : []).forEach((r: any) => {
            if (r?.studentId) byStudent.set(String(r.studentId), r)
          })
          for (const s of st) {
            const sid = String(s?.id || '')
            if (!sid) continue
            if (next[sid] != null && String(next[sid]).trim() !== '') continue
            const r = byStudent.get(sid)
            const composite = r?.compositeScore
            if (typeof composite === 'number' && !Number.isNaN(composite)) {
              next[sid] = String(Math.round(composite))
            }
          }
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) setScores(next)
      if (!cancelled) setScoresLoading(false)
    })()
    return () => {
      cancelled = true
      setScoresLoading(false)
    }
  }, [loadingProgress, selectedClass, classProgress?.currentModule?.id, classes, schoolId])

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
      notify.success('Scores saved')
      if (onRefreshClasses) {
        try {
          await onRefreshClasses()
        } catch (e: any) {
          notify.fromError(e, 'Saved, but could not refresh class list')
        }
      }
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
      if (onRefreshClasses) {
        try {
          await onRefreshClasses()
        } catch (e: any) {
          notify.fromError(e, 'Advanced, but could not refresh class list')
        }
      }
      await loadClassProgress()
      notify.success('Class advanced to next module')
    } catch (e: any) {
      notify.error(e?.message || 'Failed to advance class module')
    }
    setAdvancing(false)
  }

  const selectedRetakeStudent = students.find((s: any) => s.id === retakeStudentId)
  const failedModules = (selectedRetakeStudent?.moduleProgress || [])
    .filter((p: any) => p?.status === 'FAILED' && (p.moduleId || p.module?.id))
    .map((p: any) => ({
      id: String(p.moduleId || p.module?.id),
      number: p.module?.number,
      title: p.module?.title,
    }))
    .filter((m: any) => m.id)
    // de-dupe in case API includes duplicates
    .filter((m: any, idx: number, arr: any[]) => arr.findIndex((x) => x.id === m.id) === idx)
    .sort((a: any, b: any) => (Number(a.number || 0) - Number(b.number || 0)) || String(a.title || '').localeCompare(String(b.title || '')))

  const checkRetake = async () => {
    if (!retakeStudentId || !retakeModuleId) {
      notify.warning('Select a student and a failed module')
      return
    }
    setCheckingRetake(true)
    try {
      const st = await modulesApi.retakeStatus(retakeStudentId, retakeModuleId, 50)
      setRetakeStatus(st)
      if (st?.ready) notify.success('Ready to clear — CBT + Practical passed')
      else notify.warning('Not ready yet — CBT and Practical must both be ≥ 50%')
    } catch (e: any) {
      setRetakeStatus(null)
      notify.fromError(e, 'Could not check retake status')
    }
    setCheckingRetake(false)
  }

  const applyRetake = async () => {
    if (!retakeStudentId || !retakeModuleId) return
    setApplyingRetake(true)
    try {
      const res = await modulesApi.applyRetake(retakeStudentId, retakeModuleId, 50)
      setRetakeStatus(res)
      notify.success('Failed module cleared')
      if (onRefreshClasses) {
        try { await onRefreshClasses() } catch { /* ignore */ }
      }
    } catch (e: any) {
      notify.fromError(e, 'Could not clear failed module')
    }
    setApplyingRetake(false)
  }

  return (
    <div>
      <div className="flex-between mb-20">
        <div>
          <h3 className="font-display fw-700 text-white" style={{ fontSize: 18 }}>Mark Results</h3>
          <div className="text-muted text-xs mt-4">Class-paced module flow: score individually, advance by class.</div>
          <div className="text-muted text-xs mt-6" style={{ maxWidth: 520 }}>
            Saved scores for the current module load into the table. Enter or edit scores (0–100), then <strong className="text-white">Save All Scores</strong>. When the whole class is ready, use <strong className="text-white">Advance Class Module</strong> to move everyone forward.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            className="form-input"
            value={selectedClassKey}
            onChange={(e) => { setSelectedClassKey(e.target.value); setSaved(false) }}
            style={{ appearance: 'none', width: 260 }}
          >
            {classChoices.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
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
      {classProgress?.currentModule && schoolId && selectedClass && (
        <TutorLessonActivitiesPanel
          moduleId={classProgress.currentModule.id}
          schoolId={schoolId}
          className={selectedClass}
          moduleLabel={`Module ${classProgress.currentModule.number}: ${classProgress.currentModule.title}`}
        />
      )}
      <div className="card">
        {scoresLoading && (
          <div className="text-muted text-xs mb-12" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="badge badge-info">Loading</span>
            Generating scores from CBT + practical…
          </div>
        )}
        <table className="data-table">
          <thead><tr><th>Student</th><th>Current Module</th><th>Lesson avg</th>{showTypingCol && <th>Typing</th>}<th>Score (0–100)</th><th>Grade</th></tr></thead>
          <tbody>
            {students.map((s: any, i: number) => {
              const name = `${s.user?.firstName} ${s.user?.lastName}`
              return (
                <tr key={s.id}>
                  <td><div className="student-name"><div className="stu-av" style={{ ...studentColor(i) }}>{initials(name)}</div>{name}</div></td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{classProgress?.currentModule?.title || 'No active module'}</td>
                  <td className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>
                    {(() => {
                      const lf = lessonFormative[s.id]
                      if (!lf || lf.assignedCount === 0) return '—'
                      const avg = lf.averageScore != null ? `${lf.averageScore}%` : '—'
                      return `${avg} (${lf.attemptedCount}/${lf.assignedCount})`
                    })()}
                  </td>
                  {showTypingCol && (
                    <td className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>
                      {(() => {
                        const ts = typingSummary[s.id]
                        if (!ts) return '—'
                        if (ts.labUnlocked === false) return 'Not unlocked'
                        const wpm =
                          ts.bestFormalWpm != null
                            ? `${Math.round(ts.bestFormalWpm)} WPM${ts.bestFormalAccuracy != null ? ` (${Math.round(ts.bestFormalAccuracy)}%)` : ''}`
                            : '—'
                        return (
                          <span title={`${ts.practiceSessions} practice session(s)`}>
                            {wpm}
                            {ts.practiceSessions > 0 && (
                              <span className="text-muted"> · {ts.practiceSessions} practice</span>
                            )}
                          </span>
                        )
                      })()}
                    </td>
                  )}
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={scores[s.id] || ''}
                      disabled={scoresLoading}
                      onChange={e => { setScores(sc => ({ ...sc, [s.id]: e.target.value })); setSaved(false) }}
                      style={{ width: 64, background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--white)', textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, opacity: scoresLoading ? 0.6 : 1 }}
                    />
                  </td>
                  <td><span className={`badge badge-${gc(scores[s.id] || '')}`}>{scoresLoading && !scores[s.id] ? '…' : grade(scores[s.id] || '')}</span></td>
                </tr>
              )
            })}
            {students.length === 0 && <tr><td colSpan={showTypingCol ? 6 : 5} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>No students in selected class</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="flex-between mb-12" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="font-display fw-700 text-white" style={{ fontSize: 16 }}>Module retake (CBT + Practical)</div>
            <div className="text-muted text-xs mt-4" style={{ maxWidth: 720 }}>
              Clear a <strong className="text-white">FAILED</strong> module only when the student has passed the <strong className="text-white">module CBT quiz</strong> and the <strong className="text-white">module practical</strong> (≥ 50% each).
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="form-input"
              value={retakeStudentId}
              onChange={(e) => { setRetakeStudentId(e.target.value); setRetakeModuleId(''); setRetakeStatus(null) }}
              style={{ appearance: 'none', minWidth: 200 }}
            >
              <option value="">Select student…</option>
              {students.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {`${s.user?.firstName || ''} ${s.user?.lastName || ''}`.trim() || s.regNumber || s.id}
                </option>
              ))}
            </select>

            <select
              className="form-input"
              value={retakeModuleId}
              onChange={(e) => { setRetakeModuleId(e.target.value); setRetakeStatus(null) }}
              style={{ appearance: 'none', minWidth: 260 }}
              disabled={!retakeStudentId}
            >
              <option value="">{retakeStudentId ? (failedModules.length ? 'Select failed module…' : 'No failed modules') : 'Select student first'}</option>
              {failedModules.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.number ? `Module ${m.number}: ` : ''}{m.title || m.id}
                </option>
              ))}
            </select>

            <button type="button" className="btn btn-ghost btn-sm" onClick={checkRetake} disabled={checkingRetake || !retakeStudentId || !retakeModuleId}>
              {checkingRetake ? 'Checking…' : 'Check retake'}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={applyRetake}
              disabled={applyingRetake || !retakeStatus?.ready}
              title={!retakeStatus?.ready ? 'CBT + Practical must both be ≥ 50%' : 'Clear failed module'}
            >
              {applyingRetake ? 'Clearing…' : 'Clear failed module'}
            </button>
          </div>
        </div>

        {retakeStatus && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span className={`badge badge-${retakeStatus?.cbt?.passed ? 'success' : 'warning'}`}>
              CBT: {retakeStatus?.cbt?.bestScore != null ? `${Math.round(retakeStatus.cbt.bestScore)}%` : '—'}
            </span>
            <span className={`badge badge-${retakeStatus?.practical?.passed ? 'success' : 'warning'}`}>
              Practical: {retakeStatus?.practical?.bestScore != null ? `${Math.round(retakeStatus.practical.bestScore)}%` : '—'}
            </span>
            <span className={`badge badge-${retakeStatus?.ready ? 'success' : 'warning'}`}>
              {retakeStatus?.ready ? 'Ready' : 'Not ready'}
            </span>
            {retakeStatus?.compositeScore != null && (
              <span className="badge badge-info">Composite: {Math.round(retakeStatus.compositeScore)}%</span>
            )}
          </div>
        )}
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
        .map((c: any) => [
          c.className,
          {
            className: c.className,
            track: c.track || 'TRACK_1',
            track3Stack: c.track3Stack as string | undefined,
          },
        ])
    ).values()
  ) as Array<{ className: string; track: string; track3Stack?: string }>
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
    /** Optional link to canonical curriculum lesson (same module). */
    curriculumLessonId: '',
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
  const [confirm, setConfirm] = useState<null | { title: string; message: React.ReactNode; danger?: boolean; onConfirm: () => void }>(null)
  const [modulesForTrack, setModulesForTrack] = useState<any[]>([])
  const [loadingModules, setLoadingModules] = useState(false)
  const [materialFile, setMaterialFile] = useState<File | null>(null)
  const [attachmentsByPlan, setAttachmentsByPlan] = useState<Record<string, any[]>>({})
  const [aiDraftingSteps, setAiDraftingSteps] = useState(false)
  const [aiDraftingMaterial, setAiDraftingMaterial] = useState(false)
  const [materialDraftModal, setMaterialDraftModal] = useState(false)
  const [materialDraft, setMaterialDraft] = useState<{
    sessionTitle: string
    slides: { title: string; bullets: string[] }[]
    markdown: string
    teacherGuideMarkdown?: string
    studentHandoutMarkdown?: string
    practice?: { classwork: string[]; homework: string[]; answers: string[] }
    modelUsed?: string
    depth?: 'full' | 'quick'
  } | null>(null)
  const [materialView, setMaterialView] = useState<'slides' | 'teacher' | 'handout' | 'practice'>('handout')
  const [materialDepth, setMaterialDepth] = useState<'full' | 'quick'>('full')
  const [publishingMaterial, setPublishingMaterial] = useState(false)
  const [curriculumLessonsPick, setCurriculumLessonsPick] = useState<any[]>([])
  const curriculumAutoDoneRef = useRef(false)
  const [form, setForm] = useState(buildDefaultForm)
  useEffect(() => {
    if (!trackChoices.length) return
    if (!form.track || !trackChoices.some((t) => t.code === form.track)) {
      const nextTrack = trackChoices[0].code
      const nextClasses = classOptions.filter((c) => c.track === nextTrack).map((c) => c.className)
      setForm((prev) => ({ ...prev, track: nextTrack, classNames: nextClasses, className: nextClasses[0] || '', moduleId: '', curriculumLessonId: '' }))
    }
  }, [JSON.stringify(trackChoices), JSON.stringify(classOptions), form.track])

  useEffect(() => {
    const loadModules = async () => {
      if (!showNew || !form.track) return
      setLoadingModules(true)
      try {
        const track3Stack =
          form.track === 'TRACK_3'
            ? classOptions.find((c) => c.track === 'TRACK_3' && form.classNames.includes(c.className))
                ?.track3Stack || 'PYTHON_FLASK'
            : undefined
        const data = await modulesApi.all(form.track, track3Stack)
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
  }, [showNew, form.track, form.classNames.join('|'), JSON.stringify(classOptions.map((c) => `${c.className}:${c.track}:${c.track3Stack || ''}`))])

  useEffect(() => {
    if (!showNew || !form.moduleId) {
      setCurriculumLessonsPick([])
      return
    }
    let cancelled = false
    curriculumApi
      .lessonsByModule(form.moduleId, false)
      .then((list) => {
        if (!cancelled) setCurriculumLessonsPick(Array.isArray(list) ? list : [])
      })
      .catch(() => {
        if (!cancelled) setCurriculumLessonsPick([])
      })
    return () => {
      cancelled = true
    }
  }, [showNew, form.moduleId])

  /** Auto-link plan to curriculum lesson: class "next lesson" if it matches this module, else first published lesson in module. */
  useEffect(() => {
    if (!showNew || editingPlanId || curriculumAutoDoneRef.current) return
    if (!form.moduleId || curriculumLessonsPick.length === 0) return

    const schoolId =
      Array.isArray(classes) && classes[0] ? classes[0].schoolId || classes[0].school?.id || '' : ''
    const firstClassName =
      form.classNames.find((cn) => {
        const o = classOptions.find((x) => x.className === cn && x.track === form.track)
        return !!o
      }) || form.classNames[0]
    const applyFirstInModule = () => {
      const sorted = [...curriculumLessonsPick].sort(
        (a: any, b: any) => (a.position || 0) - (b.position || 0),
      )
      const pick = sorted[0]
      if (pick?.id) {
        setForm((f) => ({ ...f, curriculumLessonId: pick.id }))
        curriculumAutoDoneRef.current = true
      }
    }

    if (!schoolId || !firstClassName) {
      applyFirstInModule()
      return
    }

    const co = classOptions.find((x) => x.className === firstClassName && x.track === form.track)
    if (!co) {
      applyFirstInModule()
      return
    }

    let cancelled = false
    curriculumApi
      .classState(schoolId, firstClassName, co.track, co.track3Stack)
      .then((state) => {
        if (cancelled || curriculumAutoDoneRef.current) return
        const cur = state?.currentLesson
        const mid = form.moduleId
        if (cur?.module?.id === mid && cur.id) {
          setForm((f) => ({ ...f, curriculumLessonId: cur.id }))
          curriculumAutoDoneRef.current = true
        } else {
          applyFirstInModule()
        }
      })
      .catch(() => {
        if (cancelled || curriculumAutoDoneRef.current) return
        applyFirstInModule()
      })
    return () => {
      cancelled = true
    }
  }, [
    showNew,
    editingPlanId,
    form.moduleId,
    curriculumLessonsPick,
    form.classNames.join('|'),
    form.track,
    JSON.stringify(
      (classOptions || []).map((c: { className: string; track: string; track3Stack?: string }) =>
        `${c.className}:${c.track}:${c.track3Stack || ''}`,
      ),
    ),
    JSON.stringify(
      Array.isArray(classes) && classes[0]
        ? [classes[0].schoolId || classes[0].school?.id || '']
        : [],
    ),
  ])

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
  const draftStepsWithAi = async () => {
    if (!form.moduleId) {
      notify.warning('Select a module first — the draft is aligned to module objectives.')
      return
    }
    setAiDraftingSteps(true)
    try {
      const res = await lessonsApi.generateSteps({
        moduleId: form.moduleId,
        curriculumLessonId: form.curriculumLessonId?.trim() || undefined,
        durationMins: Number(form.durationMins) || 75,
      })
      const nextSteps = Array.isArray((res as any)?.steps) ? (res as any).steps : []
      if (!nextSteps.length) {
        notify.warning('No steps returned — try again or use suggested steps.')
        return
      }
      setForm((f) => ({
        ...f,
        steps: nextSteps.map((s: any) => ({
          title: String(s?.title || ''),
          desc: String(s?.desc || ''),
          mins: Math.max(0, Number(s?.mins) || 0),
        })),
      }))
      notify.success('AI draft loaded — review and edit before saving.')
    } catch (e: any) {
      notify.fromError(e)
    } finally {
      setAiDraftingSteps(false)
    }
  }

  const draftLearningMaterialWithAi = async () => {
    if (!form.moduleId) {
      notify.warning('Select a module first — the draft follows module objectives (and optional curriculum lesson).')
      return
    }
    setAiDraftingMaterial(true)
    try {
      const res = await lessonsApi.generateLearningMaterial({
        moduleId: form.moduleId,
        curriculumLessonId: form.curriculumLessonId?.trim() || undefined,
        depth: materialDepth,
      })
      const sessionTitle = String((res as any)?.sessionTitle || '').trim() || 'Teaching material'
      const slides = Array.isArray((res as any)?.slides) ? (res as any).slides : []
      const markdown = String((res as any)?.markdown || '').trim()
      const teacherGuideMarkdown = String((res as any)?.teacherGuideMarkdown || '').trim()
      const studentHandoutMarkdown = String((res as any)?.studentHandoutMarkdown || '').trim()
      const practice = (res as any)?.practice
      if (!slides.length && !markdown) {
        notify.warning('No material returned — try again.')
        return
      }
      setMaterialDraft({
        sessionTitle,
        slides: slides.map((s: any) => ({
          title: String(s?.title || ''),
          bullets: Array.isArray(s?.bullets) ? s.bullets.map((b: any) => String(b || '').trim()).filter(Boolean) : [],
        })),
        markdown: markdown || '',
        teacherGuideMarkdown,
        studentHandoutMarkdown,
        practice:
          practice && typeof practice === 'object'
            ? {
                classwork: Array.isArray(practice.classwork) ? practice.classwork.map((x: any) => String(x || '').trim()).filter(Boolean) : [],
                homework: Array.isArray(practice.homework) ? practice.homework.map((x: any) => String(x || '').trim()).filter(Boolean) : [],
                answers: Array.isArray(practice.answers) ? practice.answers.map((x: any) => String(x || '').trim()).filter(Boolean) : [],
              }
            : undefined,
        modelUsed: (res as any)?.modelUsed,
        depth: (res as any)?.depth === 'quick' ? 'quick' : 'full',
      })
      setMaterialView(studentHandoutMarkdown ? 'handout' : teacherGuideMarkdown ? 'teacher' : 'slides')
      setMaterialDraftModal(true)
      const depthLabel = (res as any)?.depth === 'quick' ? 'Quick draft' : 'Full lesson pack'
      notify.success(`${depthLabel} ready — review the student handout, then publish or export.`)
    } catch (e: any) {
      notify.fromError(e)
    } finally {
      setAiDraftingMaterial(false)
    }
  }

  const downloadMaterialMarkdown = () => {
    if (!materialDraft) return
    let text = materialDraft.markdown?.trim() || ''
    if (!text && materialDraft.slides.length) {
      const lines = [`# ${materialDraft.sessionTitle}`, '']
      for (const s of materialDraft.slides) {
        lines.push(`## ${s.title}`, '')
        for (const b of s.bullets) lines.push(`- ${b}`)
        lines.push('')
      }
      text = lines.join('\n').trim()
    }
    if (!text) return
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(materialDraft.sessionTitle || 'material').replace(/[^\w\-]+/g, '_').slice(0, 60)}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const downloadTeacherGuideMarkdown = () => {
    if (!materialDraft?.teacherGuideMarkdown?.trim()) return
    const blob = new Blob([materialDraft.teacherGuideMarkdown.trim()], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(materialDraft.sessionTitle || 'teacher_guide').replace(/[^\w\-]+/g, '_').slice(0, 60)}__teacher.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const downloadStudentHandoutMarkdown = () => {
    if (!materialDraft?.studentHandoutMarkdown?.trim()) return
    const blob = new Blob([materialDraft.studentHandoutMarkdown.trim()], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(materialDraft.sessionTitle || 'handout').replace(/[^\w\-]+/g, '_').slice(0, 60)}__handout.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const publishHandoutToClass = async () => {
    if (!materialDraft?.studentHandoutMarkdown?.trim()) {
      notify.warning('Generate or paste a student handout first')
      return
    }
    if (!editingPlanId) {
      notify.warning('Save this lesson plan first, then publish the handout to your class.')
      return
    }
    setPublishingMaterial(true)
    try {
      await lessonsApi.publishMaterial(editingPlanId, {
        studentHandoutMarkdown: materialDraft.studentHandoutMarkdown.trim(),
      })
      notify.success('Student handout published — your class can read it under My Modules.')
      const refreshedPlans = await lessonsApi.mine().catch(() => null)
      if (Array.isArray(refreshedPlans)) setPlans(refreshedPlans)
    } catch (e: any) {
      notify.fromError(e)
    }
    setPublishingMaterial(false)
  }

  const downloadPracticeMarkdown = () => {
    if (!materialDraft?.practice) return
    const p = materialDraft.practice
    const lines: string[] = [`# Practice: ${materialDraft.sessionTitle}`, '']
    if (p.classwork?.length) {
      lines.push('## Classwork', '')
      p.classwork.forEach((q, i) => lines.push(`${i + 1}. ${q}`))
      lines.push('')
    }
    if (p.homework?.length) {
      lines.push('## Homework', '')
      p.homework.forEach((q, i) => lines.push(`${i + 1}. ${q}`))
      lines.push('')
    }
    if (p.answers?.length) {
      lines.push('## Answer key', '')
      p.answers.forEach((a, i) => lines.push(`${i + 1}. ${a}`))
      lines.push('')
    }
    const text = lines.join('\n').trim()
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(materialDraft.sessionTitle || 'practice').replace(/[^\w\-]+/g, '_').slice(0, 60)}__practice.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const downloadMaterialHtml = () => {
    if (!materialDraft) return
    const esc = (t: string) =>
      t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const slidesHtml = materialDraft.slides
      .map(
        (s) => `
      <section class="slide">
        <h2>${esc(s.title)}</h2>
        <ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
      </section>`,
      )
      .join('\n')
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>${esc(materialDraft.sessionTitle)}</title>
<style>
  body{font-family:system-ui,sans-serif;line-height:1.45;color:#111;max-width:720px;margin:24px auto;padding:0 16px;}
  .slide{page-break-after:always;margin-bottom:48px;padding:16px 0;border-bottom:1px solid #eee;}
  .slide:last-child{border-bottom:none;}
  h1{font-size:1.5rem;} h2{font-size:1.2rem;margin-bottom:12px;}
  ul{padding-left:1.2rem;}
  @media print{ .slide{page-break-after:always;border:none;} body{margin:0;max-width:none;} }
</style></head><body>
<h1>${esc(materialDraft.sessionTitle)}</h1>
${slidesHtml}
<p style="margin-top:48px;font-size:12px;color:#666;">Draft — AdharaEdu tutor export</p>
</body></html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(materialDraft.sessionTitle || 'slides').replace(/[^\w\-]+/g, '_').slice(0, 60)}.html`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const removeStep = (index: number) => {
    setForm(f => ({ ...f, steps: f.steps.filter((_, i) => i !== index) }))
  }
  const setStep = (i: number, k: 'title' | 'desc' | 'mins', v: string | number) => {
    setForm(f => ({ ...f, steps: f.steps.map((s, j) => j === i ? { ...s, [k]: v } : s) }))
  }
  const classesForTrack = classOptions.filter((c) => c.track === form.track)
  const toggleClassTarget = (className: string) => {
    curriculumAutoDoneRef.current = false
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
        curriculumLessonId: form.curriculumLessonId?.trim() || null,
        title: generatedTitle,
        durationMins: form.durationMins,
        venue: form.venue,
        scheduledAt: form.scheduledAt,
        schoolId,
        steps: cleanedSteps.map(s => ({ ...s, color: 'var(--gold)' })),
        studentHandoutMarkdown: materialDraft?.studentHandoutMarkdown?.trim() || undefined,
      }
      if (editingPlanId) {
        await lessonsApi.update(editingPlanId, payload)
        if (materialFile) await uploadsApi.lessonPlan(materialFile, editingPlanId).catch(() => null)
      } else {
        const created = await lessonsApi.create(payload)
        const createdPlans = Array.isArray(created) ? created : [created]
        if (createdPlans[0]?.id) setEditingPlanId(createdPlans[0].id)
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
    setConfirm({
      title: 'Delete lesson plan?',
      danger: true,
      message: 'This cannot be undone.',
      onConfirm: async () => {
        setConfirm(null)
        try {
          await lessonsApi.delete(id)
          setPlans((p: any[]) => p.filter((x: any) => x.id !== id))
          notify.success('Lesson plan deleted')
        } catch (e: any) {
          notify.fromError(e)
        }
      },
    })
  }
  const startEdit = (plan: any) => {
    curriculumAutoDoneRef.current = true
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
      curriculumLessonId: plan.curriculumLessonId || '',
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
      <ConfirmModal
        open={!!confirm}
        title={confirm?.title || 'Confirm'}
        message={confirm?.message || ''}
        confirmText={confirm?.danger ? 'Delete' : 'Confirm'}
        cancelText="Cancel"
        danger={!!confirm?.danger}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm?.onConfirm?.()}
      />
      <Modal
        open={materialDraftModal && !!materialDraft}
        onClose={() => {
          setMaterialDraftModal(false)
          setMaterialDraft(null)
        }}
        title="AI teaching material (draft)"
        panelMaxWidth={1080}
      >
        {materialDraft && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
              <p className="text-muted text-sm" style={{ margin: 0, flex: '1 1 200px' }}>
                Start with <strong>Student handout</strong> for the full topic. Slides are a classroom summary only.
              </p>
              {materialDraft.depth && (
                <span className="material-depth-badge">
                  {materialDraft.depth === 'full' ? 'Full depth · ~45s' : 'Quick draft'}
                </span>
              )}
            </div>
            {materialDraft.modelUsed && (
              <div className="text-muted text-xs">Model: {materialDraft.modelUsed}</div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={downloadMaterialMarkdown}
                disabled={!materialDraft.markdown?.trim() && !materialDraft.slides.length}
              >
                Download .md
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={downloadTeacherGuideMarkdown} disabled={!materialDraft.teacherGuideMarkdown?.trim()}>
                Teacher guide .md
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={downloadStudentHandoutMarkdown} disabled={!materialDraft.studentHandoutMarkdown?.trim()}>
                Student handout .md
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={downloadPracticeMarkdown} disabled={!materialDraft.practice}>
                Practice + answers .md
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={downloadMaterialHtml}>
                Download .html (slides)
              </button>
              <button
                type="button"
                className="btn btn-success btn-sm"
                onClick={publishHandoutToClass}
                disabled={publishingMaterial || !materialDraft.studentHandoutMarkdown?.trim() || !editingPlanId}
                title={!editingPlanId ? 'Save the lesson plan first' : 'Publish student handout to class'}
              >
                {publishingMaterial ? 'Publishing…' : 'Publish handout to class'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className={`btn btn-sm ${materialView === 'handout' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMaterialView('handout')} disabled={!materialDraft.studentHandoutMarkdown?.trim()}>
                Student handout
              </button>
              <button type="button" className={`btn btn-sm ${materialView === 'slides' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMaterialView('slides')}>
                Slides (summary)
              </button>
              <button type="button" className={`btn btn-sm ${materialView === 'teacher' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMaterialView('teacher')} disabled={!materialDraft.teacherGuideMarkdown?.trim()}>
                Teacher guide
              </button>
              <button type="button" className={`btn btn-sm ${materialView === 'practice' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMaterialView('practice')} disabled={!materialDraft.practice}>
                Practice
              </button>
            </div>
            <div className="learning-material-panel">
              <div className="font-display fw-700 text-white mb-12" style={{ fontSize: 16 }}>{materialDraft.sessionTitle}</div>
              {materialView === 'slides' && (
                <>
                  {materialDraft.slides.map((s, idx) => (
                    <div key={idx} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: idx < materialDraft.slides.length - 1 ? '1px dashed var(--border2)' : 'none' }}>
                      <div style={{ color: 'var(--gold)', fontWeight: 600, marginBottom: 8 }}>{s.title || `Slide ${idx + 1}`}</div>
                      <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--white)', fontSize: 14 }}>
                        {s.bullets.map((b, j) => (
                          <li key={j} style={{ marginBottom: 4 }}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </>
              )}
              {materialView === 'teacher' && materialDraft.teacherGuideMarkdown?.trim() && (
                <MaterialPreview
                  markdown={materialDraft.teacherGuideMarkdown}
                  title={materialDraft.sessionTitle}
                />
              )}
              {materialView === 'handout' && materialDraft.studentHandoutMarkdown?.trim() && (
                <MaterialPreview
                  markdown={materialDraft.studentHandoutMarkdown}
                  title={materialDraft.sessionTitle}
                />
              )}
              {materialView === 'teacher' && !materialDraft.teacherGuideMarkdown?.trim() && (
                <p className="text-muted text-sm">No teacher guide in this draft.</p>
              )}
              {materialView === 'handout' && !materialDraft.studentHandoutMarkdown?.trim() && (
                <p className="text-muted text-sm">No student handout in this draft.</p>
              )}
              {materialView === 'practice' && (
                <div style={{ color: 'var(--white)', fontSize: 13 }}>
                  <div style={{ marginBottom: 12 }}>
                    <div className="text-muted text-xs mb-6">Classwork</div>
                    <ol style={{ margin: 0, paddingLeft: 18 }}>
                      {(materialDraft.practice?.classwork || []).map((q, i) => (
                        <li key={i} style={{ marginBottom: 6 }}>{q}</li>
                      ))}
                    </ol>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div className="text-muted text-xs mb-6">Homework</div>
                    <ol style={{ margin: 0, paddingLeft: 18 }}>
                      {(materialDraft.practice?.homework || []).map((q, i) => (
                        <li key={i} style={{ marginBottom: 6 }}>{q}</li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <div className="text-muted text-xs mb-6">Answer key</div>
                    <ol style={{ margin: 0, paddingLeft: 18 }}>
                      {(materialDraft.practice?.answers || []).map((a, i) => (
                        <li key={i} style={{ marginBottom: 6 }}>{a}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
      <div className="flex-between mb-20">
        <div><h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Lesson Plans</h3><div className="text-muted text-sm">Structured session guides for your classes</div></div>
        <button
          onClick={() => {
            setShowNew((prev) => {
              const next = !prev
              if (next) {
                curriculumAutoDoneRef.current = false
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
                    curriculumAutoDoneRef.current = false
                    setForm({ ...form, track: nextTrack, classNames: nextClasses, className: nextClasses[0] || '', moduleId: '', curriculumLessonId: '', title: '' })
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
                    curriculumAutoDoneRef.current = false
                    setForm({
                      ...form,
                      moduleId: nextModuleId,
                      curriculumLessonId: '',
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
            {form.moduleId && (
              <div>
                <label className="form-label">Link to curriculum lesson (optional)</label>
                <select
                  className="form-input"
                  value={form.curriculumLessonId || ''}
                  onChange={(e) => {
                    curriculumAutoDoneRef.current = true
                    setForm({ ...form, curriculumLessonId: e.target.value })
                  }}
                  style={{ appearance: 'none' }}
                >
                  <option value="">— Not linked —</option>
                  {curriculumLessonsPick.map((L: any) => (
                    <option key={L.id} value={L.id}>
                      {L.position}. {L.title}
                    </option>
                  ))}
                </select>
                <div className="text-muted text-xs mt-6">
                  Auto-filled when possible: the class’s <strong>next curriculum lesson</strong> (from session history), otherwise the <strong>first published lesson</strong> in this module. Change anytime.
                </div>
              </div>
            )}
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
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={applySuggestedSteps} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>Use Suggested Steps</button>
                  <button
                    type="button"
                    onClick={draftStepsWithAi}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11 }}
                    disabled={aiDraftingSteps || !form.moduleId}
                    title={!form.moduleId ? 'Pick a module first' : 'Gemini draft from module + optional curriculum lesson'}
                  >
                    {aiDraftingSteps ? 'Drafting…' : 'Draft steps with AI'}
                  </button>
                  <select
                    className="form-input"
                    value={materialDepth}
                    onChange={(e) => setMaterialDepth(e.target.value as 'full' | 'quick')}
                    style={{ fontSize: 11, padding: '6px 8px', width: 'auto', minWidth: 108 }}
                    title="Full = detailed handout (slower). Quick = short draft."
                    disabled={aiDraftingMaterial}
                  >
                    <option value="full">Full depth</option>
                    <option value="quick">Quick</option>
                  </select>
                  <button
                    type="button"
                    onClick={draftLearningMaterialWithAi}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11 }}
                    disabled={aiDraftingMaterial || !form.moduleId}
                    title={
                      !form.moduleId
                        ? 'Pick a module first'
                        : materialDepth === 'full'
                          ? 'Detailed handout + teacher guide (3 AI passes, ~30–60s)'
                          : 'Faster short draft (single pass)'
                    }
                  >
                    {aiDraftingMaterial
                      ? materialDepth === 'full'
                        ? 'Generating full pack…'
                        : 'Generating…'
                      : 'Draft material (AI)'}
                  </button>
                  <button type="button" onClick={addStep} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>+ Add Step</button>
                </div>
              </div>
              <div className="text-muted text-xs mb-8" style={{ marginTop: -4 }}>
                Manual template, AI draft, or your own rows — step minutes must match total duration. AI output is a starting point only until you save.
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
              <div className="text-muted text-sm mb-12">
                {plan.className} · {plan.durationMins} minutes · {plan.venue}
                {plan.curriculumLesson?.title && (
                  <span className="badge badge-teal" style={{ marginLeft: 8, fontSize: 10 }}>
                    Curriculum: {plan.curriculumLesson.position}. {plan.curriculumLesson.title}
                  </span>
                )}
              </div>
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
function TutorAssignments({ classes, onSection }: { classes: any[]; onSection: (s: string) => void }) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('')
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<any[]>([])
  const [loadingAssignmentSubmissions, setLoadingAssignmentSubmissions] = useState(false)
  const [gradingAssignment, setGradingAssignment] = useState(false)
  const [asgAiGradingId, setAsgAiGradingId] = useState<string | null>(null)
  const [asgScoreById, setAsgScoreById] = useState<Record<string, string>>({})
  const [asgFeedbackById, setAsgFeedbackById] = useState<Record<string, string>>({})
  const [queueRefresh, setQueueRefresh] = useState(0)
  const { items: aiReviewItems } = useUnifiedAiReviewQueue(queueRefresh)
  const [confirm, setConfirm] = useState<null | { title: string; message: React.ReactNode; danger?: boolean; onConfirm: () => void }>(null)
  const [materialFile, setMaterialFile] = useState<File | null>(null)
  const [modulesForTrack, setModulesForTrack] = useState<Array<{ value: string; label: string; moduleId: string }>>([])
  const [loadingModules, setLoadingModules] = useState(false)
  const classOptions = Array.from(
    new Map(
      (Array.isArray(classes) ? classes : [])
        .filter((c: any) => c?.className)
        .map((c: any) => [
          c.className,
          {
            className: c.className,
            track: c.track || 'TRACK_1',
            schoolId: c.schoolId || c.school?.id || '',
            track3Stack: c.track3Stack as string | undefined,
          },
        ])
    ).values()
  ) as Array<{ className: string; track: string; schoolId: string; track3Stack?: string }>
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
    submissionType: 'mixed',
    modelAnswer: '',
    lessonObjective: '',
    allowedExtensions: '',
    maxSizeMB: '10',
    structuredRubric: null as StructuredRubric | null,
  })
  const [queueApprovingId, setQueueApprovingId] = useState<string | null>(null)
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
        const track3Stack =
          form.track === 'TRACK_3'
            ? classOptions.find((c) => c.track === 'TRACK_3' && form.classNames.includes(c.className))
                ?.track3Stack || 'PYTHON_FLASK'
            : undefined
        const data = await modulesApi.all(form.track, track3Stack)
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
  }, [form.track, form.classNames.join('|'), JSON.stringify(classOptions.map((c) => `${c.className}:${c.track}:${c.track3Stack || ''}`))])

  const approveAssignmentFromQueue = async (item: AiReviewItem) => {
    setQueueApprovingId(item.id)
    try {
      await assignmentsApi.approveAiGrade(item.id, {})
      setQueueRefresh((n) => n + 1)
      if (selectedAssignmentId && item.parentId === selectedAssignmentId) {
        await openAssignmentModal(selectedAssignmentId)
      }
      notify.success('AI grade approved')
    } catch (e: any) {
      notify.error(e?.message || 'Failed to approve AI grade')
    }
    setQueueApprovingId(null)
  }

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

  const selectedAssignment = useMemo(
    () => items.find((a: any) => a.id === selectedAssignmentId) || null,
    [items, selectedAssignmentId],
  )

  const loadAssignmentSubmissions = useCallback(async (assignmentId: string) => {
    setLoadingAssignmentSubmissions(true)
    try {
      const data = await assignmentsApi.submissions(assignmentId)
      const rows = Array.isArray(data) ? data : []
      setAssignmentSubmissions(rows)
      setAsgScoreById(
        rows.reduce(
          (acc: Record<string, string>, s: any) => ({
            ...acc,
            [s.id]: s.score != null && s.score !== undefined ? String(s.score) : '',
          }),
          {},
        ),
      )
      setAsgFeedbackById(rows.reduce((acc: Record<string, string>, s: any) => ({ ...acc, [s.id]: s.feedback || '' }), {}))
    } catch {
      setAssignmentSubmissions([])
    }
    setLoadingAssignmentSubmissions(false)
  }, [])

  const openAssignmentModal = useCallback(
    async (assignmentId: string) => {
      setSelectedAssignmentId(assignmentId)
      setAssignmentModalOpen(true)
      await loadAssignmentSubmissions(assignmentId)
    },
    [loadAssignmentSubmissions],
  )

  useEffect(() => {
    const pending = consumePendingAiReview()
    if (pending?.kind === 'assignment' && pending.parentId) {
      openAssignmentModal(pending.parentId)
    }
  }, [openAssignmentModal])

  const gradeAssignmentSubmission = useCallback(
    async (submissionId: string) => {
      const score = Number(asgScoreById[submissionId])
      if (!Number.isFinite(score)) {
        notify.warning('Enter a valid score before saving')
        return
      }
      setGradingAssignment(true)
      try {
        await assignmentsApi.grade(submissionId, score, asgFeedbackById[submissionId] || '')
        if (selectedAssignmentId) await loadAssignmentSubmissions(selectedAssignmentId)
        setQueueRefresh((n) => n + 1)
        notify.success('Grade saved')
      } catch (e: any) {
        notify.error(e?.message || 'Failed to save grade')
      }
      setGradingAssignment(false)
    },
    [asgFeedbackById, asgScoreById, loadAssignmentSubmissions, selectedAssignmentId],
  )

  const runAssignmentAiGrade = useCallback(
    async (submissionId: string) => {
      setAsgAiGradingId(submissionId)
      try {
        const updated = await assignmentsApi.aiGrade(submissionId)
        if (updated?.aiProposedScore != null) {
          setAsgScoreById((prev) => ({ ...prev, [submissionId]: String(updated.aiProposedScore) }))
          setAsgFeedbackById((prev) => ({ ...prev, [submissionId]: updated.aiProposedFeedback || '' }))
          setAssignmentSubmissions((rows) => rows.map((s: any) => (s.id === submissionId ? { ...s, ...updated } : s)))
        }
        setQueueRefresh((n) => n + 1)
        notify.success('AI grade proposed — review extracted evidence before approving')
      } catch (e: any) {
        notify.error(e?.message || 'AI grading failed')
      }
      setAsgAiGradingId(null)
    },
    [],
  )

  const approveAssignmentAiGrade = useCallback(
    async (submissionId: string) => {
      setGradingAssignment(true)
      try {
        const score = Number(asgScoreById[submissionId])
        await assignmentsApi.approveAiGrade(submissionId, {
          score: Number.isFinite(score) ? score : undefined,
          feedback: asgFeedbackById[submissionId] || undefined,
        })
        if (selectedAssignmentId) await loadAssignmentSubmissions(selectedAssignmentId)
        setQueueRefresh((n) => n + 1)
        notify.success('AI grade approved')
      } catch (e: any) {
        notify.error(e?.message || 'Failed to approve AI grade')
      }
      setGradingAssignment(false)
    },
    [asgFeedbackById, asgScoreById, loadAssignmentSubmissions, selectedAssignmentId],
  )

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
        submissionType: form.submissionType,
        allowedExtensions: parseExtensionList(form.allowedExtensions),
        maxSizeMB: Number(form.maxSizeMB) || 10,
        modelAnswer: form.modelAnswer.trim() || undefined,
        lessonObjective: form.lessonObjective.trim() || undefined,
        structuredRubric: form.structuredRubric || undefined,
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
        submissionType: 'mixed',
        modelAnswer: '',
        lessonObjective: '',
        allowedExtensions: '',
        maxSizeMB: '10',
        structuredRubric: null,
      })
      setMaterialFile(null)
      await loadAssignments()
    } catch (e: any) {
      notify.error(e?.message || 'Failed to create assignment')
    }
    setSaving(false)
  }

  const remove = async (id: string) => {
    setConfirm({
      title: 'Delete assignment?',
      danger: true,
      message: 'This cannot be undone.',
      onConfirm: async () => {
        setConfirm(null)
        try {
          await assignmentsApi.delete(id)
          setItems((prev) => prev.filter((x: any) => x.id !== id))
          if (id === selectedAssignmentId) {
            setAssignmentModalOpen(false)
            setSelectedAssignmentId('')
          }
          notify.success('Assignment deleted')
        } catch (e: any) {
          notify.error(e?.message || 'Failed to delete assignment')
        }
      },
    })
  }

  return (
    <div>
      <ConfirmModal
        open={!!confirm}
        title={confirm?.title || 'Confirm'}
        message={confirm?.message || ''}
        confirmText={confirm?.danger ? 'Delete' : 'Confirm'}
        cancelText="Cancel"
        danger={!!confirm?.danger}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm?.onConfirm?.()}
      />
      <Modal
        open={assignmentModalOpen && !!selectedAssignmentId}
        onClose={() => setAssignmentModalOpen(false)}
        title={selectedAssignment ? `Submissions · ${selectedAssignment.title}` : 'Assignment'}
        panelMaxWidth={1080}
      >
        {selectedAssignment && (
          <>
            <div className="text-muted text-sm" style={{ marginBottom: 12, lineHeight: 1.5 }}>
              {selectedAssignment.className}
              {(() => {
                const tr = classOptions.find((c) => c.className === selectedAssignment.className)?.track || ''
                return tr ? ` · ${String(tr).replace('TRACK_', 'Track ')}` : ''
              })()}
              {selectedAssignment.dueDate ? ` · Due ${new Date(selectedAssignment.dueDate).toLocaleString('en-NG')}` : ''}
              {selectedAssignment.maxScore != null ? ` · Max score ${selectedAssignment.maxScore}` : ''}
            </div>
            {selectedAssignment.description ? (
              <p className="text-sm" style={{ color: 'var(--white2)', marginBottom: 12, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {selectedAssignment.description}
              </p>
            ) : null}
            {selectedAssignment.attachmentUrl ? (
              <p className="text-sm" style={{ marginBottom: 14 }}>
                <a href={selectedAssignment.attachmentUrl} target="_blank" rel="noreferrer" className="text-teal">
                  Download assignment file
                </a>
              </p>
            ) : null}
          </>
        )}
        {loadingAssignmentSubmissions ? (
          <p className="text-muted text-sm">Loading submissions…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {assignmentSubmissions.map((s: any) => {
              const studentLabel = s.student
                ? `${s.student.user?.firstName || ''} ${s.student.user?.lastName || ''}`.trim() || s.studentId
                : s.studentId
              const graded = s.score != null && s.score !== undefined
              return (
                <div
                  key={s.id}
                  style={{
                    border: '1px solid var(--border2)',
                    borderRadius: 12,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    background: 'var(--muted3)',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 600, color: 'var(--white)', wordBreak: 'break-word' }}>{studentLabel}</span>
                    <span className={`badge badge-${graded ? 'success' : s.status === 'LATE' ? 'warning' : 'info'}`} style={{ flexShrink: 0 }}>
                      {graded ? 'GRADED' : s.status || 'SUBMITTED'}
                    </span>
                  </div>
                  {s.fileUrl ? (
                    <div className="text-sm">
                      <span className="text-muted">Evidence: </span>
                      <SubmissionEvidenceLinks
                        evidenceUrl={s.fileUrl}
                        submissionType={selectedAssignment?.submissionType}
                      />
                    </div>
                  ) : null}
                  {s.textBody ? (
                    <div className="text-muted text-xs" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
                      {s.textBody}
                    </div>
                  ) : null}
                  <SubmissionGradingProposal
                    submission={s}
                    maxScore={selectedAssignment?.maxScore ?? 100}
                    scoreValue={asgScoreById[s.id] ?? ''}
                    feedbackValue={asgFeedbackById[s.id] ?? ''}
                    onScoreChange={(v) => setAsgScoreById((prev) => ({ ...prev, [s.id]: v }))}
                    onFeedbackChange={(v) => setAsgFeedbackById((prev) => ({ ...prev, [s.id]: v }))}
                    onAiGrade={() => runAssignmentAiGrade(s.id)}
                    onApprove={() => approveAssignmentAiGrade(s.id)}
                    onSave={() => gradeAssignmentSubmission(s.id)}
                    aiGradingId={asgAiGradingId}
                    grading={gradingAssignment}
                    submissionType={selectedAssignment?.submissionType}
                    gradingKind="assignment"
                    previewRefreshKey={queueRefresh}
                  />
                </div>
              )
            })}
            {assignmentSubmissions.length === 0 && (
              <p className="text-muted text-sm" style={{ textAlign: 'center', padding: '20px 8px' }}>
                No submissions yet for this assignment.
              </p>
            )}
          </div>
        )}
        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px solid var(--border2)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAssignmentModalOpen(false)}>
            Close
          </button>
          {selectedAssignment ? (
            <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(selectedAssignment.id)}>
              Delete assignment
            </button>
          ) : null}
        </div>
      </Modal>
      <AiReviewQueueCard
        items={aiReviewItems}
        onReview={(item) => {
          if (item.kind === 'assignment') {
            openAssignmentModal(item.parentId)
            return
          }
          sessionStorage.setItem(PENDING_AI_REVIEW_KEY, JSON.stringify(item))
          onSection('tutor-practicals')
        }}
        onApprove={approveAssignmentFromQueue}
        approvingId={queueApprovingId}
      />
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
            <SubmissionTypeFields
              submissionType={form.submissionType}
              modelAnswer={form.modelAnswer}
              lessonObjective={form.lessonObjective}
              allowedExtensions={form.allowedExtensions}
              maxSizeMB={form.maxSizeMB}
              onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            />
            <StructuredRubricBuilder
              submissionType={form.submissionType}
              maxScore={100}
              value={form.structuredRubric}
              onChange={(structuredRubric) => setForm((f) => ({ ...f, structuredRubric }))}
            />
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

      {loading ? (
        <p className="text-muted text-sm" style={{ padding: 20 }}>
          Loading assignments…
        </p>
      ) : (
        <div className="card">
          <div className="font-display fw-600 text-white mb-8">Your assignments</div>
          <p className="text-muted text-sm mb-16" style={{ lineHeight: 1.5 }}>
            Open an assignment to review submissions and enter grades on any screen size. Delete is available inside the panel.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((a: any) => {
              const classTrack = classOptions.find((c) => c.className === a.className)?.track || ''
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => openAssignmentModal(a.id)}
                  className="btn btn-ghost btn-sm"
                  style={{
                    justifyContent: 'space-between',
                    textAlign: 'left',
                    border: selectedAssignmentId === a.id ? '1px solid var(--gold)' : '1px solid var(--border2)',
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ minWidth: 0, paddingRight: 8 }}>
                    <div style={{ color: 'var(--white)', fontWeight: 600, wordBreak: 'break-word' }}>{a.title}</div>
                    <div className="text-muted text-xs" style={{ marginTop: 4 }}>
                      {a.className}
                      {classTrack ? ` · ${String(classTrack).replace('TRACK_', 'Track ')}` : ''}
                      {a.dueDate ? ` · Due ${new Date(a.dueDate).toLocaleString('en-NG')}` : ''}
                    </div>
                    {a.description ? (
                      <div className="text-muted text-xs" style={{ marginTop: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {a.description}
                      </div>
                    ) : null}
                  </div>
                  <span className="badge badge-info" style={{ flexShrink: 0 }}>
                    {a._count?.submissions ?? 0}
                  </span>
                </button>
              )
            })}
            {items.length === 0 && <div className="text-muted text-sm">No assignments yet.</div>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PRACTICALS ────────────────────────────────────────────────
function TutorPracticals({ classes, onSection }: { classes: any[]; onSection: (s: string) => void }) {
  const [tasks, setTasks] = useState<any[]>([])
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [savingTask, setSavingTask] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [submissionsModalOpen, setSubmissionsModalOpen] = useState(false)
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)
  const [grading, setGrading] = useState(false)
  const [aiGradingId, setAiGradingId] = useState<string | null>(null)
  const [queueRefresh, setQueueRefresh] = useState(0)
  const { items: aiReviewItems } = useUnifiedAiReviewQueue(queueRefresh)
  const [confirm, setConfirm] = useState<null | { title: string; message: React.ReactNode; danger?: boolean; onConfirm: () => void }>(null)
  const [scoreBySubmission, setScoreBySubmission] = useState<Record<string, string>>({})
  const [feedbackBySubmission, setFeedbackBySubmission] = useState<Record<string, string>>({})
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<string[]>([])
  const [bulkScore, setBulkScore] = useState('')
  const [bulkFeedback, setBulkFeedback] = useState('')
  const selectedTask = useMemo(() => tasks.find((t: any) => t.id === selectedTaskId) || null, [tasks, selectedTaskId])
  const classOptions = Array.from(
    new Map(
      (Array.isArray(classes) ? classes : [])
        .filter((c: any) => c?.className)
        .map((c: any) => [
          c.className,
          {
            className: c.className,
            track: c.track || 'TRACK_1',
            schoolId: c.schoolId || c.school?.id || '',
            track3Stack: c.track3Stack as string | undefined,
          },
        ])
    ).values()
  ) as Array<{ className: string; track: string; schoolId: string; track3Stack?: string }>
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
    structuredRubric: null as StructuredRubric | null,
    submissionType: 'html',
    modelAnswer: 'Page must include header, nav, main, footer; linked CSS with flex or grid; JS click handler that changes button text.',
    lessonObjective: 'Build a responsive landing page with semantic HTML and basic interactivity.',
    allowedExtensions: '.html, .htm, .css, .js, .zip',
    maxSizeMB: '10',
  })
  const [queueApprovingId, setQueueApprovingId] = useState<string | null>(null)

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
    setQueueRefresh((n) => n + 1)
  }, [tasks.length, submissions.length])
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
        const track3Stack =
          form.track === 'TRACK_3'
            ? classOptions.find((c) => c.track === 'TRACK_3' && form.classNames.includes(c.className))
                ?.track3Stack || 'PYTHON_FLASK'
            : undefined
        const data = await modulesApi.all(form.track, track3Stack)
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
  }, [showNew, form.track, form.classNames.join('|'), JSON.stringify(classOptions.map((c) => `${c.className}:${c.track}:${c.track3Stack || ''}`))])

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
        structuredRubric: form.structuredRubric || undefined,
        submissionType: form.submissionType,
        allowedExtensions: parseExtensionList(form.allowedExtensions),
        maxSizeMB: Number(form.maxSizeMB) || 10,
        modelAnswer: form.modelAnswer.trim() || undefined,
        lessonObjective: form.lessonObjective.trim() || undefined,
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
        structuredRubric: null,
        submissionType: 'html',
        modelAnswer: 'Page must include header, nav, main, footer; linked CSS with flex or grid; JS click handler that changes button text.',
        lessonObjective: 'Build a responsive landing page with semantic HTML and basic interactivity.',
        allowedExtensions: '.html, .htm, .css, .js, .zip',
        maxSizeMB: '10',
      })
      await loadTasks()
    } catch (e: any) {
      notify.error(e?.message || 'Failed to create practical task')
    }
    setSavingTask(false)
  }

  const openTask = async (taskId: string) => {
    setSelectedTaskId(taskId)
    setSubmissionsModalOpen(true)
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

  useEffect(() => {
    const pending = consumePendingAiReview()
    if (pending?.kind === 'practical' && pending.parentId) {
      openTask(pending.parentId)
    }
  }, [])

  const gradeOne = async (submissionId: string) => {
    const totalScore = Number(scoreBySubmission[submissionId])
    if (!Number.isFinite(totalScore)) {
      notify.warning('Enter a valid score before grading')
      return
    }
    setGrading(true)
    try {
      const row = submissions.find((s: any) => s.id === submissionId)
      await practicalsApi.grade(submissionId, {
        totalScore,
        feedback: feedbackBySubmission[submissionId] || '',
        scoreBreakdown: row?.aiScoreBreakdown ?? row?.scoreBreakdown,
      })
      if (selectedTaskId) await openTask(selectedTaskId)
      setQueueRefresh((n) => n + 1)
    } catch (e: any) {
      notify.error(e?.message || 'Failed to grade submission')
    }
    setGrading(false)
  }

  const runAiGrade = async (submissionId: string) => {
    setAiGradingId(submissionId)
    try {
      const updated = await practicalsApi.aiGrade(submissionId)
      if (updated?.aiProposedScore != null) {
        setScoreBySubmission((prev) => ({ ...prev, [submissionId]: String(updated.aiProposedScore) }))
        setFeedbackBySubmission((prev) => ({ ...prev, [submissionId]: updated.aiProposedFeedback || '' }))
        setSubmissions((rows) => rows.map((s: any) => (s.id === submissionId ? { ...s, ...updated } : s)))
      }
      setQueueRefresh((n) => n + 1)
      notify.success('AI grade proposed — review and approve or override')
    } catch (e: any) {
      notify.error(e?.message || 'AI grading failed')
    }
    setAiGradingId(null)
  }

  const approveAiGrade = async (submissionId: string) => {
    setGrading(true)
    try {
      const totalScore = Number(scoreBySubmission[submissionId])
      await practicalsApi.approveAiGrade(submissionId, {
        totalScore: Number.isFinite(totalScore) ? totalScore : undefined,
        feedback: feedbackBySubmission[submissionId] || undefined,
      })
      if (selectedTaskId) await openTask(selectedTaskId)
      setQueueRefresh((n) => n + 1)
      notify.success('AI grade approved')
    } catch (e: any) {
      notify.error(e?.message || 'Failed to approve AI grade')
    }
    setGrading(false)
  }

  const approvePracticalFromQueue = async (item: AiReviewItem) => {
    setQueueApprovingId(item.id)
    try {
      await practicalsApi.approveAiGrade(item.id, {})
      setQueueRefresh((n) => n + 1)
      if (selectedTaskId && item.parentId === selectedTaskId) await openTask(selectedTaskId)
      notify.success('AI grade approved')
    } catch (e: any) {
      notify.error(e?.message || 'Failed to approve AI grade')
    }
    setQueueApprovingId(null)
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
    setConfirm({
      title: 'Apply bulk score?',
      message: `Apply this score to ${targetCount} submission(s)? This bypasses AI evidence review — use only when you have checked submissions manually.`,
      onConfirm: async () => {
        setConfirm(null)
        setGrading(true)
        try {
          await practicalsApi.bulkGrade(selectedTaskId, {
            submissionIds: selectedSubmissionIds.length ? selectedSubmissionIds : undefined,
            totalScore,
            feedback: bulkFeedback || undefined,
          })
          await openTask(selectedTaskId)
          notify.success('Bulk score applied')
        } catch (e: any) {
          notify.error(e?.message || 'Failed to bulk grade')
        }
        setGrading(false)
      },
    })
    return
  }

  return (
    <div>
      <ConfirmModal
        open={!!confirm}
        title={confirm?.title || 'Confirm'}
        message={confirm?.message || ''}
        confirmText="Apply"
        cancelText="Cancel"
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm?.onConfirm?.()}
      />
      <Modal
        open={submissionsModalOpen && !!selectedTaskId}
        onClose={() => setSubmissionsModalOpen(false)}
        title={selectedTask ? `Submissions · ${selectedTask.title}` : 'Submissions'}
        panelMaxWidth={1080}
      >
        {selectedTask && (
          <div className="text-muted text-sm" style={{ marginBottom: 14, lineHeight: 1.5 }}>
            {selectedTask.className}
            {selectedTask.module ? ` · Module ${selectedTask.module.number}` : ''}
            {selectedTask.dueDate ? ` · Due ${new Date(selectedTask.dueDate).toLocaleString('en-NG')}` : ''}
          </div>
        )}
        {loadingSubmissions ? (
          <p className="text-muted text-sm">Loading submissions…</p>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
              <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                <label className="form-label">Bulk score</label>
                <input type="number" className="form-input" placeholder="e.g. 75" value={bulkScore} onChange={(e) => setBulkScore(e.target.value)} />
              </div>
              <div style={{ flex: '2 1 220px', minWidth: 0 }}>
                <label className="form-label">Bulk feedback (optional)</label>
                <input className="form-input" placeholder="Feedback for all selected" value={bulkFeedback} onChange={(e) => setBulkFeedback(e.target.value)} />
              </div>
              <div style={{ flex: '0 0 auto' }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={applyBulkGrade} disabled={grading}>
                  {grading ? 'Applying…' : 'Bulk grade'}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {submissions.map((s: any) => {
                const studentLabel = s.student
                  ? `${s.student.user?.firstName || ''} ${s.student.user?.lastName || ''}`.trim() || s.studentId
                  : s.studentId
                return (
                  <div
                    key={s.id}
                    style={{
                      border: '1px solid var(--border2)',
                      borderRadius: 12,
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      background: 'var(--muted3)',
                    }}
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', minWidth: 0, flex: '1 1 auto' }}>
                        <input type="checkbox" checked={selectedSubmissionIds.includes(s.id)} onChange={() => toggleSubmission(s.id)} style={{ accentColor: 'var(--teal)', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: 'var(--white)', wordBreak: 'break-word' }}>{studentLabel}</span>
                        <span className="badge badge-info" title="Submission attempt (retakes create a new attempt)">
                          #{s.attempt ?? 1}
                        </span>
                      </label>
                      <span
                        className={`badge badge-${s.status === 'PASSED' ? 'success' : s.status === 'REWORK_REQUIRED' ? 'warning' : 'info'}`}
                        style={{ flexShrink: 0 }}
                      >
                        {s.status}
                      </span>
                    </div>
                    <div className="text-sm" style={{ wordBreak: 'break-word' }}>
                      <span className="text-muted">Evidence: </span>
                      <SubmissionEvidenceLinks
                        evidenceUrl={s.evidenceUrl}
                        submissionType={selectedTask?.submissionType}
                      />
                      {s.evidenceText ? (
                        <div className="text-muted text-xs" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>
                          {s.evidenceText}
                        </div>
                      ) : null}
                    </div>
                    <SubmissionGradingProposal
                      submission={s}
                      maxScore={selectedTask?.maxScore ?? 100}
                      scoreValue={scoreBySubmission[s.id] ?? ''}
                      feedbackValue={feedbackBySubmission[s.id] ?? ''}
                      onScoreChange={(v) => setScoreBySubmission((prev) => ({ ...prev, [s.id]: v }))}
                      onFeedbackChange={(v) => setFeedbackBySubmission((prev) => ({ ...prev, [s.id]: v }))}
                      onAiGrade={() => runAiGrade(s.id)}
                      onApprove={() => approveAiGrade(s.id)}
                      onSave={() => gradeOne(s.id)}
                      aiGradingId={aiGradingId}
                      grading={grading}
                      submissionType={selectedTask?.submissionType}
                      gradingKind="practical"
                      previewRefreshKey={queueRefresh}
                    />
                  </div>
                )
              })}
              {submissions.length === 0 && (
                <p className="text-muted text-sm" style={{ textAlign: 'center', padding: '24px 8px' }}>
                  No submissions yet for this task.
                </p>
              )}
            </div>
          </>
        )}
      </Modal>
      <AiReviewQueueCard
        items={aiReviewItems}
        onReview={(item) => {
          if (item.kind === 'practical') {
            openTask(item.parentId)
            return
          }
          sessionStorage.setItem(PENDING_AI_REVIEW_KEY, JSON.stringify(item))
          onSection('tutor-assignments')
        }}
        onApprove={approvePracticalFromQueue}
        approvingId={queueApprovingId}
      />

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
            <SubmissionTypeFields
              submissionType={form.submissionType}
              modelAnswer={form.modelAnswer}
              lessonObjective={form.lessonObjective}
              allowedExtensions={form.allowedExtensions}
              maxSizeMB={form.maxSizeMB}
              onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', gap: 12 }}>
              <div><label className="form-label">Due Date (optional)</label><input type="datetime-local" className="form-input" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></div>
              <div><label className="form-label">Max Score</label><input type="number" className="form-input" min={1} value={form.maxScore} onChange={e => setForm({ ...form, maxScore: +e.target.value })} /></div>
              <div><label className="form-label">Pass Score</label><input type="number" className="form-input" min={0} value={form.passScore} onChange={e => setForm({ ...form, passScore: +e.target.value })} /></div>
            </div>
            <StructuredRubricBuilder
              submissionType={form.submissionType}
              maxScore={Number(form.maxScore) || 100}
              value={form.structuredRubric}
              onChange={(structuredRubric) => setForm((f) => ({ ...f, structuredRubric }))}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={savingTask}>{savingTask ? 'Saving…' : 'Create Practical Task →'}</button>
              <button type="button" onClick={() => setShowNew(false)} className="btn btn-ghost btn-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="font-display fw-600 text-white mb-8">Practical Tasks</div>
        <p className="text-muted text-sm mb-16" style={{ lineHeight: 1.5 }}>
          Select a task to open submissions and grading in a full-screen friendly panel (works on phones and desktops).
        </p>
        {loadingTasks ? <p className="text-muted text-sm">Loading tasks…</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tasks.map((t: any) => (
              <button
                key={t.id}
                type="button"
                onClick={() => openTask(t.id)}
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'space-between', textAlign: 'left', border: selectedTaskId === t.id ? '1px solid var(--gold)' : '1px solid var(--border2)', padding: '10px 12px' }}
              >
                <div style={{ minWidth: 0, paddingRight: 8 }}>
                  <div style={{ color: 'var(--white)', fontWeight: 600, wordBreak: 'break-word' }}>{t.title}</div>
                  <div className="text-muted text-xs">{t.className} · {t.module ? `Module ${t.module.number}` : 'Module'} · Due {t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-NG') : '—'}</div>
                </div>
                <span className="badge badge-info" style={{ flexShrink: 0 }}>{t._count?.submissions ?? 0}</span>
              </button>
            ))}
            {tasks.length === 0 && <div className="text-muted text-sm">No practical tasks yet.</div>}
          </div>
        )}
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
  const [selectedCbtClassKey, setSelectedCbtClassKey] = useState<string | null>(null)
  const [attemptsByExamId, setAttemptsByExamId] = useState<Record<string, any[]>>({})
  const [attemptsLoading, setAttemptsLoading] = useState(false)
  const [scoresModal, setScoresModal] = useState<null | { title: string; totalQuestions: number; classLabel: string }>(null)
  const [scoresRows, setScoresRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')
  const [modulesForTrack, setModulesForTrack] = useState<any[]>([])
  const [loadingModules, setLoadingModules] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiCount, setAiCount] = useState(12)
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [aiInclude, setAiInclude] = useState<Record<string, boolean>>({})
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
        const selectedClass = Array.isArray(classes) ? classes.find((c: any) => c.className === form.className) : null
        const track3Stack =
          form.track === 'TRACK_3' ? selectedClass?.track3Stack || 'PYTHON_FLASK' : undefined
        const data = await modulesApi.all(form.track, track3Stack)
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
  }, [form.track, form.className, view, JSON.stringify(classes.map((c: any) => `${c.className}:${c.track3Stack || ''}`))])
  const selectedModule = modulesForTrack.find((m: any) => m.id === form.moduleId)
  const isTermlyModule = selectedModule?.moduleType === 'TERM_EXAM'
  const isCompletionExamModule = selectedModule?.moduleType === 'TRACK_COMPLETION_EXAM'
  const isCombinedExamModule = isTermlyModule || isCompletionExamModule
  const normalMods = modulesForTrack
    .filter((m: any) => m.moduleType === 'STANDARD' || !m.moduleType)
    .sort((a: any, b: any) => (a.number || 0) - (b.number || 0))
  const generatedTitle = selectedModule
    ? isCompletionExamModule
      ? `${String(form.track || '').replace('TRACK_', 'Track ')} Completion Exam`
      : isTermlyModule
        ? `Term ${selectedModule.termOrdinal || ''} Termly Assessment — ${String(form.track || '').replace('TRACK_', 'Track ')}`
        : `Module ${selectedModule.number}: ${selectedModule.title} Assessment`
    : ''
  useEffect(() => {
    if (view !== 'create') return
    if (form.title !== generatedTitle) {
      setForm((prev) => ({ ...prev, title: generatedTitle }))
    }
  }, [generatedTitle, view])

  // Prefill sensible defaults for termly / completion exam modules
  useEffect(() => {
    if (view !== 'create') return
    if (!isCombinedExamModule) return
    setForm((prev: any) => ({
      ...prev,
      durationMins: prev.durationMins && prev.durationMins !== 30 ? prev.durationMins : 60,
      questions:
        Array.isArray(prev.questions) && prev.questions.length > 1
          ? prev.questions
          : [{ q: '', options: ['', '', '', ''], correct: 0, explanation: '' }],
    }))
  }, [isCombinedExamModule, view, selectedModule?.id])

  // Default module inclusion for AI when termly / completion exam is selected
  useEffect(() => {
    if (view !== 'create') return
    if (!isCombinedExamModule) {
      setAiInclude({})
      return
    }
    const next: Record<string, boolean> = {}
    normalMods.forEach((m: any) => { next[m.id] = true })
    setAiInclude(next)
  }, [isCombinedExamModule, view, selectedModule?.id, JSON.stringify(normalMods.map((m: any) => m.id))])

  const runAi = async () => {
    if (!form.moduleId) {
      notify.warning('Select a module first')
      return
    }
    if (isCombinedExamModule) {
      const selected = Object.entries(aiInclude).filter(([, v]) => v).map(([k]) => k)
      if (!selected.length) {
        notify.warning(isCompletionExamModule
          ? 'Select at least one standard module to include in the completion exam'
          : 'Select at least one module covered this term')
        return
      }
    }
    setAiGenerating(true)
    try {
      const includeModuleIds = isCombinedExamModule
        ? Object.entries(aiInclude).filter(([, v]) => v).map(([k]) => k)
        : undefined
      const res = await cbtApi.generateQuestions({
        moduleId: form.moduleId,
        includeModuleIds,
        count: Math.max(1, Math.min(60, Number(aiCount) || 12)),
        difficulty: aiDifficulty,
      })
      const qs = Array.isArray(res?.questions) ? res.questions : []
      if (!qs.length) {
        notify.warning('No questions generated')
      } else {
        setForm((f: any) => ({
          ...f,
          questions: qs.map((q: any) => ({
            q: q.questionText || '',
            options: Array.isArray(q.options) ? q.options : ['', '', '', ''],
            correct: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
            explanation: q.explanation || '',
          })),
        }))
        const model = res?.modelUsed ? String(res.modelUsed).replace(/^models\//, '') : ''
        notify.success(`Generated ${qs.length} questions${model ? ` (model: ${model})` : ''}`)
      }
    } catch (e: any) {
      notify.fromError(e, 'AI generation failed')
    }
    setAiGenerating(false)
  }

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
      const coveredModuleIds = isCombinedExamModule
        ? Object.entries(aiInclude).filter(([, v]) => v).map(([k]) => k)
        : undefined
      if (isCombinedExamModule && (!coveredModuleIds || !coveredModuleIds.length)) {
        notify.warning(isCompletionExamModule
          ? 'Select at least one standard module for the completion exam'
          : 'Select at least one module covered this term')
        setSaving(false)
        return
      }
      const newExam = await cbtApi.create({
        title: form.title || generatedTitle,
        moduleId: form.moduleId,
        track: form.track,
        durationMins: form.durationMins,
        ...(coveredModuleIds?.length ? { coveredModuleIds } : {}),
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

  const classKey = useCallback((schoolId: string, className: string) => `${String(schoolId).trim()}::${String(className).trim()}`, [])

  const cbtPageClassCards = useMemo(() => {
    const seen = new Set<string>()
    const cards: { key: string; className: string; schoolId: string; track: string; schoolName: string }[] = []
    for (const c of Array.isArray(classes) ? classes : []) {
      const schoolId = String(c.schoolId || c.school?.id || '').trim()
      const className = String(c.className || '').trim()
      if (!schoolId || !className) continue
      const key = classKey(schoolId, className)
      if (seen.has(key)) continue
      seen.add(key)
      cards.push({
        key,
        className,
        schoolId,
        track: String(c.track || '').trim() || '—',
        schoolName: String(c.school?.name || '').trim() || 'School',
      })
    }
    cards.sort((a, b) => a.className.localeCompare(b.className) || a.schoolName.localeCompare(b.schoolName))
    return cards
  }, [classes, classKey])

  const attemptsCountByClass = useMemo(() => {
    const m: Record<string, number> = {}
    for (const rows of Object.values(attemptsByExamId)) {
      for (const a of rows) {
        const k = classKey(String(a.student?.schoolId || ''), String(a.student?.className || ''))
        if (k === '::') continue
        m[k] = (m[k] || 0) + 1
      }
    }
    return m
  }, [attemptsByExamId, classKey])

  const examIdsKey = useMemo(() => [...exams].map((e: any) => e.id).sort().join(','), [exams])

  useEffect(() => {
    if (view !== 'list' || !exams.length) {
      setAttemptsByExamId({})
      setAttemptsLoading(false)
      return
    }
    let cancelled = false
    setAttemptsLoading(true)
    ;(async () => {
      const entries = await Promise.all(
        exams.map(async (ex: any) => {
          try {
            const rows = await cbtApi.attempts(ex.id)
            return [ex.id, Array.isArray(rows) ? rows : []] as const
          } catch {
            return [ex.id, []] as const
          }
        }),
      )
      if (cancelled) return
      const m: Record<string, any[]> = {}
      for (const [id, rows] of entries) m[id] = [...rows]
      setAttemptsByExamId(m)
      setAttemptsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [view, examIdsKey])

  const selectedClassLabel = useMemo(() => {
    if (!selectedCbtClassKey) return ''
    const c = cbtPageClassCards.find((x) => x.key === selectedCbtClassKey)
    if (!c) return selectedCbtClassKey
    const tr = c.track && c.track !== '—' ? c.track.replace(/^TRACK_/i, 'Track ') + ' · ' : ''
    return `${c.className} · ${tr}${c.schoolName}`.replace(/ · $/, '')
  }, [selectedCbtClassKey, cbtPageClassCards])

  const completedInSelectedClass = (examId: string) => {
    if (!selectedCbtClassKey) return 0
    const rows = attemptsByExamId[examId] || []
    return rows.filter(
      (row: any) => classKey(row.student?.schoolId || '', row.student?.className || '') === selectedCbtClassKey,
    ).length
  }

  const openScoresDetailModal = (exam: any) => {
    if (!selectedCbtClassKey) return
    const all = attemptsByExamId[exam.id] || []
    const filtered = all.filter(
      (row: any) => classKey(row.student?.schoolId || '', row.student?.className || '') === selectedCbtClassKey,
    )
    setScoresRows(filtered)
    setScoresModal({
      title: exam.title || 'Assessment',
      totalQuestions: Number(exam.totalQuestions ?? exam._count?.questions ?? 0) || 0,
      classLabel: selectedClassLabel,
    })
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
                {(() => {
                  const termlyMods = modulesForTrack.filter((m: any) => m.moduleType === 'TERM_EXAM').sort((a: any, b: any) => (a.termOrdinal || 0) - (b.termOrdinal || 0))
                  const completionMods = modulesForTrack.filter((m: any) => m.moduleType === 'TRACK_COMPLETION_EXAM')
                  const standardMods = modulesForTrack.filter((m: any) => m.moduleType === 'STANDARD' || !m.moduleType).sort((a: any, b: any) => (a.number || 0) - (b.number || 0))
                  return (
                    <>
                      {completionMods.length > 0 && (
                        <optgroup label="Track completion (certificate gate)">
                          {completionMods.map((m: any) => (
                            <option key={m.id} value={m.id}>{m.title}</option>
                          ))}
                        </optgroup>
                      )}
                      {termlyMods.length > 0 && (
                        <optgroup label="Termly assessments (optional)">
                          {termlyMods.map((m: any) => (
                            <option key={m.id} value={m.id}>{`Term ${m.termOrdinal}: ${m.title}`}</option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Standard modules">
                        {standardMods.map((m: any) => (
                          <option key={m.id} value={m.id}>{`Module ${m.number}: ${m.title}`}</option>
                        ))}
                      </optgroup>
                    </>
                  )
                })()}
              </select>
            </div>
            <div><label className="form-label">Duration (min)</label><input type="number" className="form-input" min={5} max={120} value={form.durationMins} onChange={e => setForm({ ...form, durationMins: +e.target.value })} /></div>
          </div>
          <div className="mt-14" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label className="form-label">AI difficulty</label>
              <select className="form-input" value={aiDifficulty} onChange={(e) => setAiDifficulty(e.target.value as any)} style={{ appearance: 'none' }}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="form-label">AI questions</label>
              <input className="form-input" type="number" min={1} max={60} value={aiCount} onChange={(e) => setAiCount(Number(e.target.value) || 10)} />
            </div>
            <div className="text-muted text-xs" style={{ lineHeight: 1.4 }}>
              Uses Google Gemini to draft questions from module objectives + published curriculum lessons.
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={runAi} disabled={aiGenerating || !form.moduleId}>
              {aiGenerating ? 'Generating…' : 'Generate with AI'}
            </button>
          </div>
          {isCombinedExamModule && normalMods.length > 0 && (
            <div className="mt-12" style={{ borderTop: '1px solid var(--border2)', paddingTop: 12 }}>
              <div className="text-muted text-xs mb-8">
                {isCompletionExamModule
                  ? 'Standard modules included in this track completion exam (AI scope + exam record).'
                  : 'Modules covered this term — used for AI question scope and saved on the exam record.'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8 }}>
                {normalMods.map((m: any) => (
                  <label key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', border: '1px solid var(--border2)', borderRadius: 8, background: 'var(--muted3)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={aiInclude[m.id] !== false}
                      onChange={() => setAiInclude((prev) => ({ ...prev, [m.id]: !(prev[m.id] !== false) }))}
                      style={{ accentColor: 'var(--teal)' }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--white)' }}>{`Mod ${m.number}: ${m.title}`}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
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
      <Modal
        open={!!scoresModal}
        onClose={() => {
          setScoresModal(null)
          setScoresRows([])
        }}
        title={
          scoresModal
            ? `${scoresModal.title} — ${scoresModal.classLabel}`
            : 'CBT scores'
        }
        panelMaxWidth={640}
      >
        <p className="text-muted text-sm" style={{ marginBottom: 12, lineHeight: 1.5 }}>
          Completed attempts for this class. Score is percentage correct; the same student may appear more than once after retakes.
        </p>
        {scoresRows.length === 0 ? (
          <p className="text-muted text-sm">No completed attempts for this assessment in this class yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Reg. no.</th>
                <th>Score</th>
                <th>Correct</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {scoresRows.map((row: any) => {
                const u = row.student?.user
                const name = [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || '—'
                const total = scoresModal?.totalQuestions ?? 0
                const correct = typeof row.totalCorrect === 'number' ? row.totalCorrect : null
                const pct = typeof row.score === 'number' ? Math.round(row.score) : null
                const sub = row.submittedAt ? new Date(row.submittedAt).toLocaleString() : '—'
                return (
                  <tr key={row.id}>
                    <td><strong style={{ color: 'var(--white)' }}>{name}</strong></td>
                    <td className="text-muted text-sm">{row.student?.regNumber || '—'}</td>
                    <td>{pct !== null ? `${pct}%` : '—'}</td>
                    <td className="text-muted text-sm">{correct !== null && total > 0 ? `${correct} / ${total}` : correct !== null ? String(correct) : '—'}</td>
                    <td className="text-muted text-sm" style={{ whiteSpace: 'nowrap' }}>{sub}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Modal>
      <div className="card mb-20">
        <div className="flex-between mb-4">
          <div>
            <div className="font-display fw-700 text-white mb-4" style={{ fontSize: 18 }}>CBT Assessment Builder</div>
            <div className="text-muted text-sm">Create, manage & submit assessments for student testing</div>
          </div>
          <button type="button" onClick={() => { setView('create'); setSaved('') }} className="btn btn-primary btn-sm">+ New Assessment</button>
        </div>
      </div>
      {saved && (
        <div style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#4ADE80' }}>
          ✓ Assessment submitted for vetting by Super Admin
        </div>
      )}
      <div className="card mb-20">
        <div className="font-display fw-600 text-white mb-4" style={{ fontSize: 16 }}>Your classes</div>
        <p className="text-muted text-sm mb-14" style={{ lineHeight: 1.5 }}>
          Select a class to see your assessments and how many students in that class have completed each one. Use View more for the full score list.
        </p>
        {cbtPageClassCards.length === 0 ? (
          <p className="text-muted text-sm">No class assignments yet. Once you are assigned to classes, they appear here.</p>
        ) : (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 12,
              }}
            >
              {cbtPageClassCards.map((card) => {
                const n = attemptsCountByClass[card.key] ?? 0
                const selected = selectedCbtClassKey === card.key
                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => setSelectedCbtClassKey(card.key)}
                    className="card"
                    style={{
                      textAlign: 'left',
                      cursor: 'pointer',
                      padding: '14px 16px',
                      border: selected ? '2px solid var(--teal2)' : '1px solid var(--border2)',
                      borderRadius: 12,
                      background: selected ? 'rgba(26,127,212,0.12)' : 'var(--muted3)',
                    }}
                  >
                    <div className="font-display fw-700 text-white" style={{ fontSize: 16, marginBottom: 6 }}>
                      {card.className}
                    </div>
                    <div className="text-muted text-xs" style={{ marginBottom: 8, lineHeight: 1.35 }}>
                      {card.schoolName}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                      <span className="badge badge-info" style={{ fontSize: 10 }}>
                        {card.track === '—' ? '—' : card.track.replace(/^TRACK_/i, 'Track ')}
                      </span>
                      <span className="text-muted text-xs">
                        {attemptsLoading ? '…' : `${n} completed ${n === 1 ? 'attempt' : 'attempts'} (all assessments)`}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
            {attemptsLoading && cbtPageClassCards.length > 0 && (
              <p className="text-muted text-xs mt-12">Loading result counts…</p>
            )}
          </>
        )}
      </div>
      {!selectedCbtClassKey ? (
        <div className="card text-muted text-sm" style={{ lineHeight: 1.55 }}>
          Choose a class card above. A table of your assessments for that class will appear here.
        </div>
      ) : loading ? (
        <p className="text-muted text-sm" style={{ padding: 20 }}>Loading assessments…</p>
      ) : (
        <div className="card">
          <div className="flex-between mb-16" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div className="font-display fw-600 text-white" style={{ fontSize: 16 }}>Assessments for this class</div>
              <div className="text-muted text-sm mt-4">{selectedClassLabel}</div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedCbtClassKey(null)}>
              Clear selection
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Track</th>
                <th>Questions</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Completed (class)</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {exams.map((e: any) => {
                const si = statusInfo(e)
                const done = completedInSelectedClass(e.id)
                return (
                  <tr key={e.id}>
                    <td><strong style={{ color: 'var(--white)' }}>{e.title}</strong></td>
                    <td><span className="badge badge-info">{e.track?.replace('TRACK_', 'Track ')}</span></td>
                    <td>{e.totalQuestions || e._count?.questions || 0}</td>
                    <td>{e.durationMins} min</td>
                    <td>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 10px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 600,
                          background: si.bg,
                          color: si.color,
                          border: `1px solid ${si.border}`,
                        }}
                      >
                        {si.label}
                      </span>
                    </td>
                    <td className="text-muted text-sm">{attemptsLoading ? '…' : done}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11 }}
                        disabled={attemptsLoading || done === 0}
                        onClick={() => openScoresDetailModal(e)}
                      >
                        View more
                      </button>
                    </td>
                  </tr>
                )
              })}
              {exams.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>
                    No assessments yet. Create your first one above.
                  </td>
                </tr>
              )}
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

  useEffect(() => {
    reportsApi
      .mine()
      .then((d) => setPast(Array.isArray(d) ? d : []))
      .catch((e) => {
        notify.fromError(e, 'Could not load reports')
        setPast([])
      })
  }, [])

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
  const [lessonPick, setLessonPick] = useState<Record<string, string>>({})
  const [lessonsByModule, setLessonsByModule] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [checkInSchool, setCheckInSchool] = useState('')
  const [checkInBusy, setCheckInBusy] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<any>(null)

  const schoolOptions = useMemo(() => {
    const seen = new Set<string>()
    const opts: { schoolId: string; label: string }[] = []
    for (const c of Array.isArray(classes) ? classes : []) {
      const schoolId = String(c.schoolId || c.school?.id || '').trim()
      if (!schoolId || seen.has(schoolId)) continue
      seen.add(schoolId)
      opts.push({ schoolId, label: String(c.school?.name || c.schoolName || 'School').trim() })
    }
    return opts
  }, [classes])

  useEffect(() => {
    modulesApi
      .all()
      .then((d) => setModules(Array.isArray(d) ? d : []))
      .catch((e) => {
        notify.fromError(e, 'Could not load modules')
        setModules([])
      })
  }, [])

  const loadedLessonModules = useRef<Set<string>>(new Set())
  useEffect(() => {
    const mids = Array.from(new Set(Object.values(modulePick).filter(Boolean))) as string[]
    for (const mid of mids) {
      if (loadedLessonModules.current.has(mid)) continue
      loadedLessonModules.current.add(mid)
      curriculumApi
        .lessonsByModule(mid, false)
        .then((list) => {
          setLessonsByModule((prev) => ({ ...prev, [mid]: Array.isArray(list) ? list : [] }))
        })
        .catch(() => {
          setLessonsByModule((prev) => ({ ...prev, [mid]: [] }))
        })
    }
  }, [modulePick])

  useEffect(() => {
    Promise.all([sessionsApi.active(), sessionsApi.myHistory()])
      .then(([a, h]) => { setActive(a?.id ? a : null); setHistory(Array.isArray(h) ? h : []) })
      .catch((e) => {
        notify.fromError(e, 'Could not load session history')
        setActive(null)
        setHistory([])
      })
      .finally(() => setLoading(false))
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
    const lessons = moduleId ? lessonsByModule[moduleId] : undefined
    const hasPublished = lessons && lessons.length > 0
    const lessonId = lessonPick[tutorAssignmentId]?.trim() || undefined
    if (hasPublished && !lessonId) {
      notify.warning('This module has published curriculum lessons — select which lesson you are delivering.')
      return
    }
    setStarting(true)
    try {
      const s = await sessionsApi.start({
        className,
        schoolId,
        track,
        tutorAssignmentId,
        moduleId,
        lessonId,
      })
      setActive(s)
    } catch (e: any) { notify.fromError(e) }
    setStarting(false)
  }

  const endSession = async (notes?: string) => {
    if (!active) return
    try {
      const raw = window.prompt('How many students were present in this session?', '')
      const n = raw == null ? null : Number(raw)
      if (n == null) return
      if (!Number.isFinite(n) || n < 0) {
        notify.warning('Enter a valid number of students present')
        return
      }
      await sessionsApi.end(active.id, Math.floor(n), notes)
      setActive(null)
      const h = await sessionsApi.myHistory().catch(() => [])
      setHistory(Array.isArray(h) ? h : [])
    } catch (e: any) { notify.fromError(e) }
  }

  const checkInToday = async () => {
    const schoolId = checkInSchool || schoolOptions[0]?.schoolId
    if (!schoolId) {
      notify.warning('No school assignment found')
      return
    }
    setCheckInBusy(true)
    try {
      await tutorAttendanceApi.checkIn(schoolId)
      notify.success('Checked in for today')
    } catch (e: any) {
      notify.fromError(e, 'Check-in failed')
    }
    setCheckInBusy(false)
  }

  return (
    <div>
      <div className="flex-between mb-20"><div><h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Session Log</h3><div className="text-muted text-sm">Start a session for each class — tied to your school assignment. When a module has <strong>published curriculum lessons</strong>, you must pick the lesson you are delivering. Sessions anchor delivery and advance the class together.</div></div></div>
      {schoolOptions.length > 0 && (
        <div className="card mb-20" style={{ maxWidth: 520 }}>
          <div className="font-display fw-600 text-white mb-8" style={{ fontSize: 14 }}>Daily check-in</div>
          <p className="text-muted text-xs mb-12">Mark yourself present at a school before teaching (optional — admins can see this under Tutor delivery).</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
            {schoolOptions.length > 1 && (
              <div style={{ flex: 1, minWidth: 180 }}>
                <label className="form-label">School</label>
                <select className="form-input" value={checkInSchool || schoolOptions[0]?.schoolId || ''} onChange={(e) => setCheckInSchool(e.target.value)} style={{ appearance: 'none' }}>
                  {schoolOptions.map((o) => <option key={o.schoolId} value={o.schoolId}>{o.label}</option>)}
                </select>
              </div>
            )}
            <button type="button" className="btn btn-ghost btn-sm" disabled={checkInBusy} onClick={checkInToday}>
              {checkInBusy ? 'Checking in…' : 'Check in today →'}
            </button>
          </div>
        </div>
      )}
      {active ? (
        <div style={{ background: 'linear-gradient(135deg,rgba(34,197,94,0.12),rgba(26,127,212,0.08))', border: '1px solid rgba(34,197,94,0.35)', borderRadius: 'var(--radius-lg)', padding: 28, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--success)', animation: 'timerPulse 1s ease-in-out infinite', flexShrink: 0 }}></div>
            <div style={{ flex: 1 }}>
              <div className="font-display fw-700 text-white" style={{ fontSize: 18 }}>Session in progress — {active.className}</div>
              {active.module?.title && (
                <div className="text-muted text-sm mt-6">Module: <span style={{ color: 'var(--white)' }}>Mod {active.module.number}: {active.module.title}</span></div>
              )}
              {active.lesson?.title && (
                <div className="text-muted text-sm mt-6">Curriculum lesson: <span style={{ color: 'var(--white)' }}>{active.lesson.title}</span></div>
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
                    onChange={(e) => {
                      const v = e.target.value
                      setModulePick((prev) => ({ ...prev, [c.id]: v }))
                      setLessonPick((prev) => ({ ...prev, [c.id]: '' }))
                    }}
                  >
                    <option value="">— Not specified —</option>
                    {modulesForTrack(c.track).map((m: any) => (
                      <option key={m.id} value={m.id}>
                        Mod {m.number}: {m.title}
                      </option>
                    ))}
                  </select>
                </div>
                {(() => {
                  const mid = modulePick[c.id]?.trim()
                  const list = mid ? lessonsByModule[mid] : undefined
                  if (!mid || !list || list.length === 0) return null
                  return (
                    <div>
                      <label className="form-label" style={{ fontSize: 11 }}>Curriculum lesson (required)</label>
                      <select
                        className="form-input"
                        style={{ fontSize: 13 }}
                        value={lessonPick[c.id] || ''}
                        onChange={(e) => setLessonPick((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      >
                        <option value="">— Select lesson —</option>
                        {list.map((L: any) => (
                          <option key={L.id} value={L.id}>
                            {L.position}. {L.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                })()}
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
            <thead><tr><th>Class</th><th>School</th><th>Module</th><th>Lesson</th><th>Started</th><th>Duration</th><th>Attendance</th></tr></thead>
            <tbody>
              {history.map((s: any, i: number) => (
                <tr key={s.id || i}>
                  <td style={{ fontWeight: 600, color: 'var(--white)' }}>{s.className}</td>
                  <td style={{ fontSize: 12 }}>{s.school?.name}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{s.module ? `Mod ${s.module.number}: ${s.module.title}` : '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{s.lesson?.title || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(s.startedAt).toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' })} {new Date(s.startedAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{s.durationMins ? `${s.durationMins} min` : '—'}</td>
                  <td><span className={`badge badge-${s.attendanceMarked ? 'success' : 'warning'}`}>{s.attendanceMarked ? 'Marked' : 'Pending'}</span></td>
                </tr>
              ))}
              {history.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>No sessions logged yet</td></tr>}
            </tbody>
          </table>
        )}
      </div>
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
    /** When true, students see “submitted” but not score until tutor clicks Release. */
    awaitTutorResultRelease: false,
  })
  const [releasingId, setReleasingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [editForm, setEditForm] = useState<{ scheduledAt: string; venue: string; durationMins: number }>({
    scheduledAt: '',
    venue: 'Computer Lab B',
    durationMins: 60,
  })
  const [editBusy, setEditBusy] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState<any | null>(null)
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
      setForm(f => ({ ...f, cbtExamId: '', classNames: [], scheduledAt: '', awaitTutorResultRelease: false }))
    } catch (e: any) { notify.fromError(e) }
    setSaving(false)
  }

  const openEdit = (row: any) => {
    const dt = row?.scheduledAt ? new Date(row.scheduledAt) : null
    const pad = (n: number) => String(n).padStart(2, '0')
    const local =
      dt && Number.isFinite(dt.getTime())
        ? `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
        : ''
    setEditing(row)
    setEditForm({
      scheduledAt: local,
      venue: String(row?.venue || ''),
      durationMins: Number(row?.durationMins || 60),
    })
  }

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing?.id) return
    setEditBusy(true)
    try {
      const updated = await examSchedulesApi.update(editing.id, {
        scheduledAt: editForm.scheduledAt,
        venue: editForm.venue,
        durationMins: Number(editForm.durationMins) || 30,
      })
      setSchedules((prev) => prev.map((x) => (x.id === editing.id ? { ...x, ...updated } : x)))
      notify.success('Schedule updated')
      setEditing(null)
    } catch (err: any) {
      notify.fromError(err, 'Could not update schedule')
    }
    setEditBusy(false)
  }

  const releaseScheduleResults = async (id: string) => {
    setReleasingId(id)
    try {
      const updated = await examSchedulesApi.releaseResults(id)
      setSchedules((prev) => prev.map((x) => (x.id === id ? { ...x, ...updated } : x)))
      notify.success('Students can now view their scores for this schedule.')
    } catch (err: any) {
      notify.fromError(err, 'Could not release results')
    }
    setReleasingId(null)
  }

  const cancelSchedule = async (id: string) => {
    setEditBusy(true)
    try {
      await examSchedulesApi.cancel(id)
      setSchedules((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'CANCELLED' } : x)))
      notify.success('Schedule cancelled')
    } catch (err: any) {
      notify.fromError(err, 'Could not cancel schedule')
    }
    setEditBusy(false)
  }

  return (
    <div>
      <Modal open={!!editing} onClose={() => (editBusy ? null : setEditing(null))} title="Edit exam schedule">
        <form onSubmit={saveEdit} style={{ display: 'grid', gap: 12 }}>
          <div>
            <label className="form-label">Date & Time</label>
            <input
              type="datetime-local"
              className="form-input"
              required
              value={editForm.scheduledAt}
              onChange={(e) => setEditForm((f) => ({ ...f, scheduledAt: e.target.value }))}
              disabled={editBusy}
            />
          </div>
          <div>
            <label className="form-label">Venue</label>
            <input
              className="form-input"
              value={editForm.venue}
              onChange={(e) => setEditForm((f) => ({ ...f, venue: e.target.value }))}
              disabled={editBusy}
            />
          </div>
          <div>
            <label className="form-label">Duration (min)</label>
            <input
              type="number"
              className="form-input"
              value={editForm.durationMins}
              onChange={(e) => setEditForm((f) => ({ ...f, durationMins: Number(e.target.value) }))}
              disabled={editBusy}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)} disabled={editBusy}>
              Close
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={editBusy} style={{ minWidth: 140, justifyContent: 'center' }}>
              {editBusy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!confirmCancel}
        title="Cancel schedule?"
        message="This will cancel the exam schedule for the selected class. Students will no longer be able to enter from the schedule."
        confirmText="Cancel schedule"
        cancelText="Keep"
        danger
        busy={editBusy}
        onClose={() => setConfirmCancel(null)}
        onConfirm={() => {
          const id = confirmCancel?.id
          setConfirmCancel(null)
          if (id) void cancelSchedule(id)
        }}
      />

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
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.awaitTutorResultRelease}
                onChange={(e) => setForm({ ...form, awaitTutorResultRelease: e.target.checked })}
                style={{ marginTop: 3, accentColor: 'var(--teal)' }}
              />
              <span className="text-muted text-sm" style={{ lineHeight: 1.45 }}>
                Hold results until I release them (students see “submitted” only — for official exams). Leave off for immediate scores.
              </span>
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={saving}
            >
              {saving ? 'Scheduling…' : 'Schedule Exam →'}
            </button>
          </div>
        </form>
        {exams.filter((e: any) => e.isVetted || e.isPublished).length === 0 && <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, fontSize: 13, color: '#FCD34D' }}>⚠️ You need at least one approved CBT exam before scheduling. Create one in CBT Builder.</div>}
      </div>
      {loading ? <p className="text-muted text-sm" style={{ padding: 20 }}>Loading…</p> : (
        <div className="card">
          <div className="font-display fw-600 text-white mb-16">Scheduled Exams</div>
          <table className="data-table">
            <thead><tr><th>Exam</th><th>Class</th><th>Date & Time</th><th>Venue</th><th>Status</th><th>Scores</th><th>Action</th></tr></thead>
            <tbody>
              {schedules.map((s: any) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600, color: 'var(--white)', fontSize: 13 }}>{s.cbtExam?.title}</td>
                  <td>{s.className}</td>
                  <td style={{ fontSize: 12 }}>{new Date(s.scheduledAt).toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' })} {new Date(s.scheduledAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{s.venue}</td>
                  <td>
                    {(() => {
                      if (s.status === 'CANCELLED') return <span className="badge badge-danger">CANCELLED</span>
                      const sched = new Date(s.scheduledAt).getTime()
                      const duration = Number(s.durationMins || s.cbtExam?.durationMins || 30)
                      const openAt = sched
                      const closeAt = sched + duration * 60 * 1000 + 15 * 60 * 1000
                      const now = Date.now()
                      if (now < openAt) return <span className="badge badge-info">SCHEDULED</span>
                      if (now > closeAt) return <span className="badge badge-warning">CLOSED</span>
                      return <span className="badge badge-success">OPEN</span>
                    })()}
                  </td>
                  <td style={{ fontSize: 11, maxWidth: 140 }}>
                    {!s.awaitTutorResultRelease ? (
                      <span className="text-muted">Immediate</span>
                    ) : s.resultsReleasedAt ? (
                      <span className="badge badge-success">Released</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                        <span className="badge badge-warning">Held</span>
                        {s.status !== 'CANCELLED' && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: 10, padding: '4px 8px' }}
                            disabled={!!releasingId}
                            onClick={() => void releaseScheduleResults(s.id)}
                          >
                            {releasingId === s.id ? '…' : 'Release'}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => openEdit(s)} disabled={editBusy}>
                        Edit
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--danger)' }} onClick={() => setConfirmCancel(s)} disabled={editBusy || s.status === 'CANCELLED'}>
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {schedules.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>No exams scheduled yet</td></tr>}
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
  const [selectedClassKey, setSelectedClassKey] = useState<string | null>(null)
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
        const [s, merged] = await Promise.all([tutorsApi.myStats(), fetchMergedTutorClasses()])
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
    'tutor-cbt': 'CBT Builder', 'tutor-report': 'Weekly Report', 'tutor-settings': 'My profile', 'tutor-sessions': 'Session Log', 'tutor-exam-schedule': 'Schedule Exams',
    'class-insights': 'Class performance',
    'tutor-leaderboard': 'Leaderboard',
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

  const tutorNavLabel = useMemo(() => {
    const u = tutor?.user
    if (!u) return undefined
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
    return name || undefined
  }, [tutor?.user])

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
            selectedClassKey={selectedClassKey}
            onBackToClasses={() => setSection('tutor-classes')}
            onClearClass={() => setSelectedClassKey(null)}
          />
        )
      case 'tutor-classes':
        return (
          <TutorClasses
            classes={classes}
            onClassesChange={setClasses}
            onOpenClass={(assignmentKey) => {
              setSelectedClassKey(assignmentKey)
              setSection('tutor-students')
            }}
          />
        )
      case 'tutor-attendance': return <TutorAttendance classes={classes} tutorId={tutorId} />
      case 'tutor-results':
        return (
          <TutorResults
            classes={classes}
            onRefreshClasses={async () => {
              const merged = await fetchMergedTutorClasses()
              setClasses(merged)
            }}
          />
        )
      case 'tutor-assignments': return <TutorAssignments classes={classes} onSection={setSection} />
      case 'tutor-practicals': return <TutorPracticals classes={classes} onSection={setSection} />
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
      case 'tutor-exam-schedule': return <TutorExamScheduler classes={classes} />
      case 'tutor-leaderboard': {
        const leaderboardClass = selectedClassKey
          ? classes.find((c: any) => tutorAssignmentKey(c) === selectedClassKey)
          : null
        return (
          <LeaderboardPage
            role="tutor"
            classLabel={leaderboardClass ? tutorAssignmentLabel(leaderboardClass) : undefined}
          />
        )
      }
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
      section={section} onSectionChange={setSection} navBadges={navBadges}
      topbarAvatarUrl={tutor?.passportPhotoUrl || tutor?.user?.avatarUrl || undefined}
      navUserLabel={tutorNavLabel}
      navUserRole="AdharaEdu Tutor">
      {render()}
    </DashboardShell>
  )
}
