'use client'

type RubricRow = {
  id?: string
  title: string
  score: number
  maxPoints: number
  detail?: string
  feedback?: string
}

export function StudentRubricBreakdown({ submission }: { submission: any }) {
  if (!submission) return null

  const breakdown: RubricRow[] =
    submission.scoreBreakdown?.breakdown ||
    submission.aiScoreBreakdown?.breakdown ||
    []

  if (!Array.isArray(breakdown) || breakdown.length === 0) return null

  return (
    <div
      style={{
        marginTop: 10,
        padding: '10px 12px',
        borderRadius: 8,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--border2)',
      }}
    >
      <div className="text-xs" style={{ fontWeight: 600, color: 'var(--white)', marginBottom: 8 }}>
        Rubric breakdown
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {breakdown.map((row, i) => (
          <div key={row.id || i} className="text-xs text-muted" style={{ lineHeight: 1.5 }}>
            <span style={{ color: 'var(--white)' }}>{row.title}</span>
            {' — '}
            {row.score}/{row.maxPoints}
            {row.detail ? ` · ${row.detail}` : row.feedback ? ` · ${row.feedback}` : ''}
          </div>
        ))}
      </div>
    </div>
  )
}
