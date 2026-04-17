'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { schoolsApi, uploadsApi } from '@/lib/api'
import { notify } from '@/lib/notify'
import { SCHOOL_TYPE_OPTIONS, TRACK_OPTIONS } from '@/lib/schoolProfileLabels'

const LEVEL_OPTIONS = ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3']

const BANDS = ['Under 100', '100 – 300', '300 – 600', '600+']

export default function CompleteSchoolProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [schoolId, setSchoolId] = useState<string | null>(null)

  const [displayName, setDisplayName] = useState('')
  const [officialName, setOfficialName] = useState('')
  const [schoolType, setSchoolType] = useState('SECONDARY')
  const [website, setWebsite] = useState('')
  const [officialEmail, setOfficialEmail] = useState('')
  const [officialPhone, setOfficialPhone] = useState('')
  const [principalName, setPrincipalName] = useState('')
  const [principalPhone, setPrincipalPhone] = useState('')
  const [ictName, setIctName] = useState('')
  const [ictPhone, setIctPhone] = useState('')
  const [ictEmail, setIctEmail] = useState('')
  const [billName, setBillName] = useState('')
  const [billEmail, setBillEmail] = useState('')
  const [billPhone, setBillPhone] = useState('')
  const [levels, setLevels] = useState<string[]>([])
  const [tracks, setTracks] = useState<string[]>(['TRACK_1', 'TRACK_2', 'TRACK_3'])
  const [term, setTerm] = useState('First Term')
  const [year, setYear] = useState('2025/2026')
  const [band, setBand] = useState('100 – 300')
  const [streams, setStreams] = useState('')
  const [visitNotes, setVisitNotes] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const s = await schoolsApi.mine()
        setSchoolId(s.id)
        setDisplayName(s.name || '')
        setOfficialName(s.officialName || s.name || '')
        if (s.schoolType) setSchoolType(s.schoolType)
        setWebsite(s.website || '')
        setOfficialEmail(s.officialEmail || s.admins?.[0]?.email || '')
        setOfficialPhone(s.officialPhone || '')
        setPrincipalName(s.principalName || '')
        setPrincipalPhone(s.principalPhone || '')
        setIctName(s.ictContactName || '')
        setIctPhone(s.ictContactPhone || '')
        setIctEmail(s.ictContactEmail || '')
        setBillName(s.billingContactName || '')
        setBillEmail(s.billingContactEmail || '')
        setBillPhone(s.billingContactPhone || '')
        if (Array.isArray(s.platformLevels) && s.platformLevels.length) setLevels(s.platformLevels)
        if (Array.isArray(s.enrolledTracks) && s.enrolledTracks.length) setTracks(s.enrolledTracks)
        setTerm(s.currentTermLabel || 'First Term')
        setYear(s.academicYearLabel || '2025/2026')
        setBand(s.studentCountBand || '100 – 300')
        setStreams(s.streamsCount != null ? String(s.streamsCount) : '')
        setVisitNotes(s.visitDeploymentNotes || '')
        setLogoUrl(s.logoUrl || '')
      } catch {
        notify.error('Could not load your school. Sign in again.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const toggleLevel = (lv: string) => {
    setLevels((prev) => (prev.includes(lv) ? prev.filter((x) => x !== lv) : [...prev, lv]))
  }

  const toggleTrack = (tv: string) => {
    setTracks((prev) => (prev.includes(tv) ? prev.filter((x) => x !== tv) : [...prev, tv]))
  }

  const onLogo = async (f: File | null) => {
    if (!f || !schoolId) return
    setUploadingLogo(true)
    try {
      const r = await uploadsApi.schoolLogo(f, schoolId)
      if (r?.url) {
        setLogoUrl(r.url)
        notify.success('Logo uploaded')
      }
    } catch (e: any) {
      notify.fromError(e, 'Upload failed')
    }
    setUploadingLogo(false)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!levels.length) {
      notify.warning('Select at least one class level on the platform')
      return
    }
    if (!tracks.length) {
      notify.warning('Select at least one Adhara track')
      return
    }
    setSaving(true)
    try {
      await schoolsApi.completeProfile({
        displayName: displayName.trim() || undefined,
        officialName: officialName.trim(),
        schoolType,
        website: website.trim() || undefined,
        officialEmail: officialEmail.trim(),
        officialPhone: officialPhone.trim(),
        principalName: principalName.trim(),
        principalPhone: principalPhone.trim(),
        ictContactName: ictName.trim() || undefined,
        ictContactPhone: ictPhone.trim() || undefined,
        ictContactEmail: ictEmail.trim() || undefined,
        billingContactName: billName.trim() || undefined,
        billingContactEmail: billEmail.trim() || undefined,
        billingContactPhone: billPhone.trim() || undefined,
        platformLevels: levels,
        enrolledTracks: tracks,
        currentTermLabel: term.trim(),
        academicYearLabel: year.trim(),
        studentCountBand: band,
        streamsCount: (() => {
          const t = streams.trim()
          if (!t) return undefined
          const n = parseInt(t, 10)
          return Number.isFinite(n) ? n : undefined
        })(),
        visitDeploymentNotes: visitNotes.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        timezone: 'Africa/Lagos',
        locale: 'en-NG',
      })
      notify.success('School profile complete — welcome to your dashboard.')
      router.replace('/dashboard/admin')
    } catch (err: any) {
      notify.fromError(err, 'Could not save profile')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy)' }}>
        <p className="text-muted">Loading…</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--navy)', padding: '32px 16px 64px' }}>
      {/* Full-width top bar: logo left, logout right (matches tutor onboarding) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
        <div aria-hidden style={{ lineHeight: 0 }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 50" height="40" width="200">
            <rect x="1" y="4" width="38" height="40" rx="12" ry="14" fill="#1E7FD4" />
            <polygon points="20,10 23.5,18.5 33,18.5 25.5,24 28.5,33 20,27.5 11.5,33 14.5,24 7,18.5 16.5,18.5" fill="#F5C518" />
            <text x="46" y="33" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="26" fill="var(--white)">Adhara</text>
            <text x="153" y="14" fontFamily="Arial, sans-serif" fontWeight="700" fontStyle="italic" fontSize="12" fill="#1E7FD4">Edu</text>
            <text x="46" y="46" fontFamily="Georgia, serif" fontStyle="italic" fontSize="9.5" fill="var(--muted)" letterSpacing="0.3">Learn Smart. Grow Together</text>
          </svg>
        </div>
        <Link
          href="/auth/login"
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => {
            localStorage.removeItem('adhara_token')
            localStorage.removeItem('adhara_user')
          }}
        >
          Log out
        </Link>
      </div>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div className="mb-24">
          <h1 className="font-display fw-700 text-white" style={{ fontSize: 24, marginBottom: 8 }}>
            Complete your school profile
          </h1>
          <p className="text-muted text-sm" style={{ maxWidth: 560 }}>
            Your school is approved. Add the details below so we can configure AdharaEdu for your community, tutors, and certificates.
          </p>
        </div>

        <form className="card" style={{ display: 'grid', gap: 24, padding: '28px 24px' }} onSubmit={submit}>
          <section>
            <h2 className="font-display fw-600 text-white" style={{ fontSize: 15, marginBottom: 12 }}>
              Identity
            </h2>
            <div className="form-group">
              <label className="form-label">Official school name (as on CAC / letterhead)</label>
              <input className="form-input" value={officialName} onChange={(e) => setOfficialName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Display name (optional — shown in the app)</label>
              <input
                className="form-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Defaults to official name if empty"
              />
            </div>
            <div className="form-group">
              <label className="form-label">School type</label>
              <select className="form-input" value={schoolType} onChange={(e) => setSchoolType(e.target.value)}>
                {SCHOOL_TYPE_OPTIONS.map((x) => (
                  <option key={x.v} value={x.v}>
                    {x.l}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Website (optional)</label>
              <input className="form-input" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Official email</label>
                <input type="email" className="form-input" value={officialEmail} onChange={(e) => setOfficialEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Official phone</label>
                <input className="form-input" value={officialPhone} onChange={(e) => setOfficialPhone(e.target.value)} required />
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-display fw-600 text-white" style={{ fontSize: 15, marginBottom: 12 }}>
              School logo
            </h2>
            <p className="text-muted text-xs mb-10">Used on certificates, PDFs, and dashboards.</p>
            <input type="file" accept="image/*" className="form-input" disabled={!schoolId || uploadingLogo} onChange={(e) => void onLogo(e.target.files?.[0] || null)} />
            {logoUrl && (
              <p className="text-xs text-muted mt-8">
                Current: <span style={{ wordBreak: 'break-all' }}>{logoUrl}</span>
              </p>
            )}
          </section>

          <section>
            <h2 className="font-display fw-600 text-white" style={{ fontSize: 15, marginBottom: 12 }}>
              Leadership & contacts
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Principal / head</label>
                <input className="form-input" value={principalName} onChange={(e) => setPrincipalName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Principal phone</label>
                <input className="form-input" value={principalPhone} onChange={(e) => setPrincipalPhone(e.target.value)} required />
              </div>
            </div>
            <div className="text-muted text-xs mb-8 mt-12">ICT / admin (optional)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input className="form-input" value={ictName} onChange={(e) => setIctName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={ictPhone} onChange={(e) => setIctPhone(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" value={ictEmail} onChange={(e) => setIctEmail(e.target.value)} />
              </div>
            </div>
            <div className="text-muted text-xs mb-8 mt-12">Billing (optional)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input className="form-input" value={billName} onChange={(e) => setBillName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" value={billEmail} onChange={(e) => setBillEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={billPhone} onChange={(e) => setBillPhone(e.target.value)} />
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-display fw-600 text-white" style={{ fontSize: 15, marginBottom: 12 }}>
              Program on AdharaEdu
            </h2>
            <div className="text-muted text-xs mb-10">Class levels you want on the platform</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {LEVEL_OPTIONS.map((lv) => (
                <button
                  key={lv}
                  type="button"
                  className={`btn btn-sm ${levels.includes(lv) ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => toggleLevel(lv)}
                >
                  {lv}
                </button>
              ))}
            </div>
            <div className="text-muted text-xs mb-10 mt-16">Adhara tracks (curriculum)</div>
            {TRACK_OPTIONS.map((t) => (
              <label key={t.v} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" checked={tracks.includes(t.v)} onChange={() => toggleTrack(t.v)} />
                <span className="text-white">{t.l}</span>
              </label>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
              <div className="form-group">
                <label className="form-label">Current term</label>
                <input className="form-input" value={term} onChange={(e) => setTerm(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Academic year</label>
                <input className="form-input" value={year} onChange={(e) => setYear(e.target.value)} required placeholder="e.g. 2025/2026" />
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-display fw-600 text-white" style={{ fontSize: 15, marginBottom: 12 }}>
              Scale
            </h2>
            <div className="form-group">
              <label className="form-label">Approximate student count</label>
              <select className="form-input" value={band} onChange={(e) => setBand(e.target.value)}>
                {BANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Number of classes / streams (optional)</label>
              <input className="form-input" value={streams} onChange={(e) => setStreams(e.target.value)} placeholder="e.g. 6" />
            </div>
          </section>

          <section>
            <h2 className="font-display fw-600 text-white" style={{ fontSize: 15, marginBottom: 12 }}>
              Tutor visit / site notes (internal)
            </h2>
            <p className="text-muted text-xs mb-10">Gate, reception, preferred times — optional.</p>
            <textarea className="form-input" rows={4} value={visitNotes} onChange={(e) => setVisitNotes(e.target.value)} />
          </section>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save & continue to dashboard'}
            </button>
            <Link href="/auth/login" className="btn btn-ghost btn-sm">
              Sign out
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
