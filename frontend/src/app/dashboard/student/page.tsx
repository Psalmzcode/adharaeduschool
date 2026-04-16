'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { DashboardShell } from '@/components/DashboardShell'
import { studentsApi, modulesApi, attendanceApi, notifApi, messagesApi, certificatesApi, assignmentsApi, examSchedulesApi, noticesApi, practicalsApi, lessonsApi, uploadsApi, authApi } from '@/lib/api'
import { notify } from '@/lib/notify'
import { formatTrack } from '@/lib/schoolProfileLabels'

/* ── helpers ── */
function initials(name: string) { return name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() }
const COLORS = ['rgba(212,168,83,0.2)', 'rgba(26,127,212,0.2)', 'rgba(139,92,246,0.2)', 'rgba(34,197,94,0.2)', 'rgba(239,68,68,0.2)', 'rgba(245,158,11,0.2)']
const TCOLORS = ['var(--gold)', 'var(--teal2)', '#A78BFA', '#4ADE80', '#F87171', '#FCD34D']
function sc(i: number) { return { c: COLORS[i % COLORS.length], tc: TCOLORS[i % TCOLORS.length] } }

/**
 * Loads server data without substituting `def` into `data` while loading.
 * Using `data ?? def` in the UI was showing fake empty lists / zeros before the API responded.
 */
function useLoad<T>(queryKey: unknown[], fn: () => Promise<T>, def: T, enabled = true) {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery<T>({
    queryKey,
    queryFn: fn,
    enabled,
    staleTime: 30_000,
    retry: 1,
  })

  const setData = (updater: T | ((prev: T) => T)) => {
    queryClient.setQueryData(queryKey, (prev: T | undefined) => {
      const base = prev ?? def
      return typeof updater === 'function' ? (updater as (p: T) => T)(base) : updater
    })
  }

  return { data, loading: enabled && isLoading, setData }
}

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: '90vh',
          background: 'var(--navy2)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--white)' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 16, overflow: 'auto' }}>{children}</div>
      </div>
    </div>
  )
}

/* ── DASHBOARD HOME ── */
function StudentHome({ student, stats, progress, onSection }: any) {
  const completed = progress.filter((p: any) => p.status === 'COMPLETED')
  const inProgress = progress.find((p: any) => p.status === 'IN_PROGRESS')
  const pct = progress.length ? Math.round((completed.length / progress.length) * 100) : 0
  return (<>
    <div style={{ background: 'linear-gradient(135deg,rgba(212,168,83,0.12),rgba(26,127,212,0.08))', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '28px 32px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 24 }}>
      <div style={{ fontSize: 48 }}>👋</div>
      <div style={{ flex: 1 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 4, color: 'var(--white)' }}>Good morning, {student?.user?.firstName || 'Student'}!</h3>
        <p style={{ fontSize: 14, marginBottom: 12, color: 'var(--muted)' }}>{inProgress ? `Currently on: ${inProgress.module?.title}. Keep going!` : completed.length === progress.length && progress.length > 0 ? 'All modules complete! 🎉' : 'Your modules will appear once your tutor activates them.'}</p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => onSection('student-modules')} className="btn btn-primary btn-sm">Continue Learning →</button>
          <button onClick={() => onSection('student-exams')} className="btn btn-ghost btn-sm">My Exams</button>
        </div>
      </div>
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <svg width="90" height="90" viewBox="0 0 90 90" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="45" cy="45" r="38" fill="none" stroke="rgba(248,245,239,0.08)" strokeWidth="6" />
          <circle cx="45" cy="45" r="38" fill="none" stroke="url(#pgr)" strokeWidth="6" strokeLinecap="round" strokeDasharray="238.8" strokeDashoffset={238.8 * (1 - pct / 100)} />
          <defs><linearGradient id="pgr" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#D4A853" /><stop offset="100%" stopColor="#4DA6E8" /></linearGradient></defs>
        </svg>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--white)', marginTop: -54 }}>{pct}%</div>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 34 }}>Progress</div>
      </div>
    </div>
    <div className="stats-row" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
      {[
        { glow: 'var(--gold)', icon: '📚', bg: 'rgba(212,168,83,0.15)', val: `${completed.length}/${progress.length}`, label: 'Modules Done', trend: `${progress.length - completed.length} remaining` },
        { glow: 'var(--teal)', icon: '📊', bg: 'rgba(26,127,212,0.15)', val: stats?.averageScore ? `${stats.averageScore}%` : '—', label: 'Avg Score', trend: '↑ Performing well', up: !!stats?.averageScore },
        { glow: 'var(--success)', icon: '✅', bg: 'rgba(34,197,94,0.15)', val: stats?.attendanceRate ? `${stats.attendanceRate}%` : '—', label: 'Attendance', trend: `${stats?.examsTaken || 0} exams done` },
        { glow: '#A78BFA', icon: '🏆', bg: 'rgba(139,92,246,0.15)', val: stats?.averageScore >= 80 ? 'Top 10%' : 'Active', label: 'Standing', trend: student?.className || '—' },
      ].map(s => (
        <div key={s.label} className="stat-card"><div className="stat-glow" style={{ background: s.glow }}></div><div className="stat-card-icon" style={{ background: s.bg }}>{s.icon}</div><div className="stat-card-value">{s.val}</div><div className="stat-card-label">{s.label}</div><span className={`stat-card-trend${s.up ? ' trend-up' : ''}`}>{s.trend}</span></div>
      ))}
    </div>
    <div className="content-grid">
      <div className="card">
        <div className="flex-between mb-20"><div><div className="font-display fw-700 text-white" style={{ fontSize: 16 }}>Module Progress</div><div className="text-muted text-sm mt-4">{student?.track?.replace('TRACK_', 'Track ')}</div></div><button onClick={() => onSection('student-modules')} className="btn btn-ghost btn-sm">View All</button></div>
        <div className="student-progress-grid">
          {progress.slice(0, 6).map((p: any) => (
            <div key={p.id} className="module-progress-card" style={{ borderColor: p.status === 'COMPLETED' ? 'rgba(34,197,94,0.3)' : p.status === 'IN_PROGRESS' ? 'rgba(212,168,83,0.4)' : 'var(--border2)', background: p.status === 'IN_PROGRESS' ? 'rgba(212,168,83,0.05)' : '' }}>
              <div className="flex-between mb-8"><h4 style={{ fontSize: 13 }}>M{p.module?.number}: {p.module?.title}</h4><span className={`badge badge-${p.status === 'COMPLETED' ? 'success' : 'warning'}`}>{p.status === 'COMPLETED' ? '✓' : p.status === 'IN_PROGRESS' ? 'Active' : '🔒'}</span></div>
              <div className="progress-bar-label"><span style={{ fontSize: 11 }}>Score</span><strong style={{ fontSize: 12, color: p.score ? (p.score >= 70 ? 'var(--success)' : 'var(--warning)') : 'var(--muted)' }}>{p.score ? `${p.score}%` : '—'}</strong></div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: p.status === 'COMPLETED' ? '100%' : p.status === 'IN_PROGRESS' ? '40%' : '0%' }}></div></div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[{ icon: '💬', label: 'Messages', section: 'student-asktutor', color: 'var(--gold)' }, { icon: '🖥️', label: 'My Exams', section: 'student-exams', color: 'var(--teal2)' }, { icon: '📝', label: 'Assignments', section: 'student-assignments', color: '#A78BFA' }, { icon: '🧪', label: 'Practicals', section: 'student-practicals', color: '#4ADE80' }, { icon: '🎓', label: 'My Certificates', section: 'student-certificates', color: 'var(--success)' }, { icon: '🔔', label: 'Notifications', section: 'student-notifications', color: 'var(--warning)' }].map(a => (
          <button key={a.label} onClick={() => onSection(a.section)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'var(--muted3)', border: '1px solid var(--border2)', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', color: 'var(--white)', textAlign: 'left', fontSize: 14 }} onMouseEnter={e => (e.currentTarget.style.borderColor = a.color)} onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border2)')}>
            <span style={{ fontSize: 18 }}>{a.icon}</span>{a.label}<span style={{ marginLeft: 'auto', color: 'var(--muted)' }}>→</span>
          </button>
        ))}
      </div>
    </div>
  </>)
}

