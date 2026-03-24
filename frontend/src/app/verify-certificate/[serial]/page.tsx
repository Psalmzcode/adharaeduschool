'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { certificatesApi } from '@/lib/api'

export default function VerifyCertPage({ params }: { params: { serial: string } }) {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    certificatesApi
      .verify(params.serial)
      .then(setResult)
      .catch(() => setResult({ valid: false, message: 'Verification failed' }))
      .finally(() => setLoading(false))
  }, [params.serial])

  const ok = result?.valid
  const fail = result && !result?.valid && !loading

  const ringClass =
    loading || (!ok && !fail)
      ? 'verify-cert-page__ring--pending'
      : ok
        ? 'verify-cert-page__ring--ok'
        : 'verify-cert-page__ring--fail'

  return (
    <div className="verify-cert-page">
      <div className={`verify-cert-page__ring ${ringClass}`}>
        <div className="verify-cert-page__card">
          <div className="verify-cert-page__eyebrow">AdharaEdu · Certificate verification</div>

          {loading && (
            <>
              <div style={{ fontSize: 52, marginBottom: 16, filter: 'grayscale(0.2)' }}>🔍</div>
              <h1 className="verify-cert-page__title" style={{ fontSize: 22 }}>
                Verifying…
              </h1>
              <p className="text-muted text-sm" style={{ margin: 0 }}>
                Checking serial{' '}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{params.serial}</span>
              </p>
            </>
          )}

          {!loading && ok && (
            <>
              <div className="verify-cert-page__icon-ok">✓</div>
              <div className="verify-cert-page__badge-authentic">AUTHENTIC</div>
              <h1 className="verify-cert-page__title" style={{ fontSize: 24 }}>
                Verified credential
              </h1>
              <p className="text-muted text-sm" style={{ margin: '0 0 28px', lineHeight: 1.6 }}>
                This serial number matches an issued AdharaEdu certificate on record.
              </p>

              <div className="verify-cert-page__detail-panel">
                {(
                  [
                    ['Student', result.certificate.studentName],
                    ['School', result.certificate.school],
                    ['Track', result.certificate.track],
                    ['Average score', `${result.certificate.averageScore}%`],
                    [
                      'Issued',
                      new Date(result.certificate.issueDate).toLocaleDateString('en-NG', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      }),
                    ],
                    ['Serial', result.certificate.serialNumber],
                  ] as const
                ).map(([label, value]) => (
                  <div key={String(label)} className="verify-cert-page__row">
                    <span className="verify-cert-page__label">{label}</span>
                    <span
                      className={`verify-cert-page__value ${label === 'Serial' ? 'verify-cert-page__value--serial' : ''}`}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              {result.certificate.pdfUrl ? (
                <a
                  href={result.certificate.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{
                    marginTop: 24,
                    width: '100%',
                    justifyContent: 'center',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    textDecoration: 'none',
                  }}
                >
                  View official certificate (PDF)
                </a>
              ) : (
                <p className="text-muted text-sm verify-cert-page__hint" style={{ margin: '20px 0 0', lineHeight: 1.55 }}>
                  The printable certificate file (PDF) is available from the student&apos;s{' '}
                  <strong>Dashboard → My Certificates</strong> when upload completed, or from the email sent at issue time.
                </p>
              )}
            </>
          )}

          {!loading && fail && (
            <>
              <div className="verify-cert-page__icon-fail">✕</div>
              <h1 className="verify-cert-page__title" style={{ fontSize: 22 }}>
                Not verified
              </h1>
              <p className="text-muted text-sm" style={{ margin: 0, lineHeight: 1.65 }}>
                {result?.message ||
                  'This certificate could not be verified. It may be invalid, revoked, or the serial mistyped.'}
              </p>
            </>
          )}

          <div className="verify-cert-page__footer">
            <Link href="/" style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              ← AdharaEdu home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
