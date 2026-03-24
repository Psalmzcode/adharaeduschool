'use client'

import { useEffect, useState, useMemo } from 'react'
import { classPerformanceApi, schoolClassesApi } from '@/lib/api'

export type ClassPerformanceChoice = {
  schoolId: string
  className: string
  track: string
  label: string
}

function trackLabel(t: string) {
  return String(t || '').replace(/^TRACK_/i, 'Track ')
}

/** Unique per school + track + class (tutors may teach same class name at multiple schools). */
function choiceKey(o: ClassPerformanceChoice) {
  return `${o.schoolId}::${o.track}::${o.className}`
}

export function ClassPerformancePanel({
  /** Load class list from this school (super admin / school admin). */
  schoolIdForFetch,
  /** Tutor: one entry per assigned class (includes schoolId). */
  presetChoices,
}: {
  schoolIdForFetch?: string | null
  presetChoices?: ClassPerformanceChoice[]
}) {
  const [fetched, setFetched] = useState<ClassPerformanceChoice[]>([])
  const [loadingClasses, setLoadingClasses] = useState(false)
  const [slot, setSlot] = useState('')
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [err, setErr] = useState('')

  const options = useMemo(() => {
    if (presetChoices?.length) return presetChoices
    return fetched
  }, [presetChoices, fetched])

  useEffect(() => {
    if (presetChoices?.length || !schoolIdForFetch) {
      setFetched([])
      return
    }
    let cancelled = false
    setLoadingClasses(true)
    schoolClassesApi
      .all(schoolIdForFetch)
      .then((rows: any[]) => {
        if (cancelled) return
        const arr = Array.isArray(rows) ? rows : []
        const byKey = new Map<string, ClassPerformanceChoice>()
        for (const r of arr) {
          const cn = String(r.className || '').trim()
          const tr = String(r.track || '').trim()
          if (!cn || !tr) continue
          const k = `${tr}::${cn}`
          if (!byKey.has(k)) {
            byKey.set(k, {
              schoolId: schoolIdForFetch,
              className: cn,
              track: tr,
              label: `${cn} · ${trackLabel(tr)}`,
            })
          }
        }
        setFetched(Array.from(byKey.values()))
      })
      .catch(() => {
        if (!cancelled) setFetched([])
      })
      .finally(() => {
        if (!cancelled) setLoadingClasses(false)
      })
    return () => {
      cancelled = true
    }
  }, [schoolIdForFetch, presetChoices?.length])

  useEffect(() => {
    setSlot('')
    setData(null)
    setErr('')
  }, [schoolIdForFetch, presetChoices])

  const load = async () => {
    const sel = options.find((o) => choiceKey(o) === slot)
    if (!sel) {
      setErr('Select a class')
      return
    }
    setLoading(true)
    setErr('')
    try {
      const r = await classPerformanceApi.rollup({
        schoolId: sel.schoolId,
        className: sel.className,
        track: sel.track,
        days,
      })
      setData(r)
    } catch (e: any) {
      setErr(e.message || 'Failed to load')
      setData(null)
    }
    setLoading(false)
  }

  const disabled = !options.length

  return (
    <div>
      <div className="card mb-20" style={{ maxWidth: 720 }}>
        <div className="font-display fw-600 text-white mb-12" style={{ fontSize: 15 }}>Filters</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ minWidth: 220, flex: 1 }}>
            <label className="form-label">Class</label>
            <select
              className="form-input"
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              disabled={disabled || loadingClasses}
            >
              <option value="">{loadingClasses ? 'Loading classes…' : options.length ? 'Select class' : 'No classes'}</option>
              {options.map((o) => (
                <option key={choiceKey(o)} value={choiceKey(o)}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Attendance window (days)</label>
            <input
              type="number"
              min={7}
              max={365}
              className="form-input"
              style={{ width: 100 }}
              value={days}
              onChange={(e) => setDays(Math.min(365, Math.max(7, parseInt(e.target.value, 10) || 30)))}
            />
          </div>
          <button type="button" className="btn btn-primary btn-sm" disabled={loading || !slot} onClick={() => load()}>
            {loading ? 'Loading…' : 'Load report'}
          </button>
        </div>
        {err && <p className="text-muted text-sm mt-12" style={{ color: '#F87171' }}>{err}</p>}
      </div>

      {data?.message && (
        <div className="card mb-20">
          <p className="text-muted text-sm">{data.message}</p>
        </div>
      )}

      {data && !data.message && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="flex-between" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h4 className="font-display fw-700 text-white" style={{ fontSize: 18 }}>
                {data.school?.name} · {data.className}
              </h4>
              <p className="text-muted text-sm">
                {trackLabel(data.track)} · {data.studentCount} student{data.studentCount === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <div className="stats-row" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            <div className="stat-card">
              <div className="stat-card-label">Attendance ({data.windowDays}d)</div>
              <div className="stat-card-value">
                {data.attendance?.ratePercent != null ? `${data.attendance.ratePercent}%` : '—'}
              </div>
              <span className="stat-card-trend">
                {data.attendance?.totalMarks ?? 0} marks · P {data.attendance?.present ?? 0} / A {data.attendance?.absent ?? 0} / L{' '}
                {data.attendance?.late ?? 0}
              </span>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Curriculum focus</div>
              <div className="stat-card-value" style={{ fontSize: 16 }}>
                {data.modules?.currentModule ? `Mod ${data.modules.currentModule.number}` : data.modules?.completedAll ? 'Done' : '—'}
              </div>
              <span className="stat-card-trend">
                {data.modules?.currentModule?.title || (data.modules?.completedAll ? 'All modules completed' : 'No module data')}
              </span>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Avg grades (where recorded)</div>
              <div className="stat-card-value" style={{ fontSize: 15 }}>
                {[
                  data.grades?.classAssignments?.avgScore,
                  data.grades?.moduleAssignments?.avgScore,
                  data.grades?.cbt?.avgScore,
                  data.grades?.practicals?.avgScore,
                ].filter((x) => x != null).length
                  ? 'See below'
                  : '—'}
              </div>
              <span className="stat-card-trend">Class work, modules, CBT, practicals</span>
            </div>
          </div>

          <div className="card">
            <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 15 }}>Module progress (class)</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Module</th>
                    <th>Completed</th>
                    <th>In progress</th>
                    <th>Failed</th>
                    <th>Not started</th>
                    <th>Avg score</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.modules?.moduleBreakdown || []).map((m: any) => (
                    <tr key={m.moduleId}>
                      <td style={{ fontWeight: 600, color: 'var(--white)' }}>
                        {m.number}. {m.title}
                      </td>
                      <td>{m.completed}</td>
                      <td>{m.inProgress}</td>
                      <td>{m.failed}</td>
                      <td>{m.notStarted}</td>
                      <td>{m.avgScore != null ? m.avgScore : '—'}</td>
                    </tr>
                  ))}
                  {!(data.modules?.moduleBreakdown || []).length && (
                    <tr>
                      <td colSpan={6} className="text-muted text-sm" style={{ textAlign: 'center', padding: 24 }}>
                        No modules for this track
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 15 }}>Graded work (averages)</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Count</th>
                  <th>Avg score</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Class assignments (homework)</td>
                  <td>{data.grades?.classAssignments?.gradedCount ?? 0} graded</td>
                  <td>{data.grades?.classAssignments?.avgScore != null ? `${data.grades.classAssignments.avgScore}%` : '—'}</td>
                </tr>
                <tr>
                  <td>Module assignments (curriculum)</td>
                  <td>{data.grades?.moduleAssignments?.gradedCount ?? 0} graded</td>
                  <td>{data.grades?.moduleAssignments?.avgScore != null ? `${data.grades.moduleAssignments.avgScore}%` : '—'}</td>
                </tr>
                <tr>
                  <td>CBT (completed attempts)</td>
                  <td>{data.grades?.cbt?.completedAttempts ?? 0}</td>
                  <td>{data.grades?.cbt?.avgScore != null ? `${data.grades.cbt.avgScore}%` : '—'}</td>
                </tr>
                <tr>
                  <td>Practicals</td>
                  <td>{data.grades?.practicals?.gradedCount ?? 0} graded</td>
                  <td>{data.grades?.practicals?.avgScore != null ? `${data.grades.practicals.avgScore}%` : '—'}</td>
                </tr>
              </tbody>
            </table>
            <p className="text-muted text-xs mt-12" style={{ lineHeight: 1.5 }}>
              Averages are simple means of stored scores for students in this class. Empty means no graded records yet.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
