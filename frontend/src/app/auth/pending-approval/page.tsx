'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function PendingApprovalInner() {
  const search = useSearchParams()
  const name = search.get('name')?.trim() || ''

  return (
    <div id="page-pending-approval" className="auth-page active">
      <div className="auth-left">
        <div className="auth-left-bg"></div>
        <div className="auth-left-grid"></div>
        <div className="auth-left-content">
          <Link href="/" className="nav-logo" style={{ marginBottom: 48, display: 'inline-flex', textDecoration: 'none' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 50" height="40" width="200">
              <rect x="1" y="4" width="38" height="40" rx="12" ry="14" fill="#1E7FD4" />
              <polygon points="20,10 23.5,18.5 33,18.5 25.5,24 28.5,33 20,27.5 11.5,33 14.5,24 7,18.5 16.5,18.5" fill="#F5C518" />
              <text x="46" y="33" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="26" fill="var(--white)">Adhara</text>
              <text x="153" y="14" fontFamily="Arial,sans-serif" fontWeight="700" fontStyle="italic" fontSize="12" fill="#1E7FD4">Edu</text>
            </svg>
          </Link>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 800, marginBottom: 16, color: 'var(--white)' }}>Registration received</h2>
          <p style={{ fontSize: 16, color: 'var(--muted)', marginBottom: 24, lineHeight: 1.8 }}>
            Your school account is created and waiting for AdharaEdu review. You will receive an email when your school is approved.
          </p>
        </div>
      </div>
      <div className="auth-right" style={{ overflowY: 'auto', padding: '40px 60px' }}>
        <div className="auth-form-box" style={{ maxWidth: 460 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(245,158,11,0.15)',
              border: '1px solid rgba(245,158,11,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              marginBottom: 24,
            }}
          >
            ⏳
          </div>
          <h2 style={{ marginBottom: 12 }}>Pending approval</h2>
          <p style={{ fontSize: 15, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 20 }}>
            {name ? (
              <>
                <strong style={{ color: 'var(--white)' }}>{name}</strong> is on our review queue. Until then, you cannot sign in to the admin dashboard.
              </>
            ) : (
              <>Your school is on our review queue. Until then, you cannot sign in to the admin dashboard.</>
            )}
          </p>
          <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.65, marginBottom: 28 }}>
            If you need to change the contact email before approval, ask your AdharaEdu super admin to update it from the school list, or contact support.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Link href="/auth/login" className="btn btn-primary" style={{ justifyContent: 'center', textDecoration: 'none' }}>
              Back to sign in
            </Link>
            <Link href="/" className="btn btn-ghost" style={{ justifyContent: 'center', textDecoration: 'none' }}>
              ← Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PendingApprovalPage() {
  return (
    <Suspense fallback={<div className="auth-page active" style={{ padding: 40, color: 'var(--muted)' }}>Loading…</div>}>
      <PendingApprovalInner />
    </Suspense>
  )
}