/* ── MODULES ── */
function StudentModules({ progress, student }: { progress: any[]; student: any }) {
  const { data: lessonPlans, loading: lessonPlansLoading } = useLoad(
    ['student', 'lesson-materials', student?.id],
    () => lessonsApi.forStudentClass(),
    [],
    !!student?.id
  )
  const plansArr = Array.isArray(lessonPlans) ? lessonPlans : []
  const [materialsByPlanId, setMaterialsByPlanId] = useState<Record<string, any[]>>({})

  useEffect(() => {
    let cancelled = false
    const loadMaterials = async () => {
      const next: Record<string, any[]> = {}
      await Promise.all(
        plansArr.map(async (plan: any) => {
          if (!plan?.id) return
          const files = await uploadsApi.byEntity('lesson-plan', plan.id).catch(() => [])
          next[plan.id] = Array.isArray(files) ? files : []
        })
      )
      if (!cancelled) setMaterialsByPlanId(next)
    }
    if (plansArr.length) loadMaterials()
    else setMaterialsByPlanId({})
    return () => {
      cancelled = true
    }
  }, [plansArr.map((p: any) => p.id).join('|')])

  return (
    <div>
      <h3 className="font-display fw-700 text-white mb-20" style={{ fontSize: 20 }}>My Modules</h3>
      {lessonPlansLoading && <p className="text-muted text-sm mb-12">Loading lesson materials…</p>}
      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {progress.map((p: any) => (
            <div key={p.id} className="module-progress-card" style={{ borderColor: p.status === 'COMPLETED' ? 'rgba(34,197,94,0.3)' : p.status === 'IN_PROGRESS' ? 'rgba(212,168,83,0.4)' : 'var(--border2)' }}>
              <div className="flex-between mb-8"><h4>Module {p.module?.number}: {p.module?.title}</h4><span className={`badge badge-${p.status === 'COMPLETED' ? 'success' : p.status === 'IN_PROGRESS' ? 'warning' : 'warning'}`}>{p.status === 'COMPLETED' ? '✓ Done' : p.status === 'IN_PROGRESS' ? 'In Progress' : '🔒 Locked'}</span></div>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>{p.module?.description}</p>
              <div className="progress-bar-label"><span>Score</span><strong style={{ color: p.score ? (p.score >= 70 ? 'var(--success)' : 'var(--warning)') : 'var(--muted)' }}>{p.score ? `${p.score}%` : '—'}</strong></div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: p.status === 'COMPLETED' ? '100%' : p.status === 'IN_PROGRESS' ? '40%' : '0%' }}></div></div>
              {(() => {
                const relatedPlans = plansArr.filter((plan: any) => plan?.moduleId === p.module?.id)
                const files = relatedPlans.flatMap((plan: any) => materialsByPlanId[plan.id] || [])
                if (!files.length) return null
                return (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--border2)' }}>
                    <div className="text-xs text-muted mb-8">Lesson Materials</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {files.slice(0, 4).map((f: any, i: number) => (
                        <a key={`${f.id || f.fileUrl || i}-${i}`} href={f.fileUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }}>
                          ⬇ {f.fileName || `Material ${i + 1}`}
                        </a>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          ))}
          {progress.length === 0 && <p className="text-muted text-sm" style={{ gridColumn: 'span 2', padding: '40px 0', textAlign: 'center' }}>No modules yet — your tutor will activate them.</p>}
        </div>
      </div>
    </div>
  )
}

/* ── ASSIGNMENTS ── */
function StudentAssignments({ student }: { student: any }) {
  const { data: assignments, loading, setData } = useLoad(['student', 'assignments', student?.id], () => assignmentsApi.mine(), [], !!student?.id)
  const arr = Array.isArray(assignments) ? assignments : []
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [submissionFiles, setSubmissionFiles] = useState<Record<string, File | null>>({})
  const [assignmentFiles, setAssignmentFiles] = useState<Record<string, any[]>>({})

  useEffect(() => {
    let cancelled = false
    const loadFiles = async () => {
      const next: Record<string, any[]> = {}
      await Promise.all(
        arr.map(async (a: any) => {
          if (!a?.id) return
          const files = await uploadsApi.byEntity('assignment', a.id).catch(() => [])
          next[a.id] = Array.isArray(files) ? files : []
        })
      )
      if (!cancelled) setAssignmentFiles(next)
    }
    if (arr.length) loadFiles()
    else setAssignmentFiles({})
    return () => {
      cancelled = true
    }
  }, [arr.map((a: any) => a.id).join('|')])

  const submit = async (id: string) => {
    setSubmitting(id)
    try {
      let uploadedUrl: string | undefined
      const file = submissionFiles[id]
      if (file) {
        const uploaded = await uploadsApi.assignment(file, id)
        uploadedUrl = uploaded?.fileUrl
      }
      await assignmentsApi.submit(id, { textBody: notes[id], fileUrl: uploadedUrl })
      setData((arr as any[]).map((a: any) => a.id === id ? { ...a, submission: { status: 'SUBMITTED', submittedAt: new Date() } } : a) as any)
      setSubmissionFiles((prev) => ({ ...prev, [id]: null }))
    } catch (e: any) { notify.fromError(e) }
    setSubmitting(null)
  }

  return (
    <div>
      <div className="flex-between mb-20"><div><h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Assignments</h3><div className="text-muted text-sm">{loading ? '…' : `${arr.filter((a: any) => !a.submission).length} pending`}</div></div></div>
      {loading && <p className="text-muted text-sm" style={{ padding: 20 }}>Loading…</p>}
      {!loading && arr.length === 0 && <div className="card" style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}><div style={{ fontSize: 48, marginBottom: 16 }}>📝</div><p>No assignments yet. Your tutor will post them here.</p></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {arr.map((a: any) => (
          <div key={a.id} style={{ border: `1px solid ${a.isOverdue ? 'rgba(239,68,68,0.3)' : a.submission ? 'rgba(34,197,94,0.2)' : 'rgba(212,168,83,0.3)'}`, borderRadius: 'var(--radius)', padding: 20, background: a.isOverdue ? 'rgba(239,68,68,0.04)' : a.submission ? 'rgba(34,197,94,0.03)' : 'rgba(212,168,83,0.04)' }}>
            <div className="flex-between mb-10">
              <div className="font-display fw-700 text-white" style={{ fontSize: 15 }}>{a.title}</div>
              <span className={`badge badge-${a.submission ? 'success' : a.isOverdue ? 'danger' : 'warning'}`}>{a.submission ? '✓ Submitted' : a.isOverdue ? 'Overdue' : `Due ${new Date(a.dueDate).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}`}</span>
            </div>
            <div className="text-sm text-muted mb-12">{a.description}</div>
            {Array.isArray(assignmentFiles[a.id]) && assignmentFiles[a.id].length > 0 && (
              <div style={{ marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {assignmentFiles[a.id].map((f: any, i: number) => (
                  <a key={`${f.id || f.fileUrl || i}-${i}`} href={f.fileUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                    ⬇ {f.fileName || `Attachment ${i + 1}`}
                  </a>
                ))}
              </div>
            )}
            {a.submission?.grade && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}><strong style={{ color: '#4ADE80' }}>Grade: {a.submission.grade}%</strong>{a.submission.feedback && <span style={{ color: 'var(--muted)', fontSize: 13, marginLeft: 12 }}>{a.submission.feedback}</span>}</div>}
            {!a.submission && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <input style={{ flex: 1, minWidth: 200, background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: 'var(--white)', fontSize: 13, outline: 'none' }} placeholder="Add a note (optional)…" value={notes[a.id] || ''} onChange={e => setNotes(n => ({ ...n, [a.id]: e.target.value }))} />
                <input type="file" onChange={e => setSubmissionFiles((prev) => ({ ...prev, [a.id]: e.target.files?.[0] || null }))} />
                <button onClick={() => submit(a.id)} className="btn btn-primary btn-sm" disabled={submitting === a.id}>{submitting === a.id ? 'Submitting…' : 'Submit →'}</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── PRACTICALS ── */
function StudentPracticals({ student }: { student: any }) {
  const { data: tasks, loading, setData } = useLoad(['student', 'practicals', student?.id], () => practicalsApi.myTasks(), [], !!student?.id)
  const arr = Array.isArray(tasks) ? tasks : []
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [evidenceUrl, setEvidenceUrl] = useState<Record<string, string>>({})
  const [evidenceText, setEvidenceText] = useState<Record<string, string>>({})
  const [evidenceFiles, setEvidenceFiles] = useState<Record<string, File | null>>({})

  const submit = async (taskId: string) => {
    setSubmitting(taskId)
    try {
      let uploadedUrl: string | undefined
      const file = evidenceFiles[taskId]
      if (file) {
        const uploaded = await uploadsApi.practical(file, taskId)
        uploadedUrl = uploaded?.fileUrl
      }
      await practicalsApi.submit(taskId, {
        evidenceUrl: uploadedUrl || evidenceUrl[taskId] || undefined,
        evidenceText: evidenceText[taskId] || undefined,
      })
      setEvidenceFiles((prev) => ({ ...prev, [taskId]: null }))
      const refreshed = await practicalsApi.myTasks().catch(() => null)
      if (Array.isArray(refreshed)) setData(refreshed as any)
    } catch (e: any) { notify.fromError(e) }
    setSubmitting(null)
  }

  return (
    <div>
      <div className="flex-between mb-20">
        <div>
          <h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Practical Assessments</h3>
          <div className="text-muted text-sm">{loading ? '…' : `${arr.filter((t: any) => !t.submission).length} pending practicals`}</div>
        </div>
      </div>
      {loading && <p className="text-muted text-sm" style={{ padding: 20 }}>Loading…</p>}
      {!loading && arr.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🧪</div>
          <p>No practical tasks yet. Your tutor will post them here.</p>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {arr.map((t: any) => (
          <div key={t.id} style={{ border: `1px solid ${t.submission ? 'rgba(34,197,94,0.2)' : t.status === 'OVERDUE' ? 'rgba(239,68,68,0.3)' : 'rgba(26,127,212,0.3)'}`, borderRadius: 'var(--radius)', padding: 20, background: t.submission ? 'rgba(34,197,94,0.03)' : t.status === 'OVERDUE' ? 'rgba(239,68,68,0.04)' : 'rgba(26,127,212,0.04)' }}>
            <div className="flex-between mb-10">
              <div>
                <div className="font-display fw-700 text-white" style={{ fontSize: 15 }}>{t.title}</div>
                <div className="text-muted text-xs">{t.module ? `Module ${t.module.number}: ${t.module.title}` : 'Module'} · {t.className}</div>
              </div>
              <span className={`badge badge-${t.submission ? 'success' : t.status === 'OVERDUE' ? 'danger' : 'info'}`}>
                {t.submission ? `✓ ${t.submission.status || 'Submitted'}` : t.status === 'OVERDUE' ? 'Overdue' : (t.dueDate ? `Due ${new Date(t.dueDate).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}` : 'Open')}
              </span>
            </div>
            {t.description && <div className="text-sm text-muted mb-10">{t.description}</div>}
            {t.instructions && <div className="text-sm mb-12" style={{ color: 'var(--white)' }}>{t.instructions}</div>}
            {t.submission?.totalScore != null && (
              <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                <strong style={{ color: '#4ADE80' }}>Score: {t.submission.totalScore}/{t.maxScore || 100}</strong>
                {t.submission.feedback && <span style={{ color: 'var(--muted)', fontSize: 13, marginLeft: 12 }}>{t.submission.feedback}</span>}
              </div>
            )}
            {!t.submission && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input className="form-input" placeholder="Evidence URL (optional)" value={evidenceUrl[t.id] || ''} onChange={e => setEvidenceUrl((x) => ({ ...x, [t.id]: e.target.value }))} />
                <input type="file" onChange={e => setEvidenceFiles((x) => ({ ...x, [t.id]: e.target.files?.[0] || null }))} />
                <textarea className="form-input" rows={3} placeholder="Evidence notes / what you built (optional)" value={evidenceText[t.id] || ''} onChange={e => setEvidenceText((x) => ({ ...x, [t.id]: e.target.value }))} style={{ resize: 'vertical' }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => submit(t.id)} className="btn btn-primary btn-sm" disabled={submitting === t.id}>{submitting === t.id ? 'Submitting…' : 'Submit Practical →'}</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── RESULTS ── */
function StudentResults({ progress, student }: { progress: any[]; student: any }) {
  const { data: assignments, loading: la } = useLoad(['student', 'results-assignments', student?.id], () => assignmentsApi.mine(), [], !!student?.id)
  const { data: practicals, loading: lp } = useLoad(['student', 'results-practicals', student?.id], () => practicalsApi.myTasks(), [], !!student?.id)
  const loadingResults = la || lp
  const scored = progress.filter(p => p.score)
  const avg = scored.length ? Math.round(scored.reduce((s: number, p: any) => s + p.score, 0) / scored.length) : 0
  const assignmentScores = (Array.isArray(assignments) ? assignments : [])
    .map((a: any) => a?.submission?.score ?? a?.submission?.grade)
    .filter((x: any) => typeof x === 'number')
  const practicalScores = (Array.isArray(practicals) ? practicals : [])
    .map((t: any) => t?.submission?.totalScore)
    .filter((x: any) => typeof x === 'number')
  const assignmentAvg = assignmentScores.length ? Math.round(assignmentScores.reduce((a: number, b: number) => a + b, 0) / assignmentScores.length) : null
  const practicalAvg = practicalScores.length ? Math.round(practicalScores.reduce((a: number, b: number) => a + b, 0) / practicalScores.length) : null
  const parts: Array<{ score: number; weight: number }> = []
  if (avg > 0) parts.push({ score: avg, weight: 40 })
  if (assignmentAvg != null) parts.push({ score: assignmentAvg, weight: 20 })
  if (practicalAvg != null) parts.push({ score: practicalAvg, weight: 40 })
  const totalWeight = parts.reduce((s, p) => s + p.weight, 0)
  const trackScore = totalWeight ? Math.round(parts.reduce((s, p) => s + (p.score * p.weight), 0) / totalWeight) : null
  const weightedParts = [
    { label: 'Theory', score: avg > 0 ? avg : null, weight: 40 },
    { label: 'Assignments', score: assignmentAvg, weight: 20 },
    { label: 'Practicals', score: practicalAvg, weight: 40 },
  ]
  return (
    <div>
      <h3 className="font-display fw-700 text-white mb-20" style={{ fontSize: 20 }}>My Results</h3>
      {loadingResults && <p className="text-muted text-sm mb-16" style={{ padding: 12 }}>Loading assignment & practical scores…</p>}
      <div className="card">
        <table className="data-table">
          <thead><tr><th>Module</th><th>Status</th><th>Score</th><th>Grade</th></tr></thead>
          <tbody>
            {progress.map((p: any) => {
              const g = (s: number) => s >= 90 ? 'A+' : s >= 80 ? 'A' : s >= 70 ? 'B+' : s >= 60 ? 'B' : s >= 50 ? 'C' : 'F'
              return (
                <tr key={p.id}>
                  <td>M{p.module?.number}: {p.module?.title}</td>
                  <td><span className={`badge badge-${p.status === 'COMPLETED' ? 'success' : 'warning'}`}>{p.status}</span></td>
                  <td><strong style={{ color: p.score ? (p.score >= 70 ? 'var(--success)' : 'var(--warning)') : 'var(--muted)' }}>{p.score ? `${p.score}%` : '—'}</strong></td>
                  <td>{p.score ? <span className={`badge badge-${p.score >= 70 ? 'success' : 'warning'}`}>{g(p.score)}</span> : '—'}</td>
                </tr>
              )
            })}
            {progress.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>No results yet</td></tr>}
          </tbody>
        </table>
        {avg > 0 && (
          <div style={{ marginTop: 16, padding: 16, background: 'var(--glass)', borderRadius: 'var(--radius-sm)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[['Average', `${avg}%`, 'var(--gold)'], ['Passed', `${scored.filter(p => p.score >= 50).length}/${scored.length}`, 'var(--teal2)'], ['Status', avg >= 50 ? 'On Track ✓' : 'Needs Work', avg >= 50 ? 'var(--success)' : 'var(--danger)']].map(([l, v, c]) => (
              <div key={l}><div className="text-xs text-muted mb-4">{l}</div><div className="font-display fw-700" style={{ fontSize: 20, color: c }}>{v}</div></div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 16, padding: 16, background: 'var(--muted3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', opacity: loadingResults ? 0.5 : 1 }}>
          <div className="font-display fw-600 text-white mb-12" style={{ fontSize: 14 }}>Track Score Breakdown</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 10 }}>
            {weightedParts.map((p) => (
              <div key={p.label} style={{ background: 'var(--glass)', border: '1px solid var(--border2)', borderRadius: 8, padding: '10px 12px' }}>
                <div className="text-xs text-muted mb-4">{p.label}</div>
                <div className="font-display fw-700 text-white">{loadingResults ? '…' : p.score != null ? `${p.score}%` : '—'}</div>
                <div className="text-xs text-muted mt-4">Weight: {p.weight}%</div>
              </div>
            ))}
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, padding: '10px 12px' }}>
              <div className="text-xs text-muted mb-4">Weighted Track Score</div>
              <div className="font-display fw-700" style={{ color: trackScore != null ? (trackScore >= 70 ? 'var(--success)' : 'var(--warning)') : 'var(--muted)' }}>
                {loadingResults ? '…' : trackScore != null ? `${trackScore}%` : '—'}
              </div>
              <div className="text-xs text-muted mt-4">Auto-normalized by available scores</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── ATTENDANCE ── */
function StudentAttendance({ student }: { student: any }) {
  const { data, loading } = useLoad(['student', 'attendance', student?.id], () => attendanceApi.myAttendance(student?.id), null, !!student?.id)
  useLoad(['student', 'attendance-weekly', student?.id], () => attendanceApi.weeklyBreakdown(student?.id, 5), [], !!student?.id)
  const sum = loading ? null : ((data as any)?.summary || {}) as { present?: number; absent?: number; late?: number; rate?: number }
  return (
    <div>
      <h3 className="font-display fw-700 text-white mb-20" style={{ fontSize: 20 }}>Attendance Record</h3>
      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 20 }}>
        {[{ glow: 'var(--success)', icon: '✅', bg: 'rgba(34,197,94,0.15)', val: loading ? '—' : sum?.present || 0, label: 'Present', trend: loading ? '…' : `${sum?.rate || 0}% rate`, up: true }, { glow: 'var(--danger)', icon: '❌', bg: 'rgba(239,68,68,0.15)', val: loading ? '—' : sum?.absent || 0, label: 'Absent', trend: '—' }, { glow: 'var(--warning)', icon: '⏰', bg: 'rgba(245,158,11,0.15)', val: loading ? '—' : sum?.late || 0, label: 'Late', trend: '—' }].map(s => (
          <div key={s.label} className="stat-card"><div className="stat-glow" style={{ background: s.glow }}></div><div className="stat-card-icon" style={{ background: s.bg }}>{s.icon}</div><div className="stat-card-value">{s.val}</div><div className="stat-card-label">{s.label}</div><span className={`stat-card-trend${s.up ? ' trend-up' : ''}`}>{s.trend}</span></div>
        ))}
      </div>
      <div className="card">
        <div className="font-display fw-600 text-white mb-16">Attendance Log</div>
        {loading && <p className="text-muted text-sm">Loading…</p>}
        <table className="data-table">
          <thead><tr><th>Date</th><th>Status</th><th>Note</th></tr></thead>
          <tbody>
            {((data as any)?.records || []).slice(0, 20).map((r: any, i: number) => (
              <tr key={i}><td>{new Date(r.date).toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' })}</td><td><span className={`badge badge-${r.status === 'PRESENT' ? 'success' : r.status === 'ABSENT' ? 'danger' : 'warning'}`}>{r.status}</span></td><td style={{ color: 'var(--muted)', fontSize: 12 }}>{r.notes || '—'}</td></tr>
            ))}
            {!((data as any)?.records?.length) && !loading && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>No attendance records yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── CERTIFICATES ── */
function StudentCertificates({ student, progress }: { student: any; progress: any[] }) {
  const { data: certs, loading } = useLoad(['student', 'certificates', student?.id], () => certificatesApi.mine(), [], !!student?.id)
  const arr = Array.isArray(certs) ? certs : []
  const completed = progress.filter(p => p.status === 'COMPLETED')
  const allDone = completed.length === progress.length && progress.length > 0
  const trackName = formatTrack(student?.track)

  return (
    <div>
      <h3 className="font-display fw-700 text-white mb-20" style={{ fontSize: 20 }}>My Certificates</h3>
      {loading && <p className="text-muted text-sm" style={{ padding: 20 }}>Loading…</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {arr.map((c: any) => {
          const pct = typeof c.averageScore === 'number' ? Math.round(c.averageScore) : c.averageScore
          return (
          <div key={c.id} style={{ padding: 24, background: 'linear-gradient(135deg,rgba(212,168,83,0.12),rgba(26,127,212,0.08))', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 24 }}>
            <span style={{ fontSize: 48 }}>🎓</span>
            <div style={{ flex: 1 }}>
              <div className="font-display fw-700 text-white mb-4" style={{ fontSize: 16 }}>{formatTrack(c.track)}</div>
              <div className="text-muted text-sm mb-4">Issued {new Date(c.issueDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })} · Average score: {pct}%</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>Serial: {c.serialNumber}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {c.pdfUrl ? (
                  <a className="btn btn-primary btn-sm" href={c.pdfUrl} target="_blank" rel="noreferrer">⬇ Download PDF</a>
                ) : (
                  <button type="button" className="btn btn-primary btn-sm" disabled title="PDF is generated when your school uploads certificates to cloud storage">
                    PDF pending
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/verify-certificate/${encodeURIComponent(c.serialNumber || '')}`
                    void navigator.clipboard?.writeText(url)
                    notify.success('Verify link copied')
                  }}
                  className="btn btn-ghost btn-sm"
                >
                  📋 Copy verify link
                </button>
              </div>
            </div>
            <span className={`badge ${c.isRevoked ? 'badge-danger' : 'badge-gold'}`}>{c.isRevoked ? 'Revoked' : 'Earned ✓'}</span>
          </div>
        )})}
        {!loading && arr.length === 0 && (
          <div style={{ padding: 24, background: 'var(--glass)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 24 }}>
            <span style={{ fontSize: 48 }}>🔒</span>
            <div style={{ flex: 1 }}>
              <div className="font-display fw-700 text-white mb-4" style={{ fontSize: 16 }}>{trackName}</div>
              <div className="text-muted text-sm mb-12">Complete all {progress.length} modules with a passing score (50%+) to earn your certificate.</div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}><span className="text-muted">Modules completed</span><span className="text-white">{completed.length}/{progress.length}</span></div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress.length ? (completed.length / progress.length) * 100 : 0}%` }}></div></div>
              </div>
            </div>
            <span className="badge badge-warning">{allDone ? 'Ready — ask admin to issue' : 'Locked'}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── MESSAGES: tutor + classmates (peer, same class) ── */
function AskTutor({ student }: { student: any }) {
  const [tab, setTab] = useState<'tutor' | 'classmates'>('tutor')
  const [tutorConvos, setTutorConvos] = useState<any[]>([])
  const [peerConvos, setPeerConvos] = useState<any[]>([])
  const [active, setActive] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  /** True while fetching the message list for the current conversation — never show stale bubbles from another chat. */
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  /** Bumps whenever a newer message fetch starts or the component unmounts — avoids tutor load finishing after peer chat opens and overwriting messages. */
  const messagesFetchGenRef = useRef(0)
  const userId = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('adhara_user') || '{}').id || '' : ''

  const loadMessagesForActive = async (kind: 'tutor' | 'peer', id: string) => {
    const gen = ++messagesFetchGenRef.current
    setMessagesLoading(true)
    setMessages([])
    try {
      const msgs =
        kind === 'peer' ? await messagesApi.peerMessages(id) : await messagesApi.getMessages(id)
      if (gen !== messagesFetchGenRef.current) return
      setMessages(Array.isArray(msgs) ? msgs : [])
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
    } catch {
      if (gen !== messagesFetchGenRef.current) return
      setMessages([])
    } finally {
      if (gen === messagesFetchGenRef.current) {
        setMessagesLoading(false)
      }
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [tc, pc] = await Promise.all([
          messagesApi.conversations().then((d) => (Array.isArray(d) ? d : [])),
          messagesApi.peerConversations().then((d) => (Array.isArray(d) ? d : [])).catch(() => []),
        ])
        if (cancelled) return
        setTutorConvos(tc)
        setPeerConvos(pc)
        if (tc.length > 0) {
          const c0 = tc[0]
          setActive({ kind: 'tutor', ...c0 })
          setTab('tutor')
          await loadMessagesForActive('tutor', c0.id)
        } else if (pc.length > 0) {
          const c0 = pc[0]
          setActive({ kind: 'peer', id: c0.id, peer: c0.peer })
          setTab('classmates')
          await loadMessagesForActive('peer', c0.id)
        } else {
          setMessagesLoading(false)
        }
      } catch {
        if (!cancelled) {
          setTutorConvos([])
          setPeerConvos([])
          setMessagesLoading(false)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      messagesFetchGenRef.current++
    }
  }, [])

  useEffect(() => {
    if (tab !== 'classmates') return
    const q = search.trim()
    if (!q) {
      setResults([])
      return
    }
    const t = setTimeout(() => {
      setSearching(true)
      studentsApi
        .meClassmates(q)
        .then((r) => setResults(Array.isArray(r) ? r : []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 380)
    return () => clearTimeout(t)
  }, [search, tab])

  const openTutorConvo = async (c: any) => {
    setTab('tutor')
    setActive({ kind: 'tutor', ...c })
    await loadMessagesForActive('tutor', c.id)
  }

  const openPeerConvo = async (c: any) => {
    setTab('classmates')
    setActive({ kind: 'peer', id: c.id, peer: c.peer })
    await loadMessagesForActive('peer', c.id)
  }

  const startTutor = async () => {
    try {
      const c = await messagesApi.start(student?.id || '', student?.schoolId || '')
      setTutorConvos((cs) => (cs.find((x) => x.id === c.id) ? cs : [c, ...cs]))
      await openTutorConvo(c)
    } catch (e: any) {
      notify.fromError(e)
    }
  }

  const pickClassmate = async (row: any) => {
    const uid = row.user?.id
    if (!uid) return
    // Invalidate any in-flight tutor fetch; clear UI so tutor bubbles never flash under peer header
    messagesFetchGenRef.current++
    setMessagesLoading(true)
    setMessages([])
    try {
      const c = await messagesApi.peerStart(uid)
      const entry = {
        id: c.id,
        kind: 'peer',
        peer: c.peer,
        lastMessage: null,
        unreadCount: 0,
        lastMessageAt: new Date(),
      }
      setPeerConvos((prev) => (prev.some((p) => p.id === c.id) ? prev : [entry, ...prev]))
      setActive({ kind: 'peer', id: c.id, peer: c.peer })
      setTab('classmates')
      await loadMessagesForActive('peer', c.id)
      setSearch('')
      setResults([])
    } catch (e: any) {
      setMessagesLoading(false)
      notify.fromError(e)
    }
  }

  const send = async () => {
    if (!input.trim() || !active || messagesLoading) return
    setSending(true)
    try {
      const msg =
        active.kind === 'peer'
          ? await messagesApi.peerSend(active.id, input)
          : await messagesApi.send(active.id, input)
      setMessages((m) => [...m, msg])
      const text = input
      setInput('')
      if (active.kind === 'peer') {
        setPeerConvos((cs) =>
          cs.map((x) => (x.id === active.id ? { ...x, lastMessage: text } : x)),
        )
      } else {
        setTutorConvos((cs) =>
          cs.map((x) => (x.id === active.id ? { ...x, lastMessage: text } : x)),
        )
      }
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (e: any) {
      notify.fromError(e)
    }
    setSending(false)
  }

  const other = () => {
    if (!active) return null
    if (active.kind === 'peer') return active.peer
    return active.tutor?.id === userId ? active.student : active.tutor
  }
  const o = other()
  const otherChatLabel = o ? `${o.firstName || ''}`.trim() || 'Them' : 'Them'

  const showChat =
    !!active &&
    ((tab === 'tutor' && active.kind === 'tutor') || (tab === 'classmates' && active.kind === 'peer'))

  return (
    <div>
      <div className="flex-between mb-16">
        <h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>
          Messages
        </h3>
        {!loading && tab === 'tutor' && tutorConvos.length === 0 && (
          <button type="button" onClick={startTutor} className="btn btn-primary btn-sm">
            Message tutor
          </button>
        )}
      </div>
      <p className="text-muted text-sm mb-16" style={{ maxWidth: 640, lineHeight: 1.5 }}>
        <strong>Your tutor</strong> — school-assigned tutor. <strong>Classmates</strong> — search by name, then click to chat (same class only).
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'tutor' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('tutor')}
        >
          Your tutor {tutorConvos.length ? `(${tutorConvos.length})` : ''}
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'classmates' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('classmates')}
        >
          Classmates {peerConvos.length ? `(${peerConvos.length})` : ''}
        </button>
      </div>

      {loading && <p className="text-muted text-sm" style={{ padding: 20 }}>Loading…</p>}

      {!loading && tab === 'tutor' && tutorConvos.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
          <p className="text-muted mb-20">No conversation with your tutor yet.</p>
          <button type="button" onClick={startTutor} className="btn btn-primary">
            Message my tutor
          </button>
        </div>
      )}

      {!loading && tab === 'classmates' && (
        <div className="card mb-20" style={{ maxWidth: 700 }}>
          <div className="font-display fw-600 text-white mb-12" style={{ fontSize: 14 }}>
            Find a classmate
          </div>
          <input
            className="form-input mb-12"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {searching && <p className="text-muted text-xs mb-8">Searching…</p>}
          {!searching && search.trim() && results.length === 0 && (
            <p className="text-muted text-sm">No matches in your class.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.map((row: any) => {
              const name = `${row.user?.firstName || ''} ${row.user?.lastName || ''}`.trim()
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => pickClassmate(row)}
                  className="btn btn-ghost"
                  style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                >
                  <span className="sidebar-avatar" style={{ width: 32, height: 32, fontSize: 11, marginRight: 10 }}>
                    {initials(name)}
                  </span>
                  {name}
                  <span className="text-muted text-xs" style={{ marginLeft: 'auto' }}>
                    Chat →
                  </span>
                </button>
              )
            })}
          </div>
          {peerConvos.length > 0 && (
            <div className="mt-20">
              <div className="text-muted text-xs mb-8" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Recent chats
              </div>
              {peerConvos.map((c: any) => {
                const name = `${c.peer?.firstName || ''} ${c.peer?.lastName || ''}`.trim()
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openPeerConvo(c)}
                    className="btn btn-ghost"
                    style={{
                      width: '100%',
                      justifyContent: 'flex-start',
                      marginBottom: 6,
                      border: active?.kind === 'peer' && active?.id === c.id ? '1px solid var(--gold)' : undefined,
                    }}
                  >
                    {name || 'Classmate'}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {!loading && tab === 'tutor' && tutorConvos.length > 0 && (
        <div className="mb-16" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="text-muted text-xs" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Conversation
          </div>
          {tutorConvos.map((c: any) => {
            const name = `${c.tutor?.firstName || ''} ${c.tutor?.lastName || ''}`.trim()
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => openTutorConvo(c)}
                className="btn btn-ghost btn-sm"
                style={{
                  justifyContent: 'flex-start',
                  border: active?.kind === 'tutor' && active?.id === c.id ? '1px solid var(--gold)' : undefined,
                }}
              >
                {name || 'Your tutor'}
              </button>
            )
          })}
        </div>
      )}

      {showChat && (
        <div className="card" style={{ maxWidth: 700, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border2)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="sidebar-avatar" style={{ width: 38, height: 38, fontSize: 13 }}>
              {o ? initials(`${o.firstName} ${o.lastName}`) : '?'}
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--white)', fontSize: 14 }}>
                {o ? `${o.firstName} ${o.lastName}` : 'Chat'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                {active.kind === 'peer' ? 'Classmate · same class' : 'Your tutor'}
              </div>
            </div>
          </div>
          <div
            style={{
              minHeight: 280,
              maxHeight: 400,
              overflowY: 'auto',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {messagesLoading ? (
              <div
                style={{
                  flex: 1,
                  minHeight: 200,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--muted)',
                  fontSize: 13,
                }}
              >
                Loading messages…
              </div>
            ) : (
              <>
                {messages.map((msg: any, i: number) => {
                  const isMe = msg.senderId === userId || msg.sender?.id === userId
                  const whoLabel = isMe ? 'You' : otherChatLabel
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
                {messages.length === 0 && (
                  <p className="text-muted text-sm" style={{ textAlign: 'center', marginTop: 40 }}>
                    {active.kind === 'peer' ? 'Say hi 👋' : 'Say hello to your tutor!'}
                  </p>
                )}
              </>
            )}
            <div ref={bottomRef} />
          </div>
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border2)', display: 'flex', gap: 8 }}>
            <input
              style={{
                flex: 1,
                background: 'var(--glass)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                color: 'var(--white)',
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                outline: 'none',
              }}
              placeholder="Type a message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
              disabled={messagesLoading || sending}
            />
            <button
              type="button"
              onClick={send}
              className="btn btn-primary btn-sm"
              disabled={messagesLoading || sending}
            >
              {sending ? '…' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── MY EXAMS ── */
function cbtAccessHint(schedule: any, student: any) {
  const custom = String(schedule?.accessCode || '').trim()
  if (custom) {
    return { kind: 'code' as const, value: custom }
  }
  const reg = String(student?.regNumber || '').trim()
  const last = reg ? reg.split('/').pop()?.trim() : ''
  if (last) {
    return { kind: 'regTail' as const, value: last }
  }
  return { kind: 'generic' as const, value: '' }
}

function StudentExams({ student }: { student: any }) {
  const { data: schedules, loading } = useLoad(['student', 'exam-schedules', student?.id], () => examSchedulesApi.mine(), [], !!student?.id)
  const arr = Array.isArray(schedules) ? schedules : []
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [])
  const upcoming = arr.filter((e: any) => new Date(e.scheduledAt) > new Date() && e.status !== 'CANCELLED')
  const past = arr.filter((e: any) => new Date(e.scheduledAt) <= new Date())
  const next = upcoming[0]
  const moduleLabel = (exam: any) => {
    const title = String(exam?.cbtExam?.title || '')
    const match = title.match(/module\s+\d+\s*:\s*([^—-]+)/i)
    return match ? `Module: ${match[0]}` : null
  }

  const renderAccessCell = (e: any) => {
    const hint = cbtAccessHint(e, student)
    if (hint.kind === 'code') {
      return (
        <span className="badge badge-info" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }} title="Enter this on the CBT login screen (not your dashboard password)">
          {hint.value}
        </span>
      )
    }
    if (hint.kind === 'regTail') {
      return (
        <span className="text-muted text-xs" style={{ lineHeight: 1.4 }} title="CBT access code — last part of your reg. number">
          Use <code style={{ fontSize: 11, color: 'var(--teal2)' }}>{hint.value}</code>
          <span className="text-muted"> (last part of reg. no.)</span>
        </span>
      )
    }
    return <span className="text-muted text-xs">Last segment of reg. no. after /</span>
  }

  return (
    <div>
      <div className="flex-between mb-20">
        <div>
          <h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>My Exams</h3>
          <p className="text-muted text-sm mt-8" style={{ maxWidth: 640, lineHeight: 1.5 }}>
            For <strong>Enter</strong>, the exam hall asks for your registration number and the access code in the table below — not your portal login password.
          </p>
        </div>
      </div>
      {next && (
        <div style={{ background: 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(245,158,11,0.08))', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 32 }}>⏰</div>
          <div style={{ flex: 1 }}>
            <div className="fw-700 text-white" style={{ fontSize: 15, marginBottom: 4 }}>Next: {next.cbtExam?.title}</div>
            {moduleLabel(next) && <div style={{ marginBottom: 6 }}><span className="badge badge-info">{moduleLabel(next)}</span></div>}
            <div className="text-sm text-muted">{new Date(next.scheduledAt).toLocaleDateString('en-NG', { weekday: 'long', month: 'long', day: 'numeric' })} · {next.venue || 'Computer Lab'} · {next.durationMins} mins</div>
            <div className="text-xs mt-8" style={{ color: 'var(--muted)' }}>
              CBT access: {(() => {
                const h = cbtAccessHint(next, student)
                if (h.kind === 'code') return <><span className="text-white" style={{ fontFamily: 'ui-monospace' }}>{h.value}</span> (exam code)</>
                if (h.kind === 'regTail') return <>use <code style={{ fontSize: 11, color: 'var(--teal2)' }}>{h.value}</code> — last part of your reg. number</>
                return 'last part of reg. number after /'
              })()}
            </div>
          </div>
          {(() => {
            const sched = new Date(next.scheduledAt).getTime()
            const duration = Number(next.durationMins || next.cbtExam?.durationMins || 30)
            const openAt = sched
            const closeAt = sched + duration * 60 * 1000 + 15 * 60 * 1000
            const now = nowMs
            const canEnter = next.status === 'SCHEDULED' && now >= openAt && now <= closeAt
            return canEnter ? (
              <a href={`/cbt?scheduleId=${encodeURIComponent(String(next.id))}`} className="btn btn-primary">Enter Exam Hall →</a>
            ) : (
              <button type="button" className="btn btn-ghost" disabled title={now < openAt ? 'Not open yet' : 'Closed'}>
                {now < openAt ? 'Not open yet' : 'Closed'}
              </button>
            )
          })()}
        </div>
      )}
      {loading ? <p className="text-muted text-sm" style={{ padding: 20 }}>Loading…</p> : (
        <div className="card">
          <div className="font-display fw-600 text-white mb-16">Exam Schedule</div>
          <table className="data-table">
            <thead><tr><th>Exam</th><th>Module</th><th>Date & Time</th><th>Venue</th><th>Duration</th><th>Status</th><th>CBT access</th><th>Action</th></tr></thead>
            <tbody>
              {arr.map((e: any) => (
                <tr key={e.id}>
                  <td style={{ fontWeight: 600, color: 'var(--white)' }}>{e.cbtExam?.title}</td>
                  <td>{moduleLabel(e) ? <span className="badge badge-info">{moduleLabel(e)}</span> : '—'}</td>
                  <td style={{ fontSize: 12 }}>{new Date(e.scheduledAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })} {new Date(e.scheduledAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{e.venue || '—'}</td>
                  <td style={{ fontSize: 12 }}>{e.durationMins} min</td>
                  <td><span className={`badge badge-${e.status === 'SCHEDULED' ? 'info' : e.status === 'CANCELLED' ? 'danger' : 'success'}`}>{e.status}</span></td>
                  <td style={{ maxWidth: 160 }}>{renderAccessCell(e)}</td>
                  <td>
                    {(() => {
                      const sched = new Date(e.scheduledAt).getTime()
                      const duration = Number(e.durationMins || e.cbtExam?.durationMins || 30)
                      const openAt = sched
                      const closeAt = sched + duration * 60 * 1000 + 15 * 60 * 1000
                      const now = nowMs
                      const canEnter = e.status === 'SCHEDULED' && now >= openAt && now <= closeAt
                      return canEnter ? (
                        <a
                          href={`/cbt?scheduleId=${encodeURIComponent(String(e.id))}`}
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: 11 }}
                        >
                          Enter →
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 11, opacity: 0.8 }}
                          title={now < openAt ? 'Not open yet' : now > closeAt ? 'Closed' : 'Unavailable'}
                          disabled
                        >
                          {now < openAt ? 'Not open yet' : now > closeAt ? 'Closed' : 'View'}
                        </button>
                      )
                    })()}
                  </td>
                </tr>
              ))}
              {arr.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>No exams scheduled yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ── NOTIFICATIONS ── */
function StudentNotifications() {
  const router = useRouter()
  const { data: notifs, loading, setData } = useLoad(['student', 'notifications'], () => notifApi.all(), [], true)
  const arr = Array.isArray(notifs) ? notifs : []
  const markAll = async () => {
    try {
      await notifApi.markAllRead()
      setData(arr.map((n: any) => ({ ...n, isRead: true })) as any)
      notify.success('All notifications marked as read')
    } catch (e: any) {
      notify.fromError(e, 'Could not update notifications')
    }
  }
  const mark = async (id: string) => {
    try {
      await notifApi.markRead(id)
      setData(arr.map((n: any) => n.id === id ? { ...n, isRead: true } : n) as any)
    } catch (e: any) {
      notify.fromError(e, 'Could not mark as read')
    }
  }
  return (
    <div>
      <div className="flex-between mb-20"><div><h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Notifications</h3><div className="text-muted text-sm">{loading ? '…' : `${arr.filter((n: any) => !n.isRead).length} unread`}</div></div><button onClick={markAll} className="btn btn-ghost btn-sm" disabled={loading}>Mark All Read</button></div>
      {loading && <p className="text-muted text-sm" style={{ padding: 20 }}>Loading…</p>}
      <div className="card" style={{ padding: 0 }}>
        {arr.map((n: any, i: number) => (
          <div
            key={n.id || i}
            onClick={() => {
              if (n?.id) void mark(n.id)
              const link = String(n?.link || '').trim()
              if (link) {
                // Link is absolute within app; use full navigation so query/hash works reliably.
                window.location.href = link
              } else {
                // Fallback: open notifications section (already here)
                router.push('/dashboard/student?section=student-notifications')
              }
            }}
            style={{
              display: 'flex',
              gap: 14,
              padding: 16,
              borderLeft: `3px solid ${!n.isRead ? 'rgba(212,168,83,0.4)' : 'transparent'}`,
              borderBottom: '1px solid var(--border2)',
              background: !n.isRead ? 'rgba(212,168,83,0.04)' : '',
              cursor: 'pointer',
            }}
          >
            <div style={{ width: 36, height: 36, background: 'var(--muted3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🔔</div>
            <div style={{ flex: 1 }}><div className="text-sm fw-700 text-white mb-4">{n.title}</div><div className="text-sm text-muted" style={{ lineHeight: 1.5 }}>{n.message}</div><div className="text-xs text-muted" style={{ marginTop: 6 }}>{new Date(n.createdAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div></div>
            {!n.isRead && <span className="badge badge-gold" style={{ alignSelf: 'flex-start', flexShrink: 0 }}>New</span>}
          </div>
        ))}
        {!loading && arr.length === 0 && <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 0' }}>No notifications yet</div>}
      </div>
    </div>
  )
}

/* ── SCHOOL NOTICES (parent) ── */
function SchoolNotices({ student }: { student: any }) {
  const { data: notices, loading } = useLoad(['student', 'school-notices', student?.schoolId], () => noticesApi.all(student.schoolId), [], !!student?.schoolId)
  const arr = Array.isArray(notices) ? notices : []
  const tc: Record<string, string> = { URGENT: 'var(--danger)', IMPORTANT: 'var(--gold)', INFO: 'var(--teal)' }
  return (
    <div>
      <h3 className="font-display fw-700 text-white mb-20" style={{ fontSize: 20 }}>School Notices</h3>
      {loading && <p className="text-muted text-sm" style={{ padding: 20 }}>Loading…</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {arr.map((n: any) => (
          <div key={n.id} className="card" style={{ borderLeft: `3px solid ${tc[n.type] || 'var(--teal)'}` }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <span className={`badge badge-${n.type === 'URGENT' ? 'danger' : n.type === 'IMPORTANT' ? 'warning' : 'info'}`}>{n.type}</span>
              <span className="text-muted" style={{ fontSize: 12 }}>{new Date(n.publishedAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
            <div className="fw-700 text-white mb-6" style={{ fontSize: 15 }}>{n.title}</div>
            <div className="text-muted text-sm" style={{ lineHeight: 1.7 }}>{n.body}</div>
          </div>
        ))}
        {!loading && arr.length === 0 && <div className="card" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>No notices from your school yet</div>}
      </div>
    </div>
  )
}

/* ── SETTINGS ── */
function StudentSettings({ student, onProfileUpdated, hidePassword }: { student: any; onProfileUpdated?: () => void; hidePassword?: boolean }) {
  const [form, setForm] = useState({ firstName: student?.user?.firstName || '', lastName: student?.user?.lastName || '', email: student?.user?.email || '', phone: student?.user?.phone || '' })
  const [saved, setSaved] = useState(false)
  const [pwd, setPwd] = useState({ old: '', next: '', confirm: '' })
  const [pwdBusy, setPwdBusy] = useState(false)
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    try { const { usersApi } = await import('@/lib/api'); await usersApi.updateProfile({ firstName: form.firstName, lastName: form.lastName, phone: form.phone }); setSaved(true); notify.success('Profile saved'); setTimeout(() => setSaved(false), 2500) } catch (e: any) { notify.fromError(e) }
  }
  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pwd.next !== pwd.confirm) {
      notify.error('New passwords do not match')
      return
    }
    if (pwd.next.length < 8) {
      notify.error('New password must be at least 8 characters')
      return
    }
    setPwdBusy(true)
    try {
      await authApi.changePassword(pwd.old, pwd.next)
      notify.success('Password updated')
      setPwd({ old: '', next: '', confirm: '' })
      onProfileUpdated?.()
    } catch (err: any) {
      notify.error(err?.message || 'Could not change password')
    }
    setPwdBusy(false)
  }
  return (
    <div>
      <h3 className="font-display fw-700 text-white mb-20" style={{ fontSize: 20 }}>My Settings</h3>
      <div className="card" style={{ maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div className="sidebar-avatar" style={{ width: 56, height: 56, fontSize: 18 }}>{initials(`${form.firstName} ${form.lastName}`)}</div>
          <div><div className="font-display fw-700 text-white mb-4">{form.firstName} {form.lastName}</div><div className="text-xs text-muted">Student · {student?.track?.replace('TRACK_', 'Track ')} · {student?.regNumber}</div></div>
        </div>
        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label className="form-label">First Name</label><input className="form-input" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /></div>
            <div><label className="form-label">Last Name</label><input className="form-input" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></div>
          </div>
          <div><label className="form-label">Email</label><input className="form-input" value={form.email || ''} readOnly style={{ opacity: 0.6 }} placeholder="—" /></div>
          <div><label className="form-label">Phone</label><input className="form-input" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          <button type="submit" className="btn btn-primary btn-sm">{saved ? '✓ Saved!' : 'Save Changes'}</button>
        </form>
      </div>
      {!hidePassword && (
      <div className="card mt-20" style={{ maxWidth: 480 }}>
        <div className="font-display fw-600 text-white mb-12" style={{ fontSize: 15 }}>Change password</div>
        <p className="text-muted text-sm mb-16" style={{ lineHeight: 1.6 }}>Use a password you can remember. Your tutor may ask you to update from the school default.</p>
        <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label className="form-label">Current password</label><input type="password" className="form-input" autoComplete="current-password" value={pwd.old} onChange={e => setPwd({ ...pwd, old: e.target.value })} /></div>
          <div><label className="form-label">New password</label><input type="password" className="form-input" autoComplete="new-password" value={pwd.next} onChange={e => setPwd({ ...pwd, next: e.target.value })} /></div>
          <div><label className="form-label">Confirm new password</label><input type="password" className="form-input" autoComplete="new-password" value={pwd.confirm} onChange={e => setPwd({ ...pwd, confirm: e.target.value })} /></div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={pwdBusy}>{pwdBusy ? 'Updating…' : 'Update password'}</button>
        </form>
      </div>
      )}
    </div>
  )
}

/* ── PARENT OVERVIEW ── */
function ParentOverview({ student, stats, progress }: any) {
  const completed = progress.filter((p: any) => p.status === 'COMPLETED')
  return (<>
    <div style={{ background: 'linear-gradient(135deg,rgba(26,127,212,0.1),rgba(212,168,83,0.07))', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px 28px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{ fontSize: 40 }}>👪</div>
      <div style={{ flex: 1 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 4, color: 'var(--white)' }}>{student?.user?.firstName} {student?.user?.lastName}</h3>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>{student?.className} · {student?.track?.replace('TRACK_', 'Track ')} · {student?.regNumber}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="badge badge-success">Active</span>
          {student?.school?.name && <span className="badge badge-teal">{student.school.name}</span>}
          {stats?.averageScore >= 80 && <span className="badge badge-gold">Top Performer</span>}
        </div>
      </div>
    </div>
    <div className="stats-row">
      {[
        { glow: 'var(--gold)', icon: '📊', bg: 'rgba(212,168,83,0.15)', val: stats?.averageScore ? `${stats.averageScore}%` : '—', label: 'Average Score', trend: stats?.averageScore >= 80 ? '↑ Performing well' : 'Improving', up: stats?.averageScore >= 80 },
        { glow: 'var(--success)', icon: '✅', bg: 'rgba(34,197,94,0.15)', val: stats?.attendanceRate ? `${stats.attendanceRate}%` : '—', label: 'Attendance', trend: 'This term' },
        { glow: 'var(--teal)', icon: '📈', bg: 'rgba(26,127,212,0.15)', val: `${completed.length}/${progress.length}`, label: 'Modules Done', trend: 'Track progress' },
        { glow: '#A78BFA', icon: '🏆', bg: 'rgba(139,92,246,0.15)', val: stats?.examsTaken || 0, label: 'Exams Taken', trend: 'CBT assessments' },
      ].map(s => (
        <div key={s.label} className="stat-card"><div className="stat-glow" style={{ background: s.glow }}></div><div className="stat-card-icon" style={{ background: s.bg }}>{s.icon}</div><div className="stat-card-value">{s.val}</div><div className="stat-card-label">{s.label}</div><span className={`stat-card-trend${s.up ? ' trend-up' : ''}`}>{s.trend}</span></div>
      ))}
    </div>
  </>)
}

/* ── MAIN ── */
export default function StudentDashboard() {
  const router = useRouter()
  const [section, setSection] = useState('student-dashboard')
  const [student, setStudent] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [progress, setProgress] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isParent, setIsParent] = useState(false)
  const [examPopup, setExamPopup] = useState<{ open: boolean; schedule: any | null }>({ open: false, schedule: null })

  const refreshStudent = useCallback(async () => {
    try {
      const s = await studentsApi.me()
      setStudent(s)
    } catch {
      /* ignore */
    }
  }, [])
  const { data: assignmentBadgeData } = useQuery({
    queryKey: ['student', 'badge-assignments', student?.id],
    queryFn: () => assignmentsApi.mine(),
    enabled: !isParent && !!student?.id,
    staleTime: 30_000,
    retry: 1,
  })
  const { data: examBadgeData } = useQuery({
    queryKey: ['student', 'badge-exams', student?.id],
    queryFn: () => examSchedulesApi.mine(),
    enabled: !isParent && !!student?.id,
    staleTime: 30_000,
    retry: 1,
  })
  const { data: notifBadgeData } = useQuery({
    queryKey: ['student', 'badge-notifications'],
    queryFn: () => notifApi.unreadCount(),
    enabled: !isParent && !!student?.id,
    staleTime: 30_000,
    retry: 1,
  })
  const { data: practicalBadgeData } = useQuery({
    queryKey: ['student', 'badge-practicals', student?.id],
    queryFn: () => practicalsApi.myTasks(),
    enabled: !isParent && !!student?.id,
    staleTime: 30_000,
    retry: 1,
  })

  useEffect(() => {
    if (!localStorage.getItem('adhara_token')) { router.push('/auth/login'); return }
    const u = JSON.parse(localStorage.getItem('adhara_user') || '{}')
    const parent = u.role === 'PARENT'
    setIsParent(parent)
    if (parent) setSection('parent-overview')
    const init = async () => {
      try {
        const s = await studentsApi.me()
        setStudent(s)
        localStorage.setItem('adhara_user', JSON.stringify({ ...u, id: s.user?.id || u.id }))
        const [st, pr] = await Promise.all([studentsApi.myStats(), modulesApi.studentProgress(s.id)])
        setStats(st); setProgress(Array.isArray(pr) ? pr : [])
      } catch { router.push('/auth/login') }
      setLoading(false)
    }
    init()
  }, [])

  const titles: Record<string, string> = {
    'student-dashboard': 'My Dashboard', 'student-modules': 'My Modules', 'student-assignments': 'Assignments', 'student-practicals': 'Practical Assessments',
    'student-results': 'My Results', 'student-attendance': 'Attendance', 'student-certificates': 'My Certificates',
    'student-asktutor': 'Messages', 'student-exams': 'My Exams', 'student-notifications': 'Notifications', 'student-settings': 'Settings',
    'parent-overview': 'Overview', 'parent-results': 'Results', 'parent-attendance': 'Attendance',
    'parent-exams': 'Exam Schedule', 'parent-notices': 'School Notices', 'parent-settings': 'Settings',
  }

  const assignmentsArr = Array.isArray(assignmentBadgeData) ? assignmentBadgeData : []
  const pendingAssignments = assignmentsArr.filter((a: any) => !a.submission).length
  const examsArr = Array.isArray(examBadgeData) ? examBadgeData : []
  const upcomingExams = examsArr.filter((e: any) => new Date(e.scheduledAt) > new Date() && e.status !== 'CANCELLED').length
  const unreadNotifs =
    typeof notifBadgeData === 'number'
      ? notifBadgeData
      : ((notifBadgeData as any)?.count ?? (notifBadgeData as any)?.unreadCount ?? 0)
  const practicalsArr = Array.isArray(practicalBadgeData) ? practicalBadgeData : []
  const pendingPracticals = practicalsArr.filter((t: any) => !t.submission).length
  const navBadges = isParent
    ? undefined
    : {
        'student-assignments': pendingAssignments > 0 ? pendingAssignments : null,
        'student-practicals': pendingPracticals > 0 ? pendingPracticals : null,
        'student-exams': upcomingExams > 0 ? upcomingExams : null,
        'student-notifications': unreadNotifs > 0 ? unreadNotifs : null,
      }

  // One-time exam popup (per schedule) on dashboard load.
  useEffect(() => {
    if (isParent) return
    if (!student?.id) return
    const upcoming = examsArr
      .filter((e: any) => e?.status !== 'CANCELLED' && new Date(e.scheduledAt) > new Date())
      .sort((a: any, b: any) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))
    const next = upcoming[0]
    if (!next?.id) return
    const key = `adhara_exam_popup_seen_${next.id}`
    if (typeof window !== 'undefined' && window.localStorage.getItem(key)) return
    // Show only if within next 14 days (avoid noisy popups for far-future exams)
    const days = (+new Date(next.scheduledAt) - Date.now()) / (1000 * 60 * 60 * 24)
    if (days > 14) return
    setExamPopup({ open: true, schedule: next })
  }, [isParent, student?.id, examsArr.length])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy)' }}>
      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 48, animation: 'float 2s ease-in-out infinite' }}>📚</div><p style={{ color: 'var(--muted)', marginTop: 16 }}>Loading your portal…</p></div>
    </div>
  )

  const render = () => {
    switch (section) {
      case 'student-modules': return <StudentModules progress={progress} student={student} />
      case 'student-assignments': return <StudentAssignments student={student} />
      case 'student-practicals': return <StudentPracticals student={student} />
      case 'student-results': case 'parent-results': return <StudentResults progress={progress} student={student} />
      case 'student-attendance': case 'parent-attendance': return <StudentAttendance student={student} />
      case 'student-certificates': return <StudentCertificates student={student} progress={progress} />
      case 'student-asktutor': return <AskTutor student={student} />
      case 'student-exams': case 'parent-exams': return <StudentExams student={student} />
      case 'student-notifications': return <StudentNotifications />
      case 'student-settings': return <StudentSettings student={student} onProfileUpdated={refreshStudent} />
      case 'parent-settings': return <StudentSettings student={student} onProfileUpdated={refreshStudent} hidePassword />
      case 'parent-notices': return <SchoolNotices student={student} />
      case 'parent-overview': return <ParentOverview student={student} stats={stats} progress={progress} />
      default: return isParent ? <ParentOverview student={student} stats={stats} progress={progress} /> : <StudentHome student={student} stats={stats} progress={progress} onSection={setSection} />
    }
  }

  return (
    <DashboardShell role={isParent ? 'parent' : 'student'} title={titles[section] || 'Dashboard'}
      subtitle={section === 'student-dashboard' ? `${student?.user?.firstName} ${student?.user?.lastName} · ${student?.regNumber} · ${student?.track?.replace('TRACK_', 'Track ')}` : undefined}
      section={section} onSectionChange={setSection} navBadges={navBadges}>
      <Modal
        open={!isParent && examPopup.open && !!examPopup.schedule}
        onClose={() => {
          const id = examPopup.schedule?.id
          if (id && typeof window !== 'undefined') {
            window.localStorage.setItem(`adhara_exam_popup_seen_${id}`, String(Date.now()))
          }
          setExamPopup({ open: false, schedule: null })
        }}
        title="Upcoming exam"
      >
        {examPopup.schedule ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="badge badge-warning" style={{ alignSelf: 'flex-start' }}>Scheduled</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--white)' }}>
              {examPopup.schedule?.cbtExam?.title || 'CBT Exam'}
            </div>
            <div className="text-muted text-sm">
              {new Date(examPopup.schedule.scheduledAt).toLocaleDateString('en-NG', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}{' '}
              · {new Date(examPopup.schedule.scheduledAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-muted text-sm">
              Venue: <span style={{ color: 'var(--white)' }}>{examPopup.schedule.venue || 'Computer Lab'}</span> · Duration:{' '}
              <span style={{ color: 'var(--white)' }}>{examPopup.schedule.durationMins || examPopup.schedule?.cbtExam?.durationMins || 60} mins</span>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const id = examPopup.schedule?.id
                  if (id && typeof window !== 'undefined') {
                    window.localStorage.setItem(`adhara_exam_popup_seen_${id}`, String(Date.now()))
                  }
                  setExamPopup({ open: false, schedule: null })
                  setSection('student-exams')
                }}
              >
                View schedule →
              </button>
              <a
                className="btn btn-ghost"
                href="/cbt"
                onClick={() => {
                  const id = examPopup.schedule?.id
                  if (id && typeof window !== 'undefined') {
                    window.localStorage.setItem(`adhara_exam_popup_seen_${id}`, String(Date.now()))
                  }
                }}
              >
                Enter exam hall
              </a>
            </div>
            <div className="text-muted text-xs" style={{ marginTop: 4 }}>
              This reminder will only show once for this exam.
            </div>
          </div>
        ) : null}
      </Modal>
      {!isParent && student?.user?.mustChangePassword && (
        <div
          role="status"
          style={{
            marginBottom: 20,
            padding: '14px 18px',
            borderRadius: 12,
            border: '1px solid rgba(212,168,83,0.45)',
            background: 'linear-gradient(135deg, rgba(212,168,83,0.14), rgba(26,127,212,0.08))',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12,
            justifyContent: 'space-between',
          }}
        >
          <div style={{ flex: '1 1 220px', fontSize: 14, color: 'var(--white)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--gold)' }}>Change your password</strong>
            <span style={{ color: 'var(--muted)', display: 'block', marginTop: 4 }}>
              Your tutor will remind you to pick a personal password. Update it here when you are ready.
            </span>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setSection('student-settings')}>
            Open settings →
          </button>
        </div>
      )}
      {render()}
    </DashboardShell>
  )
}
