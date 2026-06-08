'use client'

import { useCallback, useEffect, useState } from 'react'
import { academicAuditApi } from '@/lib/api'

const ACTION_LABELS: Record<string, string> = {
  MODULE_ADVANCE: 'Module advance',
  MODULE_RETAKE: 'Module retake',
  MODULE_SCORE_UPDATE: 'Score update',
  PRACTICAL_GRADE: 'Practical grade',
  ASSIGNMENT_GRADE: 'Assignment grade',
  BULK_CERT_ISSUE: 'Bulk certificates',
  CERT_ISSUE: 'Certificate issued',
  CERT_REVOKE: 'Certificate revoked',
}

export function AcademicAuditPanel({ schoolId }: { schoolId?: string }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [classFilter, setClassFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await academicAuditApi.list({
        schoolId: schoolId || undefined,
        className: classFilter.trim() || undefined,
        limit: 150,
      })
      setRows(Array.isArray(data) ? data : [])
    } catch {
      setRows([])
    }
    setLoading(false)
  }, [schoolId, classFilter])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      <div className="flex-between mb-20">
        <div>
          <h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>
            Academic audit log
          </h3>
          <div className="text-muted text-sm" style={{ maxWidth: 560, lineHeight: 1.55 }}>
            Who advanced modules, graded work, issued certificates — for school accountability.
          </div>
        </div>
      </div>

      <div className="card mb-20">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label className="form-label">Filter by class</label>
            <input
              className="form-input"
              style={{ maxWidth: 160 }}
              placeholder="e.g. SS3A"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
            />
          </div>
          <button type="button" className="btn btn-primary btn-sm" disabled={loading} onClick={load}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Summary</th>
                <th>Actor</th>
                <th>Class</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const actorName = r.actor
                  ? `${r.actor.firstName || ''} ${r.actor.lastName || ''}`.trim() || r.actor.email
                  : '—'
                return (
                  <tr key={r.id}>
                    <td style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {new Date(r.createdAt).toLocaleString('en-NG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>
                      <span className="badge badge-teal" style={{ fontSize: 10 }}>
                        {ACTION_LABELS[r.action] || r.action}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--white)', maxWidth: 360 }}>{r.summary}</td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {actorName}
                      <div className="text-muted text-xs">{String(r.actorRole || '').replace(/_/g, ' ')}</div>
                    </td>
                    <td style={{ fontSize: 12 }}>{r.className || '—'}</td>
                  </tr>
                )
              })}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>
                    No audit entries yet.
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
