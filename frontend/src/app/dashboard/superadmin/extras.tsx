'use client'
import { useState, useEffect } from 'react'

// ── Payroll ────────────────────────────────────────────────────────────
import { payrollApi } from '@/lib/api'
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

import { CertificatesPanel } from '@/components/CertificatesPanel'

function SACertificates() {
  return <CertificatesPanel />
}

// Re-export as named so the switch can use them
export { SAPayroll, SACertificates }
