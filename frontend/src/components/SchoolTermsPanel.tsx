'use client'

import { useCallback, useEffect, useState } from 'react'
import { schoolTermsApi } from '@/lib/api'
import { notify } from '@/lib/notify'

function formatDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function SchoolTermsPanel({
  schoolId,
  school,
  onSchoolUpdated,
}: {
  schoolId: string
  school?: any
  onSchoolUpdated?: (next: any) => void
}) {
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<any>(null)
  const [terms, setTerms] = useState<any[]>([])
  const [year, setYear] = useState('')
  const [termOrdinal, setTermOrdinal] = useState(2)
  const [cloneAssignments, setCloneAssignments] = useState(true)
  const [updateStudents, setUpdateStudents] = useState(true)
  const [busy, setBusy] = useState<'start' | 'end' | null>(null)

  const load = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    try {
      const data = await schoolTermsApi.list(schoolId)
      setActive(data?.active ?? null)
      setTerms(Array.isArray(data?.terms) ? data.terms : [])
    } catch (e: any) {
      notify.fromError(e, 'Could not load terms')
      setActive(null)
      setTerms([])
    }
    setLoading(false)
  }, [schoolId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const y = String(school?.academicYearLabel || '').trim() || '2025/2026'
    setYear(y)
    const cur = String(school?.currentTermLabel || '')
    const m = cur.match(/term\s*(\d)/i)
    if (m) {
      const n = Number(m[1])
      if ([1, 2, 3].includes(n)) setTermOrdinal(Math.min(3, n + 1) as 1 | 2 | 3)
    }
  }, [school?.academicYearLabel, school?.currentTermLabel])

  const startTerm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!year.trim()) {
      notify.warning('Enter academic year label')
      return
    }
    setBusy('start')
    try {
      const res = await schoolTermsApi.start(schoolId, {
        academicYearLabel: year.trim(),
        termOrdinal,
        cloneTutorAssignments: cloneAssignments,
        updateStudentTermLabels: updateStudents,
      })
      notify.success(res?.message || 'Term started')
      if (onSchoolUpdated && res?.term) {
        onSchoolUpdated({
          ...school,
          academicYearLabel: year.trim(),
          currentTermLabel: res.term.label,
        })
      }
      await load()
    } catch (err: any) {
      notify.fromError(err, 'Could not start term')
    }
    setBusy(null)
  }

  const endTerm = async () => {
    if (!active) return
    if (!window.confirm(`End active term "${active.label}"? Tutor assignments for this term will be deactivated.`)) return
    setBusy('end')
    try {
      const res = await schoolTermsApi.end(schoolId)
      notify.success(res?.message || 'Term ended')
      await load()
    } catch (err: any) {
      notify.fromError(err, 'Could not end term')
    }
    setBusy(null)
  }

  return (
    <div>
      <div className="flex-between mb-20">
        <div>
          <h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>
            Academic terms
          </h3>
          <div className="text-muted text-sm" style={{ maxWidth: 560, lineHeight: 1.55 }}>
            Manage the school year in three terms. Starting a new term ends the current one, updates student term labels, and can roll tutor class assignments forward.
          </div>
        </div>
      </div>

      <div className="card mb-20">
        <div className="font-display fw-600 text-white mb-12" style={{ fontSize: 15 }}>
          Current term
        </div>
        {loading ? (
          <p className="text-muted text-sm">Loading…</p>
        ) : active ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
            <div>
              <div className="text-xs text-muted mb-4">Active</div>
              <div className="font-display fw-700 text-white" style={{ fontSize: 18 }}>{active.label}</div>
              <div className="text-muted text-xs mt-4">
                Started {formatDate(active.startedAt)}
              </div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy === 'end'} onClick={endTerm}>
              {busy === 'end' ? 'Ending…' : 'End current term'}
            </button>
          </div>
        ) : (
          <p className="text-muted text-sm">No active term. Start one below.</p>
        )}
      </div>

      <div className="card mb-20">
        <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 15 }}>
          Start next term
        </div>
        <form onSubmit={startTerm} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
            <div>
              <label className="form-label">Academic year</label>
              <input className="form-input" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2025/2026" required />
            </div>
            <div>
              <label className="form-label">Term</label>
              <select className="form-input" value={termOrdinal} onChange={(e) => setTermOrdinal(Number(e.target.value) as 1 | 2 | 3)} style={{ appearance: 'none' }}>
                <option value={1}>Term 1</option>
                <option value={2}>Term 2</option>
                <option value={3}>Term 3</option>
              </select>
            </div>
          </div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', fontSize: 13, color: 'var(--muted)' }}>
            <input type="checkbox" checked={cloneAssignments} onChange={(e) => setCloneAssignments(e.target.checked)} style={{ marginTop: 3, accentColor: 'var(--teal)' }} />
            Clone active tutor class assignments into the new term
          </label>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', fontSize: 13, color: 'var(--muted)' }}>
            <input type="checkbox" checked={updateStudents} onChange={(e) => setUpdateStudents(e.target.checked)} style={{ marginTop: 3, accentColor: 'var(--teal)' }} />
            Update all students&apos; term label to the new term
          </label>
          <button type="submit" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }} disabled={busy === 'start'}>
            {busy === 'start' ? 'Starting…' : 'Start term →'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="font-display fw-600 text-white mb-12" style={{ fontSize: 14 }}>
          Term history
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Term</th>
                <th>Status</th>
                <th>Started</th>
                <th>Ended</th>
              </tr>
            </thead>
            <tbody>
              {terms.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600, color: 'var(--white)' }}>{t.label}</td>
                  <td>
                    <span className={`badge ${t.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 10 }}>
                      {t.status === 'ACTIVE' ? 'Active' : 'Ended'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{formatDate(t.startedAt)}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{formatDate(t.endedAt)}</td>
                </tr>
              ))}
              {!loading && terms.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0' }}>
                    No terms recorded yet.
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
