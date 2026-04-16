'use client'
import { useState, useEffect } from 'react'

// ── Payroll ────────────────────────────────────────────────────────────
import { payrollApi, certificatesApi as certificatesApi } from '@/lib/api'
import { notify } from '@/lib/notify'

function SAPayroll() {
  const [data, setData] = useState<any[]>([])
  const [summary, setSummary] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [calc, setCalc] = useState({ tutorId: '', schoolId: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(), ratePerSession: 5000 })
  const [calculating, setCalculating] = useState(false)

  useEffect(() => {
    Promise.all([payrollApi.all(), payrollApi.summary()])
      .then(([d, s]) => { setData(Array.isArray(d) ? d : []); setSummary(s || {}) })
      .catch((e) => {
        notify.fromError(e, 'Could not load payroll')
        setData([])
        setSummary({})
      })
      .finally(() => setLoading(false))
  }, [])

  const calculate = async (e: React.FormEvent) => {
    e.preventDefault(); setCalculating(true)
    try {
      const p = await payrollApi.calculate(calc)
      setData(d => { const idx = d.findIndex(x => x.id === p?.id); return idx >= 0 ? d.map((x, i) => i === idx ? p : x) : [p, ...d] })
    } catch (e: any) { notify.fromError(e) }
    setCalculating(false)
  }

  const pay = async (id: string) => {
    try { await payrollApi.markPaid(id); setData(d => d.map(p => p.id === id ? { ...p, isPaid: true, paidAt: new Date() } : p)) } catch (e: any) { notify.fromError(e) }
  }

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  return (
    <div>
      <h3 className="font-display fw-700 text-white mb-20" style={{ fontSize: 20 }}>Tutor Payroll</h3>
      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 24 }}>
        {[{ glow: 'var(--gold)', icon: '💰', bg: 'rgba(212,168,83,0.15)', val: `₦${((summary.total||0)/1000).toFixed(0)}k`, label: 'Total Payroll', trend: 'All time' },
          { glow: 'var(--success)', icon: '✅', bg: 'rgba(34,197,94,0.15)', val: `₦${((summary.paid||0)/1000).toFixed(0)}k`, label: 'Paid', trend: 'Disbursed' },
          { glow: 'var(--warning)', icon: '⏳', bg: 'rgba(245,158,11,0.15)', val: `₦${((summary.unpaid||0)/1000).toFixed(0)}k`, label: 'Outstanding', trend: 'To disburse' },
        ].map(s => <div key={s.label} className="stat-card"><div className="stat-glow" style={{ background: s.glow }}></div><div className="stat-card-icon" style={{ background: s.bg }}>{s.icon}</div><div className="stat-card-value">{s.val}</div><div className="stat-card-label">{s.label}</div><span className="stat-card-trend">{s.trend}</span></div>)}
      </div>
      <div className="card mb-20">
        <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 15 }}>Calculate Payroll</div>
        <form onSubmit={calculate} style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          <div><label className="form-label">Tutor ID</label><input className="form-input" placeholder="Tutor ID from tutors list" value={calc.tutorId} onChange={e => setCalc({ ...calc, tutorId: e.target.value })} /></div>
          <div><label className="form-label">School ID</label><input className="form-input" placeholder="School ID" value={calc.schoolId} onChange={e => setCalc({ ...calc, schoolId: e.target.value })} /></div>
          <div><label className="form-label">Rate per Session (₦)</label><input type="number" className="form-input" value={calc.ratePerSession} onChange={e => setCalc({ ...calc, ratePerSession: +e.target.value })} /></div>
          <div><label className="form-label">Month</label>
            <select className="form-input" value={calc.month} onChange={e => setCalc({ ...calc, month: +e.target.value })} style={{ appearance: 'none' }}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div><label className="form-label">Year</label><input type="number" className="form-input" value={calc.year} onChange={e => setCalc({ ...calc, year: +e.target.value })} /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={calculating}
            >
              {calculating ? 'Calculating…' : 'Calculate & Save'}
            </button>
          </div>
        </form>
      </div>
      {loading ? <p className="text-muted text-sm" style={{ padding: 20 }}>Loading…</p> : (
        <div className="card">
          <table className="data-table">
            <thead><tr><th>Tutor</th><th>School</th><th>Period</th><th>Sessions</th><th>Rate</th><th>Total</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {data.map((p: any) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600, color: 'var(--white)', fontSize: 13 }}>{p.tutor?.user?.firstName} {p.tutor?.user?.lastName}</td>
                  <td style={{ fontSize: 12 }}>{p.school?.name}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][p.month]} {p.year}</td>
                  <td>{p.sessionsTaught}</td>
                  <td style={{ fontSize: 12 }}>₦{(p.ratePerSession||0).toLocaleString()}</td>
                  <td><strong style={{ color: 'var(--gold)' }}>₦{(p.totalAmount||0).toLocaleString()}</strong></td>
                  <td><span className={`badge badge-${p.isPaid ? 'success' : 'warning'}`}>{p.isPaid ? 'Paid' : 'Pending'}</span></td>
                  <td>{!p.isPaid && <button onClick={() => pay(p.id)} className="btn btn-primary btn-sm" style={{ fontSize: 10 }}>Mark Paid</button>}</td>
                </tr>
              ))}
              {data.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>No payroll records. Use "Calculate & Save" above.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SACertificates() {
  const [certs, setCerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [previewCert, setPreviewCert] = useState<any | null>(null)
  const [previewType, setPreviewType] = useState<'verify' | 'pdf'>('verify')
  const [previewTrack, setPreviewTrack] = useState<string>('ALL')
  useEffect(() => { certificatesApi.all().then(d => setCerts(Array.isArray(d) ? d : [])).catch(() => setCerts([])).finally(() => setLoading(false)) }, [])
  const revoke = async (id: string) => { try { await certificatesApi.revoke(id); setCerts(c => c.map(x => x.id === id ? { ...x, isRevoked: true } : x)); notify.success('Certificate revoked') } catch (e: any) { notify.fromError(e) } }
  const trackOptions = Array.from(new Set(certs.map((c: any) => String(c?.track || '')).filter(Boolean)))
  const filteredPreviewables = certs.filter((c: any) => {
    if (!c?.serialNumber) return false
    if (previewTrack === 'ALL') return true
    return String(c.track) === previewTrack
  })
  const previewable = filteredPreviewables[0] || null
  const openPreview = (cert: any, type: 'verify' | 'pdf') => {
    if (!cert) return
    setPreviewType(type)
    setPreviewCert(cert)
  }
  const currentPreviewSrc =
    previewType === 'pdf' && previewCert?.pdfUrl
      ? previewCert.pdfUrl
      : previewCert?.serialNumber
        ? `/verify-certificate/${previewCert.serialNumber}`
        : ''
  const openCurrentPreviewInNewTab = () => {
    if (!currentPreviewSrc) return
    window.open(currentPreviewSrc, '_blank', 'noopener,noreferrer')
  }
  return (
    <div>
      <h3 className="font-display fw-700 text-white mb-20" style={{ fontSize: 20 }}>All Certificates</h3>
      {previewable && (
        <div className="card mb-20">
          <div className="flex-between" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <div className="font-display fw-600 text-white mb-4" style={{ fontSize: 15 }}>Certificate Design Preview</div>
              <div className="text-muted text-sm">Preview how certificate verification and certificate PDF look to users.</div>
            </div>
            <div style={{ minWidth: 220 }}>
              <label className="form-label">Track Sample</label>
              <select
                className="form-input"
                value={previewTrack}
                onChange={(e) => setPreviewTrack(e.target.value)}
                style={{ appearance: 'none' }}
              >
                <option value="ALL">All Tracks</option>
                {trackOptions.map((track) => (
                  <option key={track} value={track}>
                    {String(track).replace('TRACK_', 'Track ')}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => openPreview(previewable, 'verify')}>Preview Verification View</button>
              <button className="btn btn-primary btn-sm" onClick={() => openPreview(previewable, 'pdf')} disabled={!previewable?.pdfUrl}>{previewable?.pdfUrl ? 'Preview PDF Design' : 'No PDF Yet'}</button>
            </div>
          </div>
        </div>
      )}
      {loading ? <p className="text-muted text-sm" style={{ padding: 20 }}>Loading…</p> : (
        <div className="card">
          <table className="data-table">
            <thead><tr><th>Student</th><th>School</th><th>Track</th><th>Score</th><th>Serial</th><th>Issued</th><th>Valid</th><th>Action</th></tr></thead>
            <tbody>
              {certs.map((c: any) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600, color: 'var(--white)' }}>{c.student?.user?.firstName} {c.student?.user?.lastName}</td>
                  <td style={{ fontSize: 12 }}>{c.student?.school?.name}</td>
                  <td><span className="badge badge-teal">{c.track?.replace('TRACK_', 'Track ')}</span></td>
                  <td><strong style={{ color: 'var(--success)' }}>{c.averageScore}%</strong></td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{c.serialNumber}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(c.issueDate).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td><span className={`badge badge-${!c.isRevoked ? 'success' : 'danger'}`}>{!c.isRevoked ? '✓ Valid' : 'Revoked'}</span></td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => openPreview(c, 'verify')}>Preview</button>
                    {c.pdfUrl && <a className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} href={c.pdfUrl} target="_blank" rel="noreferrer">PDF</a>}
                    {!c.isRevoked && <button onClick={() => revoke(c.id)} className="btn btn-danger btn-sm" style={{ fontSize: 10 }}>Revoke</button>}
                  </td>
                </tr>
              ))}
              {certs.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>No certificates issued yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {!!previewCert && (
        <div onClick={() => setPreviewCert(null)} style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(1080px, 96vw)', height: 'min(760px, 92vh)', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontWeight: 700, color: 'var(--white)', fontSize: 14 }}>
                {previewType === 'pdf' ? 'Certificate PDF Preview' : 'Certificate Verification Preview'} · {previewCert.serialNumber}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setPreviewType('verify')}>Verification</button>
                <button className="btn btn-ghost btn-sm" onClick={() => previewCert?.pdfUrl ? setPreviewType('pdf') : null} disabled={!previewCert?.pdfUrl}>PDF</button>
                <button className="btn btn-ghost btn-sm" onClick={openCurrentPreviewInNewTab}>Open in New Tab</button>
                {previewCert?.pdfUrl && (
                  <a className="btn btn-ghost btn-sm" href={previewCert.pdfUrl} target="_blank" rel="noreferrer">
                    Download PDF
                  </a>
                )}
                <button className="btn btn-danger btn-sm" onClick={() => setPreviewCert(null)}>Close</button>
              </div>
            </div>
            <div style={{ flex: 1, background: 'var(--navy)', display: 'flex' }}>
              {previewType === 'pdf' && previewCert?.pdfUrl ? (
                <iframe title="Certificate PDF Preview" src={previewCert.pdfUrl} style={{ width: '100%', height: '100%', border: 'none', background: '#0b1422' }} />
              ) : (
                <iframe title="Certificate Verification Preview" src={`/verify-certificate/${previewCert.serialNumber}`} style={{ width: '100%', height: '100%', border: 'none', background: '#0b1422' }} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Re-export as named so the switch can use them
export { SAPayroll, SACertificates }
