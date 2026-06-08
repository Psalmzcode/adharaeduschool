'use client'

import { useEffect, useState } from 'react'
import { certificatesApi, schoolsApi } from '@/lib/api'
import { notify } from '@/lib/notify'
import { CertificateArtworkPreview } from '@/components/certificates/CertificateArtworkPreview'
import { samplePreviewForTrack, TRACK_CERTIFICATE_ART } from '@/components/certificates/certificate-artwork'

type PreviewRow = {
  studentId: string
  studentName: string
  regNumber?: string
  className?: string
  schoolId?: string
  schoolName: string
  track: string
  trackLabel: string
  template: string
  averageScore: number
  grade: string
}

export function CertificatesPanel() {
  const [certs, setCerts] = useState<any[]>([])
  const [eligible, setEligible] = useState<PreviewRow[]>([])
  const [schools, setSchools] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingEligible, setLoadingEligible] = useState(true)
  const [issuing, setIssuing] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkResult, setBulkResult] = useState<any>(null)
  const [filterSchool, setFilterSchool] = useState('')
  const [filterTrack, setFilterTrack] = useState('')
  const [previewData, setPreviewData] = useState<any | null>(null)
  const [previewIssue, setPreviewIssue] = useState<PreviewRow | null>(null)
  const [designTrack, setDesignTrack] = useState('TRACK_1')

  const load = async () => {
    setLoading(true)
    try {
      const [c, s] = await Promise.all([
        certificatesApi.all().catch(() => []),
        schoolsApi.all().catch(() => []),
      ])
      setCerts(Array.isArray(c) ? c : [])
      setSchools(Array.isArray(s) ? s : [])
    } finally {
      setLoading(false)
    }
  }

  const loadEligible = async () => {
    setLoadingEligible(true)
    try {
      const rows = await certificatesApi.eligible({
        schoolId: filterSchool || undefined,
        track: filterTrack || undefined,
      })
      setEligible(Array.isArray(rows) ? rows : [])
    } catch {
      setEligible([])
    } finally {
      setLoadingEligible(false)
    }
  }

  useEffect(() => { void load() }, [])
  useEffect(() => { void loadEligible() }, [filterSchool, filterTrack])

  const openPreview = async (row: PreviewRow) => {
    try {
      const data = await certificatesApi.preview(row.studentId, row.track)
      setPreviewData(data)
      setPreviewIssue(row)
    } catch (e: any) {
      notify.fromError(e, 'Could not load preview')
    }
  }

  const issue = async (studentId: string, track: string) => {
    const key = `${studentId}:${track}`
    setIssuing(key)
    try {
      const c = await certificatesApi.issue(studentId, track)
      setCerts((prev) => [c, ...prev])
      setEligible((prev) => prev.filter((r) => !(r.studentId === studentId && r.track === track)))
      setPreviewData(null)
      setPreviewIssue(null)
      notify.success('Certificate authorized and issued ✓')
    } catch (e: any) {
      notify.fromError(e)
    }
    setIssuing(null)
  }

  const bulkIssue = async () => {
    if (!filterSchool) {
      notify.error('Select a school to bulk issue')
      return
    }
    setBulkBusy(true)
    setBulkResult(null)
    try {
      const res = await certificatesApi.bulkIssue({
        schoolId: filterSchool,
        track: filterTrack || undefined,
      })
      setBulkResult(res)
      await Promise.all([load(), loadEligible()])
      notify.success(`Authorized ${res?.issued ?? 0} certificate(s)`)
    } catch (e: any) {
      notify.fromError(e, 'Bulk issue failed')
    }
    setBulkBusy(false)
  }

  const revoke = async (id: string) => {
    try {
      await certificatesApi.revoke(id)
      setCerts((c) => c.map((x) => (x.id === id ? { ...x, isRevoked: true } : x)))
      notify.success('Certificate revoked')
    } catch (e: any) {
      notify.fromError(e)
    }
  }

  const designSample = samplePreviewForTrack(designTrack)

  return (
    <div>
      <div className="flex-between mb-20">
        <div>
          <h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Certificate Authorization</h3>
          <div className="text-muted text-sm">
            Curriculum Lead & Super Admin only — preview artwork, then authorize issuance.
          </div>
        </div>
      </div>

      <div className="card mb-20">
        <div className="font-display fw-600 text-white mb-12" style={{ fontSize: 15 }}>Per-track certificate designs</div>
        <p className="text-muted text-xs mb-12" style={{ lineHeight: 1.5 }}>
          Track 1 & 3 use the <strong style={{ color: 'var(--white)' }}>Sidebar</strong> layout; Track 2 uses the <strong style={{ color: 'var(--white)' }}>Classic</strong> layout. Each track has its own accent colours.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          {Object.values(TRACK_CERTIFICATE_ART).map((art) => (
            <button
              key={art.track}
              type="button"
              className={`btn btn-sm ${designTrack === art.track ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setDesignTrack(art.track)}
            >
              {art.track.replace('TRACK_', 'Track ')} · {art.template}
            </button>
          ))}
        </div>
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border2)' }}>
          <CertificateArtworkPreview data={designSample} scale={0.72} />
        </div>
      </div>

      <div className="card mb-20">
        <div className="font-display fw-600 text-white mb-12" style={{ fontSize: 14 }}>Bulk authorize eligible students</div>
        <p className="text-muted text-xs mb-12" style={{ lineHeight: 1.5 }}>
          Issues certificates when students completed every standard module (average ≥ 50%) and passed the <em>Track Completion Exam</em> (≥ 50%). Termly assessments are optional.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label className="form-label">School</label>
            <select className="form-input" value={filterSchool} onChange={(e) => setFilterSchool(e.target.value)} style={{ minWidth: 200, appearance: 'none' }}>
              <option value="">All schools (eligible list)</option>
              {schools.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Track (optional)</label>
            <select className="form-input" value={filterTrack} onChange={(e) => setFilterTrack(e.target.value)} style={{ minWidth: 140, appearance: 'none' }}>
              <option value="">All tracks</option>
              <option value="TRACK_1">Track 1</option>
              <option value="TRACK_2">Track 2</option>
              <option value="TRACK_3">Track 3</option>
            </select>
          </div>
          <button type="button" className="btn btn-primary btn-sm" disabled={bulkBusy || !filterSchool} onClick={bulkIssue}>
            {bulkBusy ? 'Authorizing…' : 'Authorize all eligible →'}
          </button>
        </div>
        {bulkResult && (
          <div className="text-muted text-xs mt-12" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span><strong style={{ color: 'var(--success)' }}>Issued:</strong> {bulkResult.issued ?? 0}</span>
            <span><strong style={{ color: 'var(--muted)' }}>Skipped:</strong> {bulkResult.skipped?.length ?? 0}</span>
            <span><strong style={{ color: 'var(--danger)' }}>Failed:</strong> {bulkResult.failed?.length ?? 0}</span>
          </div>
        )}
      </div>

      <div className="content-grid mb-20">
        <div className="card">
          <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 15 }}>Eligible — preview before issue</div>
          {loadingEligible && <p className="text-muted text-sm">Loading…</p>}
          {eligible.map((row) => {
            const key = `${row.studentId}:${row.track}`
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border2)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--white)' }}>{row.studentName}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {row.schoolName} · {row.className || '—'} · {row.trackLabel}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {row.averageScore}% · {row.grade} · {row.template} design
                  </div>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => openPreview(row)}>Preview</button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ fontSize: 11 }}
                  disabled={issuing === key}
                  onClick={() => issue(row.studentId, row.track)}
                >
                  {issuing === key ? '…' : 'Authorize'}
                </button>
              </div>
            )
          })}
          {!loadingEligible && eligible.length === 0 && <p className="text-muted text-sm">No eligible students awaiting authorization.</p>}
        </div>
        <div className="card">
          <div className="font-display fw-600 text-white mb-8" style={{ fontSize: 15 }}>Issued certificates</div>
          <p className="text-muted text-xs mb-12">School admins can view student certs but cannot issue or revoke.</p>
          {loading && <p className="text-muted text-sm">Loading…</p>}
          {certs.filter((c) => !c.isRevoked).slice(0, 12).map((c: any) => (
            <div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border2)' }}>
              <div style={{ fontWeight: 600, color: 'var(--white)', fontSize: 13 }}>
                {c.student?.user?.firstName} {c.student?.user?.lastName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                {c.student?.school?.name} · {String(c.track || '').replace('TRACK_', 'Track ')} · {c.averageScore}%
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>{c.serialNumber}</div>
            </div>
          ))}
          {!loading && certs.length === 0 && <p className="text-muted text-sm">No certificates issued yet.</p>}
        </div>
      </div>

      {loading ? <p className="text-muted text-sm">Loading registry…</p> : (
        <div className="card">
          <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 15 }}>All issued certificates</div>
          <table className="data-table">
            <thead>
              <tr><th>Student</th><th>School</th><th>Track</th><th>Score</th><th>Serial</th><th>Issued</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {certs.map((c: any) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600, color: 'var(--white)' }}>{c.student?.user?.firstName} {c.student?.user?.lastName}</td>
                  <td style={{ fontSize: 12 }}>{c.student?.school?.name}</td>
                  <td><span className="badge badge-teal">{String(c.track || '').replace('TRACK_', 'Track ')}</span></td>
                  <td><strong style={{ color: 'var(--success)' }}>{c.averageScore}%</strong></td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{c.serialNumber}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(c.issueDate).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td><span className={`badge badge-${!c.isRevoked ? 'success' : 'danger'}`}>{!c.isRevoked ? '✓ Valid' : 'Revoked'}</span></td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {c.pdfUrl && <a className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} href={c.pdfUrl} target="_blank" rel="noreferrer">PDF</a>}
                    <a className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} href={`/verify-certificate/${c.serialNumber}`} target="_blank" rel="noreferrer">Verify</a>
                    {!c.isRevoked && <button type="button" onClick={() => revoke(c.id)} className="btn btn-danger btn-sm" style={{ fontSize: 10 }}>Revoke</button>}
                  </td>
                </tr>
              ))}
              {certs.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>No certificates issued yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {previewData && previewIssue && (
        <div
          onClick={() => { setPreviewData(null); setPreviewIssue(null) }}
          style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(1040px, 96vw)', maxHeight: '92vh', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--white)', fontSize: 15 }}>Preview before authorization</div>
                <div className="text-muted text-sm">{previewIssue.studentName} · {previewData.trackLabel}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setPreviewData(null); setPreviewIssue(null) }}>Cancel</button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!previewData.eligible || issuing === `${previewIssue.studentId}:${previewIssue.track}`}
                  onClick={() => issue(previewIssue.studentId, previewIssue.track)}
                >
                  {previewData.eligible ? 'Authorize & Issue' : 'Not eligible'}
                </button>
              </div>
            </div>
            <div style={{ overflow: 'auto', flex: 1 }}>
              <CertificateArtworkPreview
                data={{
                  studentName: previewData.studentName,
                  regNumber: previewData.regNumber,
                  schoolName: previewData.schoolName,
                  trackLabel: previewData.trackLabel,
                  template: previewData.template,
                  accent: previewData.accent,
                  navy: previewData.navy,
                  gold: previewData.gold,
                  averageScore: previewData.averageScore,
                  grade: previewData.grade,
                  issueDateLabel: previewData.issueDateLabel,
                  serialNumber: previewData.serialNumber,
                  verifyUrl: previewData.verifyUrl.replace(/^https?:\/\//, ''),
                  year: String(new Date(previewData.issueDate).getFullYear()),
                }}
                scale={0.85}
              />
            </div>
            <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border2)', fontSize: 12, color: previewData.eligible ? 'var(--muted)' : 'var(--warning)' }}>
              {previewData.completionExamTitle && (
                <span>
                  {previewData.completionExamTitle}:{' '}
                  <strong style={{ color: 'var(--white)' }}>
                    {previewData.completionExamScore != null ? `${previewData.completionExamScore}%` : 'not attempted'}
                  </strong>
                  {' '}(need ≥ {previewData.completionExamPassMark ?? 50}%)
                  {!previewData.eligible && previewData.eligibilityReason ? ' · ' : ''}
                </span>
              )}
              {!previewData.eligible && previewData.eligibilityReason}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
