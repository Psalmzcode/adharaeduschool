'use client'

import Link from 'next/link'
import { formatSchoolType, formatTrack } from '@/lib/schoolProfileLabels'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(140px, 220px) 1fr',
        gap: 16,
        padding: '12px 0',
        borderBottom: '1px solid var(--border2)',
        alignItems: 'start',
      }}
    >
      <div className="text-muted" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: 'var(--white)', wordBreak: 'break-word' }}>{children}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="font-display fw-700 text-white mb-16" style={{ fontSize: 16 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

export function SchoolProfileView({ school }: { school: any | null }) {
  if (!school) {
    return (
      <div className="card">
        <p className="text-muted">Loading school…</p>
      </div>
    )
  }

  const completed = !!school.profileCompletedAt
  const displayName = school.name || school.officialName || '—'
  const official = school.officialName || '—'
  const levels: string[] = Array.isArray(school.platformLevels) ? school.platformLevels : []
  const tracks: string[] = Array.isArray(school.enrolledTracks) ? school.enrolledTracks : []

  return (
    <div style={{ maxWidth: 880 }}>
      {!completed && (
        <div
          className="card"
          style={{
            marginBottom: 20,
            border: '1px solid rgba(245, 158, 11, 0.35)',
            background: 'rgba(245, 158, 11, 0.08)',
          }}
        >
          <p className="text-white" style={{ fontWeight: 600, marginBottom: 8 }}>
            Finish your school profile
          </p>
          <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
            Some onboarding details are still missing. Complete the form so AdharaEdu can configure your school correctly.
          </p>
          <Link href="/dashboard/admin/complete-school-profile" className="btn btn-primary btn-sm">
            Complete profile →
          </Link>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', marginBottom: 20 }}>
        {school.logoUrl ? (
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 16,
              overflow: 'hidden',
              border: '1px solid var(--border2)',
              flexShrink: 0,
              background: 'var(--muted3)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={school.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        ) : (
          <div
            className="text-muted text-sm"
            style={{
              width: 96,
              height: 96,
              borderRadius: 16,
              border: '1px dashed var(--border2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: 8,
            }}
          >
            No logo
          </div>
        )}
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 className="font-display fw-800 text-white" style={{ fontSize: 22, marginBottom: 6 }}>
            {displayName}
          </h1>
          <p className="text-muted text-sm" style={{ marginBottom: 8 }}>
            {official !== displayName ? <span>Official: {official}</span> : <span>Official name on file</span>}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <span className={`badge badge-${school.status === 'APPROVED' ? 'success' : school.status === 'PENDING' ? 'warning' : 'danger'}`}>
              {school.status || '—'}
            </span>
            {completed && (
              <span className="text-muted text-xs">
                Profile completed{' '}
                {school.profileCompletedAt
                  ? new Date(school.profileCompletedAt).toLocaleDateString('en-NG', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : ''}
              </span>
            )}
          </div>
        </div>
        <Link href="/dashboard/admin/complete-school-profile" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}>
          Edit profile
        </Link>
      </div>

      <Section title="Identity & presence">
        <Row label="School type">{formatSchoolType(school.schoolType)}</Row>
        <Row label="Website">
          {school.website ? (
            <a href={school.website.startsWith('http') ? school.website : `https://${school.website}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)' }}>
              {school.website}
            </a>
          ) : (
            '—'
          )}
        </Row>
        <Row label="Official email">{school.officialEmail || school.admins?.[0]?.email || '—'}</Row>
        <Row label="Official phone">{school.officialPhone || '—'}</Row>
        <Row label="School address">{school.address?.trim() || '—'}</Row>
      </Section>

      <Section title="Leadership & contacts">
        <Row label="Principal / head">{school.principalName || '—'}</Row>
        <Row label="Principal phone">{school.principalPhone || '—'}</Row>
        <Row label="ICT contact">
          {[school.ictContactName, school.ictContactPhone, school.ictContactEmail].filter(Boolean).length ? (
            <span>
              {[school.ictContactName, school.ictContactPhone, school.ictContactEmail].filter(Boolean).join(' · ')}
            </span>
          ) : (
            '—'
          )}
        </Row>
        <Row label="Billing contact">
          {[school.billingContactName, school.billingContactEmail, school.billingContactPhone].filter(Boolean).length ? (
            <span>
              {[school.billingContactName, school.billingContactEmail, school.billingContactPhone].filter(Boolean).join(' · ')}
            </span>
          ) : (
            '—'
          )}
        </Row>
      </Section>

      <Section title="Program on AdharaEdu">
        <Row label="Class levels on platform">{levels.length ? levels.join(', ') : '—'}</Row>
        <Row label="Tracks (curriculum)">
          {tracks.length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {tracks.map((t) => (
                <li key={t} style={{ marginBottom: 4 }}>
                  {formatTrack(t)}
                </li>
              ))}
            </ul>
          ) : (
            '—'
          )}
        </Row>
        <Row label="Current term">{school.currentTermLabel || '—'}</Row>
        <Row label="Academic year">{school.academicYearLabel || '—'}</Row>
      </Section>

      <Section title="Scale">
        <Row label="Approx. student count">{school.studentCountBand || '—'}</Row>
        <Row label="Classes / streams">{school.streamsCount != null ? String(school.streamsCount) : '—'}</Row>
      </Section>

      <Section title="Site / visit notes">
        <p style={{ fontSize: 14, color: 'var(--white)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
          {school.visitDeploymentNotes?.trim() || '—'}
        </p>
      </Section>
    </div>
  )
}
