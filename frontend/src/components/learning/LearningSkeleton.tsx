'use client'

export function LearningSkeleton() {
  return (
    <div className="learning-skeleton-wrap" aria-hidden="true">
      <div className="skeleton learning-hero-skeleton" />
      <div className="learning-now-next-skeleton">
        <div className="skeleton" style={{ height: 88, borderRadius: 12 }} />
        <div className="skeleton" style={{ height: 88, borderRadius: 12 }} />
      </div>
      <div className="card">
        <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 16 }} />
        {[1, 2, 3].map((i) => (
          <div key={i} className="learning-timeline-row-skeleton">
            <div className="skeleton skeleton-circle" />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 12, width: '70%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 10, width: '90%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
