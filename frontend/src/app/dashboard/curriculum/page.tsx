'use client'

import { Suspense } from 'react'
import SuperAdminDashboard from '../superadmin/page'

/** Curriculum Lead portal — modules, lessons, materials (no schools/finance). */
export default function CurriculumLeadDashboard() {
  return (
    <Suspense
      fallback={(
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy)' }}>
          <p className="text-muted">Loading curriculum portal…</p>
        </div>
      )}
    >
      <SuperAdminDashboard mode="curriculum" />
    </Suspense>
  )
}
