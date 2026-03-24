'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardShell } from '@/components/DashboardShell'
import { schoolsApi, sessionsApi } from '@/lib/api'

function trackLabel(track: string) {
  return String(track || '').replace(/^TRACK_/i, 'Track ')
}

function sessionModuleCell(row: any) {
  if (row.module) return `Mod ${row.module.number}: ${row.module.title}`
  return row.moduleTitle || '—'
}

function csvEscape(s: string) {
  const v = String(s ?? '')
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

function downloadSessionsCsv(rows: any[], schoolName: string, code: string) {
  const headers = [
    'Tutor',
    'Class',
    'Track',
    'Tutor assignment ID',
    'Curriculum module',
    'Module note (legacy)',
    'Started (ISO)',
    'Ended (ISO)',
    'Duration (min)',
    'Students present',
    'Notes',
  ]
  const lines = [headers.join(',')]
  for (const row of rows) {
    const tutorName = `${row.tutor?.firstName || ''} ${row.tutor?.lastName || ''}`.trim()
    const curMod =
      row.module ? `Mod ${row.module.number}: ${row.module.title}` : ''
    lines.push(
      [
        csvEscape(tutorName),
        csvEscape(row.className || ''),
        csvEscape(row.track || ''),
        csvEscape(row.tutorAssignmentId || ''),
        csvEscape(curMod),
        csvEscape(row.moduleTitle || ''),
        csvEscape(row.startedAt || ''),
        csvEscape(row.endedAt || ''),
        row.durationMins != null ? String(row.durationMins) : '',
        row.studentsPresent != null ? String(row.studentsPresent) : '',
        csvEscape(row.notes || ''),
      ].join(','),
    )
  }
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  const safe = `${code || 'school'}-${schoolName}`.replace(/[^\w\-]+/g, '-').slice(0, 80)
  a.download = `session-logs-${safe}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function SuperAdminSchoolSessionsPage() {
  const router = useRouter()
  const params = useParams()
  const schoolId = typeof params?.schoolId === 'string' ? params.schoolId : Array.isArray(params?.schoolId) ? params.schoolId[0] : ''

  const [loading, setLoading] = useState(true)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [school, setSchool] = useState<any>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [err, setErr] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')
  const [coverage, setCoverage] = useState<any>(null)
  const [coverageWeekStart, setCoverageWeekStart] = useState('')
  const [loadingCov, setLoadingCov] = useState(false)

  const nav = (section: string) => {
    router.push(`/dashboard/superadmin?section=${encodeURIComponent(section)}`)
  }

  const fetchSessions = useCallback(
    async (from: string, to: string) => {
      if (!schoolId) return []
      const logs = await sessionsApi.bySchool(schoolId, {
        limit: 500,
        from: from.trim() || undefined,
        to: to.trim() || undefined,
      })
      return Array.isArray(logs) ? logs : []
    },
    [schoolId],
  )

  const loadInitial = useCallback(async () => {
    if (!schoolId) return
    setErr('')
    setLoading(true)
    try {
      const s = await schoolsApi.one(schoolId)
      setSchool(s)
      const logs = await fetchSessions('', '')
      setSessions(logs)
      setAppliedFrom('')
      setAppliedTo('')
    } catch (e: any) {
      setErr(e.message || 'Failed to load')
      setSchool(null)
      setSessions([])
    }
    setLoading(false)
  }, [schoolId, fetchSessions])

  useEffect(() => {
    if (!localStorage.getItem('adhara_token')) {
      router.push('/auth/login')
      return
    }
    loadInitial()
  }, [loadInitial, router])

  useEffect(() => {
    if (!schoolId || !school) return
    let cancelled = false
    setLoadingCov(true)
    sessionsApi
      .schoolCoverage(schoolId, coverageWeekStart.trim() || undefined)
      .then((d) => {
        if (!cancelled) setCoverage(d)
      })
      .catch(() => {
        if (!cancelled) setCoverage(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingCov(false)
      })
    return () => {
      cancelled = true
    }
  }, [schoolId, school?.id, coverageWeekStart])

  const applyFilters = async () => {
    setLoadingSessions(true)
    setErr('')
    try {
      const logs = await fetchSessions(dateFrom, dateTo)
      setSessions(logs)
      setAppliedFrom(dateFrom)
      setAppliedTo(dateTo)
    } catch (e: any) {
      setErr(e.message || 'Failed to load sessions')
    }
    setLoadingSessions(false)
  }

  const clearFilters = async () => {
    setDateFrom('')
    setDateTo('')
    setLoadingSessions(true)
    setErr('')
    try {
      const logs = await fetchSessions('', '')
      setSessions(logs)
      setAppliedFrom('')
      setAppliedTo('')
    } catch (e: any) {
      setErr(e.message || 'Failed to load sessions')
    }
    setLoadingSessions(false)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy)' }}>
        <p className="text-muted">Loading session logs…</p>
      </div>
    )
  }

  if (err || !school) {
    return (
      <DashboardShell role="superadmin" title="Session logs" section="session-logs" onSectionChange={nav} navBadges={{}}>
        <div className="card">
          <p className="text-muted">{err || 'School not found.'}</p>
          <button type="button" className="btn btn-primary btn-sm mt-16" onClick={() => nav('session-logs')}>
            ← Back to schools
          </button>
        </div>
      </DashboardShell>
    )
  }

  const filterSummary =
    appliedFrom || appliedTo
      ? `Filtered by session start${appliedFrom ? ` from ${appliedFrom}` : ''}${appliedTo ? ` through ${appliedTo}` : ''} (UTC day bounds).`
      : 'No date filter (latest up to 500 rows).'

  return (
    <DashboardShell
      role="superadmin"
      title={school.name}
      subtitle="Tutor session logs"
      section="session-logs"
      onSectionChange={nav}
      navBadges={{}}
      topbarRight={
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => nav('session-logs')}>
          ← All schools
        </button>
      }
    >
      <p className="text-muted text-sm mb-16" style={{ maxWidth: 720 }}>
        {school.code} · {school.state}
        {school.lga ? ` · ${school.lga}` : ''}.{' '}
        <strong style={{ color: 'var(--white)' }}>{sessions.length}</strong> row{sessions.length === 1 ? '' : 's'} loaded. {filterSummary}
      </p>

      <div className="card mb-20" style={{ maxWidth: 960 }}>
        <div className="font-display fw-600 text-white mb-8" style={{ fontSize: 15 }}>
          Weekly coverage vs expectation
        </div>
        <p className="text-muted text-xs mb-16" style={{ lineHeight: 1.5 }}>
          <strong>UTC week</strong> (Mon 00:00 → Sun 23:59). Each row is an active tutor assignment. <strong>Delivered</strong> counts session logs linked to that assignment with{' '}
          <code style={{ fontSize: 10 }}>startedAt</code> in the range. Expectation is set when the tutor is assigned (1–14/week). Sessions with no assignment link (shown as &quot;—&quot; below) are listed but{' '}
          <strong>do not</strong> count toward Delivered — end them and start a new session from the tutor portal so the assignment is linked.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
          <div>
            <label className="form-label">Week starts (Monday UTC)</label>
            <input
              type="date"
              className="form-input"
              style={{ maxWidth: 180 }}
              value={coverageWeekStart}
              onChange={(e) => setCoverageWeekStart(e.target.value)}
            />
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCoverageWeekStart('')}>
            Use current week
          </button>
        </div>
        {coverage?.weekStart && (
          <p className="text-muted text-xs mb-12">
            Range: {new Date(coverage.weekStart).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} →{' '}
            {new Date(coverage.weekEnd).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}
        {loadingCov ? (
          <p className="text-muted text-sm">Loading coverage…</p>
        ) : Array.isArray(coverage?.rows) && coverage.rows.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tutor</th>
                  <th>Class</th>
                  <th>Track</th>
                  <th>Expected/wk</th>
                  <th>Delivered</th>
                  <th>Gap</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {coverage.rows.map((row: any) => (
                  <tr key={row.assignmentId}>
                    <td style={{ fontWeight: 600, color: 'var(--white)', whiteSpace: 'nowrap' }}>{row.tutorName}</td>
                    <td>{row.className}</td>
                    <td style={{ fontSize: 12 }}>{trackLabel(row.track)}</td>
                    <td>{row.expectedSessionsPerWeek}</td>
                    <td>{row.deliveredThisWeek}</td>
                    <td>{row.shortBy > 0 ? row.shortBy : '—'}</td>
                    <td>
                      <span className={`badge ${row.metExpectation ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 10 }}>
                        {row.metExpectation ? 'Met' : 'Below'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted text-sm">No active tutor assignments for this school.</p>
        )}
      </div>

      <div className="card mb-20" style={{ maxWidth: 920 }}>
        <div className="font-display fw-600 text-white mb-12" style={{ fontSize: 14 }}>
          Filter by session start date
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label className="form-label">From</label>
            <input className="form-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="form-label">To</label>
            <input className="form-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <button type="button" className="btn btn-primary btn-sm" disabled={loadingSessions} onClick={() => applyFilters()}>
            {loadingSessions ? 'Loading…' : 'Apply'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={loadingSessions} onClick={() => clearFilters()}>
            Clear
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={sessions.length === 0}
            onClick={() => downloadSessionsCsv(sessions, school.name, school.code)}
          >
            Export CSV
          </button>
        </div>
        <p className="text-muted text-xs mt-12">Dates use UTC day boundaries. Export includes the rows currently shown in the table.</p>
      </div>

      <div className="card" style={{ overflowX: 'auto', opacity: loadingSessions ? 0.65 : 1 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Tutor</th>
              <th>Class</th>
              <th>Track</th>
              <th>Assignment</th>
              <th>Module</th>
              <th>Started</th>
              <th>Ended</th>
              <th>Duration</th>
              <th>Students</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((row: any) => {
              const tutorName = `${row.tutor?.firstName || ''} ${row.tutor?.lastName || ''}`.trim() || '—'
              const started = row.startedAt ? new Date(row.startedAt) : null
              const ended = row.endedAt ? new Date(row.endedAt) : null
              return (
                <tr key={row.id}>
                  <td style={{ fontWeight: 600, color: 'var(--white)', whiteSpace: 'nowrap' }}>{tutorName}</td>
                  <td>{row.className || '—'}</td>
                  <td style={{ fontSize: 12 }}>{trackLabel(row.track)}</td>
                  <td style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {row.tutorAssignmentId ? (
                      <span className="badge badge-teal" style={{ fontSize: 9 }}>Linked</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 180 }}>{sessionModuleCell(row)}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {started
                      ? `${started.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })} ${started.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}`
                      : '—'}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {ended ? (
                      `${ended.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })} ${ended.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}`
                    ) : (
                      <span className="badge badge-warning" style={{ fontSize: 10 }}>
                        In progress
                      </span>
                    )}
                  </td>
                  <td>{row.durationMins != null ? `${row.durationMins} min` : '—'}</td>
                  <td>{row.studentsPresent ?? '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 200 }}>{row.notes || '—'}</td>
                </tr>
              )
            })}
            {sessions.length === 0 && !loadingSessions && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 0' }}>
                  {appliedFrom || appliedTo
                    ? 'No sessions in this date range.'
                    : 'No sessions recorded for this school yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  )
}
