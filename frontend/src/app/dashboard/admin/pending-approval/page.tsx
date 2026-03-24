'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function PendingInner() {
  const searchParams = useSearchParams()
  const status = searchParams.get('status') || 'PENDING'

  const title =
    status === 'REJECTED'
      ? 'Registration not approved'
      : status === 'SUSPENDED'
        ? 'School account suspended'
        : 'Awaiting approval'

  const body =
    status === 'REJECTED'
      ? 'Your school registration was not approved. If you believe this is a mistake, contact AdharaEdu support.'
      : status === 'SUSPENDED'
        ? 'This school account has been suspended. Contact AdharaEdu support for assistance.'
        : 'Thank you for registering. The AdharaEdu team will review your school shortly. You’ll receive an email when your account is approved — then you can complete your school profile and use the full dashboard.'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--navy)', padding: '48px 24px' }}>
      <div className="card" style={{ maxWidth: 520, margin: '0 auto', padding: '32px 28px' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>{status === 'PENDING' ? '⏳' : '⚠️'}</div>
        <h1 className="font-display fw-700 text-white" style={{ fontSize: 22, marginBottom: 12 }}>
          {title}
        </h1>
        <p className="text-muted" style={{ lineHeight: 1.6, marginBottom: 24 }}>
          {body}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <Link href="/auth/login" className="btn btn-ghost btn-sm">
            Back to sign in
          </Link>
          <Link href="/" className="btn btn-primary btn-sm">
            Website home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function PendingApprovalPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy)' }}>
          <p className="text-muted">Loading…</p>
        </div>
      }
    >
      <PendingInner />
    </Suspense>
  )
}
