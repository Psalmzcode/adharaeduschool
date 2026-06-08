'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function VerifyRedirectInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initial = searchParams.get('serial') || searchParams.get('code') || ''
  const [serial, setSerial] = useState(initial)

  useEffect(() => {
    const code = initial.trim()
    if (code) {
      router.replace(`/verify-certificate/${encodeURIComponent(code)}`)
    }
  }, [initial, router])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const code = serial.trim()
    if (!code) return
    router.push(`/verify-certificate/${encodeURIComponent(code)}`)
  }

  return (
    <div className="page active" style={{ display: 'block', minHeight: '100vh', background: 'var(--navy)' }}>
      <section style={{ maxWidth: 560, margin: '48px auto', padding: '0 20px 80px' }}>
        <h1 className="font-display fw-800 text-white" style={{ fontSize: 28, marginBottom: 8 }}>
          Verify certificate
        </h1>
        <p className="text-muted text-sm" style={{ marginBottom: 24, lineHeight: 1.6 }}>
          Enter the serial number printed on an AdharaEdu certificate of completion.
        </p>
        <form onSubmit={submit} className="card" style={{ marginBottom: 20 }}>
          <label className="form-label">Serial number</label>
          <input
            className="form-input"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="e.g. ADH-2026-XXXX"
            autoComplete="off"
          />
          <button type="submit" className="btn btn-primary" style={{ marginTop: 16 }} disabled={!serial.trim()}>
            Verify
          </button>
        </form>
        <p style={{ marginTop: 24 }}>
          <Link href="/" className="text-muted text-sm">← Back to home</Link>
        </p>
      </section>
    </div>
  )
}

export default function CertificateVerifyPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh', background: 'var(--navy)' }} />}>
      <VerifyRedirectInner />
    </Suspense>
  )
}
