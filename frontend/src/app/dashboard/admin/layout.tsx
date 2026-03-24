'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { schoolsApi } from '@/lib/api'

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [gateReady, setGateReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const onPending = pathname?.includes('/pending-approval')
    const onComplete = pathname?.includes('/complete-school-profile')

    ;(async () => {
      try {
        const s = await schoolsApi.mine()
        if (cancelled) return

        if (s.status === 'PENDING') {
          if (!onPending) router.replace('/dashboard/admin/pending-approval')
          setGateReady(true)
          return
        }
        if (s.status === 'REJECTED' || s.status === 'SUSPENDED') {
          if (!onPending) {
            router.replace(`/dashboard/admin/pending-approval?status=${encodeURIComponent(s.status)}`)
          }
          setGateReady(true)
          return
        }
        if (s.status === 'APPROVED' && !s.profileCompletedAt) {
          if (!onComplete && !onPending) {
            router.replace('/dashboard/admin/complete-school-profile')
            setGateReady(true)
            return
          }
          setGateReady(true)
          return
        }
        // Note: do NOT redirect away from /complete-school-profile when profileCompletedAt is set —
        // school admins must be able to open that page again to edit (School profile → Edit profile).
        if (s.status === 'PENDING' && onComplete) {
          router.replace('/dashboard/admin/pending-approval')
          setGateReady(true)
          return
        }
      } catch {
        /* not logged in as school admin — page may 401 elsewhere */
      }
      if (!cancelled) setGateReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [pathname, router])

  if (!gateReady) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy)' }}>
        <p className="text-muted">Loading…</p>
      </div>
    )
  }

  return <>{children}</>
}
