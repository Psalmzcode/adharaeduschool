'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { tutorsApi, uploadsApi } from '@/lib/api'
import { notify } from '@/lib/notify'

const ID_TYPES = [
  { value: 'NIN', label: 'NIN' },
  { value: 'VOTERS_CARD', label: "Voter's card" },
  { value: 'DRIVERS_LICENSE', label: "Driver's license" },
  { value: 'INTERNATIONAL_PASSPORT', label: 'International passport' },
] as const

type Guarantor = { fullName: string; phone: string; email: string; address: string; relationship: string }

const emptyG: Guarantor = { fullName: '', phone: '', email: '', address: '', relationship: '' }

export default function TutorOnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  const [passportPhotoUrl, setPassportPhotoUrl] = useState('')
  const [identificationType, setIdentificationType] = useState<string>('')
  const [identificationNumber, setIdentificationNumber] = useState('')
  const [identificationDocumentUrl, setIdentificationDocumentUrl] = useState('')
  const [signatureUrl, setSignatureUrl] = useState('')
  const [guarantors, setGuarantors] = useState<Guarantor[]>([{ ...emptyG }, { ...emptyG }])

  const load = useCallback(async () => {
    if (!localStorage.getItem('adhara_token')) {
      router.push('/auth/login')
      return
    }
    try {
      const t = await tutorsApi.me()
      if (t.onboardingStatus === 'COMPLETE') {
        router.replace('/dashboard/tutor')
        return
      }
      setPassportPhotoUrl(t.passportPhotoUrl || '')
      setIdentificationType(t.identificationType || '')
      setIdentificationNumber(t.identificationNumber || '')
      setIdentificationDocumentUrl(t.identificationDocumentUrl || '')
      setSignatureUrl(t.signatureUrl || '')
      const g = Array.isArray(t.guarantors) ? t.guarantors : []
      setGuarantors([
        { ...emptyG, ...(g[0] || {}) },
        { ...emptyG, ...(g[1] || {}) },
      ])
    } catch {
      router.push('/auth/login')
    }
    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  const persist = async (extra?: Record<string, unknown>) => {
    const body = {
      passportPhotoUrl: passportPhotoUrl || undefined,
      identificationType: identificationType || undefined,
      identificationNumber: identificationNumber.trim() || undefined,
      identificationDocumentUrl: identificationDocumentUrl || undefined,
      signatureUrl: signatureUrl || undefined,
      guarantors: guarantors.map((g) => ({
        fullName: g.fullName.trim(),
        phone: g.phone.trim(),
        email: g.email.trim(),
        address: g.address.trim(),
        relationship: g.relationship.trim() || undefined,
      })),
      ...extra,
    }
    return tutorsApi.patchMyProfile(body)
  }

  const saveDraft = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    setSaving(true)
    try {
      await persist()
      notify.success('Draft saved — you can log out and continue later.')
    } catch (e: any) {
      setErr(e.message || 'Save failed')
    }
    setSaving(false)
  }

  const finalize = async () => {
    setErr('')
    setSubmitting(true)
    try {
      await persist()
      await tutorsApi.completeOnboarding()
      notify.success('Profile complete — welcome to your dashboard.')
      router.replace('/dashboard/tutor')
    } catch (e: any) {
      setErr(e.message || 'Submit failed')
    }
    setSubmitting(false)
  }

  const uploadField = async (file: File | null, entityType: string, setter: (u: string) => void) => {
    if (!file) return
    setErr('')
    try {
      const r = await uploadsApi.tutorKyc(file, entityType)
      if (r?.url) setter(r.url)
    } catch (e: any) {
      setErr(e.message || 'Upload failed')
    }
  }

  const setG = (i: number, field: keyof Guarantor, v: string) => {
    setGuarantors((prev) => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: v }
      return next
    })
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy)' }}>
        <p className="text-muted">Loading…</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--navy)', padding: '24px 16px 48px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div className="flex-between mb-20" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="font-display fw-700 text-white" style={{ fontSize: 22 }}>Complete your tutor profile</h1>
            <p className="text-muted text-sm mt-4" style={{ maxWidth: 520 }}>
              Save a draft anytime and sign in later to continue. When everything is filled, submit to access your dashboard.
            </p>
          </div>
          <Link href="/auth/login" className="btn btn-ghost btn-sm" onClick={() => localStorage.removeItem('adhara_token')}>
            Log out
          </Link>
        </div>

        {err && (
          <div className="mb-16" style={{ padding: 12, borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', fontSize: 14 }}>
            {err}
          </div>
        )}

        <form className="card" style={{ display: 'grid', gap: 20 }} onSubmit={saveDraft}>
          <section>
            <h2 className="font-display fw-600 text-white" style={{ fontSize: 16, marginBottom: 12 }}>Passport photograph</h2>
            <input type="file" accept="image/*" className="form-input" onChange={(e) => uploadField(e.target.files?.[0] || null, 'tutor-kyc-passport', setPassportPhotoUrl)} />
            {passportPhotoUrl && <p className="text-xs text-muted mt-6">Uploaded ✓</p>}
          </section>

          <section>
            <h2 className="font-display fw-600 text-white" style={{ fontSize: 16, marginBottom: 12 }}>Means of identification</h2>
            <label className="form-label">ID type</label>
            <select className="form-input mb-10" value={identificationType} onChange={(e) => setIdentificationType(e.target.value)}>
              <option value="">Select…</option>
              {ID_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <label className="form-label">ID number</label>
            <input className="form-input mb-10" value={identificationNumber} onChange={(e) => setIdentificationNumber(e.target.value)} placeholder="As shown on document" />
            <label className="form-label">Photo of ID</label>
            <input type="file" accept="image/*" className="form-input" onChange={(e) => uploadField(e.target.files?.[0] || null, 'tutor-kyc-id', setIdentificationDocumentUrl)} />
            {identificationDocumentUrl && <p className="text-xs text-muted mt-6">Uploaded ✓</p>}
          </section>

          <section>
            <h2 className="font-display fw-600 text-white" style={{ fontSize: 16, marginBottom: 12 }}>Signature</h2>
            <input type="file" accept="image/*" className="form-input" onChange={(e) => uploadField(e.target.files?.[0] || null, 'tutor-kyc-signature', setSignatureUrl)} />
            {signatureUrl && <p className="text-xs text-muted mt-6">Uploaded ✓</p>}
          </section>

          {[0, 1].map((i) => (
            <section key={i} style={{ borderTop: '1px solid var(--border2)', paddingTop: 16 }}>
              <h2 className="font-display fw-600 text-white" style={{ fontSize: 16, marginBottom: 12 }}>Guarantor {i + 1}</h2>
              <div style={{ display: 'grid', gap: 10 }}>
                <div><label className="form-label">Full name</label><input className="form-input" value={guarantors[i].fullName} onChange={(e) => setG(i, 'fullName', e.target.value)} /></div>
                <div><label className="form-label">Phone</label><input className="form-input" value={guarantors[i].phone} onChange={(e) => setG(i, 'phone', e.target.value)} /></div>
                <div><label className="form-label">Email</label><input type="email" className="form-input" value={guarantors[i].email} onChange={(e) => setG(i, 'email', e.target.value)} /></div>
                <div><label className="form-label">Address</label><textarea className="form-input" rows={2} value={guarantors[i].address} onChange={(e) => setG(i, 'address', e.target.value)} /></div>
                <div><label className="form-label">Relationship (optional)</label><input className="form-input" value={guarantors[i].relationship} onChange={(e) => setG(i, 'relationship', e.target.value)} /></div>
              </div>
            </section>
          ))}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button type="submit" className="btn btn-ghost btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</button>
            <button type="button" className="btn btn-primary btn-sm" disabled={submitting} onClick={() => void finalize()}>
              {submitting ? 'Submitting…' : 'Submit & open dashboard'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
