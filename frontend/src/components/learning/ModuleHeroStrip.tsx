'use client'

type Props = {
  moduleNumber?: number
  title?: string
  status?: string
  score?: number | null
}

export function ModuleHeroStrip({ moduleNumber, title, status, score }: Props) {
  const statusLabel =
    status === 'COMPLETED'
      ? 'Completed'
      : status === 'IN_PROGRESS'
        ? 'In progress'
        : status === 'FAILED'
          ? 'Retake'
          : status || 'Active'

  const badgeClass =
    status === 'COMPLETED'
      ? 'badge-success'
      : status === 'IN_PROGRESS'
        ? 'badge-warning'
        : status === 'FAILED'
          ? 'badge-danger'
          : 'badge-info'

  return (
    <section className="learning-hero">
      <div className="learning-hero-glow" aria-hidden="true" />
      <div className="learning-hero-inner">
        <div>
          <div className="learning-hero-eyebrow">Active module</div>
          <h2 className="learning-hero-title">
            {moduleNumber != null && <span className="learning-hero-mod">Module {moduleNumber}</span>}
            {title}
          </h2>
        </div>
        <div className="learning-hero-meta">
          <span className={`badge ${badgeClass}`}>{statusLabel}</span>
          {score != null && (
            <div className="learning-hero-score">
              <span className="text-muted text-xs">Score</span>
              <strong>{score}%</strong>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
