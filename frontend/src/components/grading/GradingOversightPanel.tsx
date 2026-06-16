'use client'

import { useQuery } from '@tanstack/react-query'
import { evidenceGradingApi } from '@/lib/api'

export function GradingOversightPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['sa', 'grading-oversight'],
    queryFn: () => evidenceGradingApi.oversight(),
    staleTime: 30_000,
    retry: 1,
  })

  if (isLoading) return <p className="text-muted text-sm">Loading AI grading oversight…</p>
  if (!data?.summary) {
    return <p className="text-muted text-sm">No grading oversight data available.</p>
  }

  const issues = Array.isArray(data.extractionIssues) ? data.extractionIssues : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="stats-row">
        {[
          { label: 'Extraction issues', val: data.summary.extractionIssues, icon: '⚠️' },
          { label: 'Failed extractions', val: data.summary.failed, icon: '✕' },
          { label: 'Stale pending (>30m)', val: data.summary.stalePending, icon: '⏳' },
          { label: 'AI review pending', val: data.summary.aiReviewPending, icon: '🤖' },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-card-icon" style={{ background: 'rgba(212,168,83,0.15)' }}>{s.icon}</div>
            <div className="stat-card-value">{s.val}</div>
            <div className="stat-card-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="font-display fw-700 text-white mb-12" style={{ fontSize: 16 }}>
          Extraction failures &amp; stale pending
        </div>
        <p className="text-muted text-sm mb-16" style={{ lineHeight: 1.55 }}>
          Submissions where evidence could not be extracted, or extraction has been pending for more than 30 minutes.
          Tutors should grade these manually or ask students to resubmit.
        </p>
        {issues.length === 0 ? (
          <p className="text-muted text-sm">No extraction issues right now.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Task</th>
                <th>Student</th>
                <th>Class</th>
                <th>Status</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((row: any) => (
                <tr key={`${row.kind}-${row.submissionId}`}>
                  <td>{row.kind}</td>
                  <td>{row.parentTitle}</td>
                  <td>{row.studentLabel}</td>
                  <td>{row.className}</td>
                  <td>
                    <span className={`badge badge-${row.extractionStatus === 'failed' ? 'danger' : 'warning'}`}>
                      {row.extractionStatus}
                    </span>
                  </td>
                  <td className="text-muted text-xs" style={{ maxWidth: 280, whiteSpace: 'normal' }}>
                    {row.extractionError || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="font-display fw-700 text-white mb-8" style={{ fontSize: 15 }}>AI review backlog</div>
        <div className="text-sm text-muted" style={{ lineHeight: 1.6 }}>
          Practicals awaiting tutor approval: <strong style={{ color: 'var(--white)' }}>{data.aiReview?.practicalPending ?? 0}</strong>
          <br />
          Assignments awaiting tutor approval: <strong style={{ color: 'var(--white)' }}>{data.aiReview?.assignmentPending ?? 0}</strong>
          <br />
          Flagged for manual review: <strong style={{ color: 'var(--warning)' }}>{data.aiReview?.manualReviewRequired ?? 0}</strong>
        </div>
      </div>
    </div>
  )
}
