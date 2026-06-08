'use client'

import { useEffect, useState, useCallback } from 'react'
import { sessionsApi, tutorAttendanceApi } from '@/lib/api'

function trackLabel(track: string) {
  return String(track || '').replace(/^TRACK_/i, 'Track ')
}

function sessionModuleCell(row: any) {
  if (row.module) return `Mod ${row.module.number}: ${row.module.title}`
  return row.moduleTitle || '—'
}

export function TutorDeliveryPanel({ schoolId }: { schoolId: string }) {
  const [coverage, setCoverage] = useState<any>(null)
  const [coverageWeekStart, setCoverageWeekStart] = useState('')
  const [loadingCov, setLoadingCov] = useState(false)
  const [sessions, setSessions] = useState<any[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [tutorAtt, setTutorAtt] = useState<any[]>([])
  const [loadingTutorAtt, setLoadingTutorAtt] = useState(false)

  useEffect(() => {
    if (!schoolId) return
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
  }, [schoolId, coverageWeekStart])

  const loadSessions = useCallback(async () => {
    if (!schoolId) return
    setLoadingSessions(true)
    try {
      const logs = await sessionsApi.bySchool(schoolId, {
        limit: 200,
        from: dateFrom.trim() || undefined,
        to: dateTo.trim() || undefined,
      })
      setSessions(Array.isArray(logs) ? logs : [])
    } catch {
      setSessions([])
    }
    setLoadingSessions(false)
  }, [schoolId, dateFrom, dateTo])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  useEffect(() => {
    if (!schoolId) return
    let cancelled = false
    setLoadingTutorAtt(true)
    tutorAttendanceApi
      .bySchool(schoolId, {
        from: dateFrom.trim() || undefined,
        to: dateTo.trim() || undefined,
      })
      .then((rows) => {
        if (!cancelled) setTutorAtt(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setTutorAtt([])
      })
      .finally(() => {
        if (!cancelled) setLoadingTutorAtt(false)
      })
    return () => {
      cancelled = true
    }
  }, [schoolId, dateFrom, dateTo])

  return (
    <div>
      <div className="flex-between mb-20">
        <div>
          <h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>
            Tutor delivery
          </h3>
          <div className="text-muted text-sm">
            Weekly session counts vs expectation for each tutor–class assignment, plus recent session logs.
          </div>
        </div>
      </div>

      <div className="card mb-20">
        <div className="font-display fw-600 text-white mb-8" style={{ fontSize: 15 }}>
          Weekly coverage vs expectation
        </div>
        <p className="text-muted text-xs mb-16" style={{ lineHeight: 1.5 }}>
          Each row is an active tutor assignment. <strong>Delivered</strong> counts sessions linked to that assignment this UTC week.
          Expectation is set when Super Admin assigns the tutor (typically 1–14 sessions/week).
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
            Range: {new Date(coverage.weekStart).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} →{' '}
            {new Date(coverage.weekEnd).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
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
                  <th>Term</th>
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
                    <td style={{ fontSize: 11, color: 'var(--muted)' }}>{row.termLabel || '—'}</td>
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

      <div className="card mb-20">
        <div className="font-display fw-600 text-white mb-8" style={{ fontSize: 14 }}>
          Tutor attendance check-ins
        </div>
        <p className="text-muted text-xs mb-12" style={{ lineHeight: 1.5 }}>
          Optional daily check-in by tutors at your school (separate from student attendance and session logs).
        </p>
        {loadingTutorAtt ? (
          <p className="text-muted text-sm">Loading…</p>
        ) : tutorAtt.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Tutor</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {tutorAtt.map((row: any) => {
                  const name = `${row.tutor?.user?.firstName || ''} ${row.tutor?.user?.lastName || ''}`.trim() || '—'
                  return (
                    <tr key={row.id}>
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(row.date).toLocaleDateString('en-NG')}</td>
                      <td style={{ fontWeight: 600, color: 'var(--white)' }}>{name}</td>
                      <td>
                        <span className={`badge ${row.status === 'PRESENT' ? 'badge-success' : row.status === 'LATE' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: 10 }}>
                          {row.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{row.notes || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted text-sm">No tutor check-ins in this date range.</p>
        )}
      </div>

      <div className="card mb-20">
        <div className="font-display fw-600 text-white mb-12" style={{ fontSize: 14 }}>
          Recent session logs
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
          <div>
            <label className="form-label">From</label>
            <input className="form-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="form-label">To</label>
            <input className="form-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <button type="button" className="btn btn-primary btn-sm" disabled={loadingSessions} onClick={() => loadSessions()}>
            {loadingSessions ? 'Loading…' : 'Apply filter'}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={loadingSessions}
            onClick={() => {
              setDateFrom('')
              setDateTo('')
            }}
          >
            Clear
          </button>
        </div>
        <div style={{ overflowX: 'auto', opacity: loadingSessions ? 0.65 : 1 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Tutor</th>
                <th>Class</th>
                <th>Track</th>
                <th>Lesson / module</th>
                <th>Started</th>
                <th>Duration</th>
                <th>Students</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((row: any) => {
                const tutorName = `${row.tutor?.firstName || ''} ${row.tutor?.lastName || ''}`.trim() || '—'
                const started = row.startedAt ? new Date(row.startedAt) : null
                return (
                  <tr key={row.id}>
                    <td style={{ fontWeight: 600, color: 'var(--white)', whiteSpace: 'nowrap' }}>{tutorName}</td>
                    <td>{row.className || '—'}</td>
                    <td style={{ fontSize: 12 }}>{trackLabel(row.track)}</td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{sessionModuleCell(row)}</td>
                    <td style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {started
                        ? `${started.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })} ${started.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}`
                        : '—'}
                    </td>
                    <td>{row.durationMins != null ? `${row.durationMins} min` : row.endedAt ? '—' : 'In progress'}</td>
                    <td>{row.studentsPresent ?? '—'}</td>
                  </tr>
                )
              })}
              {sessions.length === 0 && !loadingSessions && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>
                    No sessions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
