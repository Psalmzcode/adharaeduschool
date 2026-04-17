'use client'
import { useState, useEffect, useRef, Suspense, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { DashboardShell } from '@/components/DashboardShell'
import { ClassPerformancePanel } from '@/components/ClassPerformancePanel'
import { schoolsApi, tutorsApi, paymentsApi, reportsApi, cbtApi, payrollApi, tracksApi, practicalsApi, modulesApi, schoolClassesApi, curriculumApi, usersApi } from '@/lib/api'
import { notify } from '@/lib/notify'
import { SACertificates } from './extras'

/** Same as student `useLoad`: do not merge `def` into `data` while loading (avoids fake zeros / empty tables). */
function useData<T>(queryKey: unknown[], fn: () => Promise<T>, def: T, enabled = true) {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery<T>({
    queryKey,
    queryFn: fn,
    enabled,
    staleTime: 30_000,
    retry: 1,
  })

  const setData = (updater: T | ((prev: T) => T)) => {
    queryClient.setQueryData(queryKey, (prev: T | undefined) => {
      const base = prev ?? def
      return typeof updater === 'function' ? (updater as (p: T) => T)(base) : updater
    })
  }

  return { data, loading: enabled && isLoading, setData }
}

/** Defaults when `useData` has not received API data yet (no `data = def` merge). */
const DEFAULT_PAYMENTS_SUMMARY = { total: 0, paid: 0, unpaid: 0, count: 0, paidCount: 0 }
const DEFAULT_PAYROLL_SUMMARY = { totalPayroll: 0, paid: 0, unpaid: 0, tutorCount: 0 }

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: '90vh',
          background: 'var(--navy2)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--white)' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 16, overflow: 'auto' }}>{children}</div>
      </div>
    </div>
  )
}

function ConfirmModal({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  message: React.ReactNode
  confirmText?: string
  cancelText?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div className="text-sm text-muted" style={{ lineHeight: 1.6 }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'} btn-sm`}
            onClick={onConfirm}
            disabled={busy}
            style={{ justifyContent: 'center', minWidth: 140 }}
          >
            {busy ? 'Please wait…' : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function SAOverview({ onSection }: { onSection: (s: string) => void }) {
  const { data: schools, loading: lSchools } = useData(['sa', 'schools'], () => schoolsApi.all(), [])
  const { data: tutors, loading: lTutors } = useData(['sa', 'tutors'], () => tutorsApi.all(), [])
  const { data: summary, loading: lSummary } = useData(['sa', 'payments-summary'], () => paymentsApi.summary(), { total: 0, paid: 0, unpaid: 0, count: 0 })

  const overviewLoading = lSchools || lTutors || lSummary
  const schoolArr = Array.isArray(schools) ? schools : []
  const tutorArr = Array.isArray(tutors) ? tutors : []
  const pending = schoolArr.filter((s: any) => s.status === 'PENDING')
  const active = schoolArr.filter((s: any) => s.status === 'APPROVED')
  const sum = { ...DEFAULT_PAYMENTS_SUMMARY, ...(summary ?? {}) }

  return (<>
    {overviewLoading && <p className="text-muted text-sm mb-16" style={{ padding: '12px 0' }}>Loading overview…</p>}
    <div className="stats-row" style={{ opacity: overviewLoading ? 0.45 : 1 }}>
      {[
        { glow: 'var(--gold)', icon: '🏫', bg: 'rgba(212,168,83,0.15)', val: overviewLoading ? '—' : active.length, label: 'Active Schools', trend: overviewLoading ? '…' : `${pending.length} pending approval` },
        { glow: 'var(--teal)', icon: '👥', bg: 'rgba(26,127,212,0.15)', val: overviewLoading ? '—' : schoolArr.reduce((s: number, sc: any) => s + (sc._count?.students || 0), 0), label: 'Total Students', trend: '↑ This month', up: true },
        { glow: 'var(--success)', icon: '👩‍🏫', bg: 'rgba(34,197,94,0.15)', val: overviewLoading ? '—' : tutorArr.filter((t: any) => t.isVerified).length, label: 'Active Tutors', trend: 'All verified' },
        { glow: 'var(--warning)', icon: '⏳', bg: 'rgba(245,158,11,0.15)', val: overviewLoading ? '—' : pending.length, label: 'Pending Approvals', trend: 'Needs review' },
      ].map(s => (
        <div key={s.label} className="stat-card"><div className="stat-glow" style={{ background: s.glow }}></div><div className="stat-card-icon" style={{ background: s.bg }}>{s.icon}</div><div className="stat-card-value">{s.val}</div><div className="stat-card-label">{s.label}</div><span className={`stat-card-trend${s.up ? ' trend-up' : ''}`}>{s.trend}</span></div>
      ))}
    </div>
    <div className="content-grid" style={{ marginBottom: 24, opacity: overviewLoading ? 0.45 : 1 }}>
      <div className="card">
        <div className="flex-between mb-20"><div className="font-display fw-700 text-white" style={{ fontSize: 16 }}>Registered Schools</div><button onClick={() => onSection('schools')} className="btn btn-ghost btn-sm">View All</button></div>
        <table className="data-table">
          <thead><tr><th>School</th><th>State</th><th>Students</th><th>Status</th></tr></thead>
          <tbody>
            {schoolArr.slice(0, 6).map((s: any) => (
              <tr key={s.id}>
                <td><div style={{ fontWeight: 600, color: 'var(--white)' }}>{s.name}</div><div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{s.code}</div></td>
                <td>{s.state}</td>
                <td>{s._count?.students || 0}</td>
                <td><span className={`badge badge-${s.status === 'APPROVED' ? 'success' : s.status === 'PENDING' ? 'warning' : 'danger'}`}>{s.status}</span></td>
              </tr>
            ))}
            {!overviewLoading && schoolArr.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0' }}>No schools yet</td></tr>}
            {overviewLoading && schoolArr.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0' }}>Loading…</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="card">
          <div className="flex-between mb-16"><div className="font-display fw-700 text-white" style={{ fontSize: 15 }}>Pending Approvals</div><span className="badge badge-warning">{overviewLoading ? '…' : `${pending.length} pending`}</span></div>
          {pending.slice(0, 3).map((s: any) => (
            <div key={s.id} className="approval-row">
              <div className="school-avatar" style={{ fontSize: 18 }}>🏫</div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, color: 'var(--white)', fontSize: 13 }}>{s.name}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.state} · Registration pending</div></div>
              <button onClick={() => onSection('approvals')} className="btn btn-primary btn-sm" style={{ padding: '5px 12px', fontSize: 11 }}>Review</button>
            </div>
          ))}
          {!overviewLoading && pending.length === 0 && <p className="text-muted text-sm">No pending approvals.</p>}
          {overviewLoading && <p className="text-muted text-sm">Loading…</p>}
        </div>
        <div className="card">
          <div className="font-display fw-700 text-white mb-16" style={{ fontSize: 15 }}>Revenue Overview</div>
          {[
            { l: 'Term 2 Invoiced', v: overviewLoading ? '…' : `₦${((sum.total || 0) / 1000).toFixed(0)}k`, c: 'var(--white)' },
            { l: 'Collected', v: overviewLoading ? '…' : `₦${((sum.paid || 0) / 1000).toFixed(0)}k`, c: 'var(--success)' },
            { l: 'Outstanding', v: overviewLoading ? '…' : `₦${((sum.unpaid || 0) / 1000).toFixed(0)}k`, c: 'var(--warning)' },
          ].map((r, i) => (
            <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 2 ? '1px solid var(--border2)' : 'none' }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>{r.l}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: r.c }}>{r.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </>)
}

function SchoolDetailRow({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, fontFamily: 'var(--font-display)' }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--white)', lineHeight: 1.5 }}>{value}</div>
    </div>
  )
}

function SASchools() {
  const { data: schools, loading, setData } = useData(['sa', 'schools'], () => schoolsApi.all(), [])
  const [filter, setFilter] = useState('ALL')
  const [editSchool, setEditSchool] = useState<any>(null)
  const [editEmail, setEditEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)
  const [removeSchool, setRemoveSchool] = useState<any>(null)
  const [removing, setRemoving] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [viewLoading, setViewLoading] = useState(false)
  const [viewDetail, setViewDetail] = useState<any>(null)
  const [pendingStatus, setPendingStatus] = useState<{ school: any; next: 'APPROVED' | 'REJECTED'; fromView?: boolean } | null>(null)
  const [statusConfirmBusy, setStatusConfirmBusy] = useState(false)
  const [pendingResend, setPendingResend] = useState<any>(null)
  const [resendBusy, setResendBusy] = useState(false)
  const [pendingEmailSave, setPendingEmailSave] = useState(false)
  const schoolArr = Array.isArray(schools) ? schools : []
  const filtered = filter === 'ALL' ? schoolArr : schoolArr.filter((s: any) => s.status === filter)

  const confirmStatusChange = async () => {
    if (!pendingStatus) return
    setStatusConfirmBusy(true)
    try {
      const { school, next, fromView } = pendingStatus
      await schoolsApi.updateStatus(school.id, next)
      setData(schoolArr.map((s: any) => (s.id === school.id ? { ...s, status: next } : s)))
      notify.success(next === 'APPROVED' ? 'School approved.' : 'School rejected.')
      setPendingStatus(null)
      if (fromView) closeViewSchool()
    } catch (e: any) {
      notify.fromError(e)
    } finally {
      setStatusConfirmBusy(false)
    }
  }

  const confirmResend = async () => {
    if (!pendingResend?.id) return
    setResendBusy(true)
    try {
      await schoolsApi.resendPendingApprovalEmail(pendingResend.id)
      notify.success('Pending-approval email sent to the school admin.')
      setPendingResend(null)
    } catch (e: any) {
      notify.fromError(e)
    } finally {
      setResendBusy(false)
    }
  }

  const openEditEmail = (s: any) => {
    const em = s.admins?.[0]?.email || ''
    setEditSchool(s)
    setEditEmail(em)
  }

  const requestSaveAdminEmail = () => {
    const adminId = editSchool?.admins?.[0]?.id
    if (!adminId || !editEmail.trim()) {
      notify.warning('Enter a valid email.')
      return
    }
    setPendingEmailSave(true)
  }

  const saveAdminEmail = async () => {
    const adminId = editSchool?.admins?.[0]?.id
    if (!adminId || !editEmail.trim()) {
      notify.warning('Enter a valid email.')
      return
    }
    setSavingEmail(true)
    try {
      await usersApi.adminPatch(adminId, { email: editEmail.trim().toLowerCase() })
      setData(
        schoolArr.map((s: any) =>
          s.id === editSchool.id
            ? {
                ...s,
                admins: (s.admins || []).map((a: any, i: number) =>
                  i === 0 ? { ...a, email: editEmail.trim().toLowerCase() } : a,
                ),
              }
            : s,
        ),
      )
      notify.success('Admin email updated.')
      setEditSchool(null)
    } catch (e: any) {
      notify.fromError(e)
    } finally {
      setSavingEmail(false)
    }
  }

  const confirmSaveAdminEmail = async () => {
    try {
      await saveAdminEmail()
    } finally {
      setPendingEmailSave(false)
    }
  }

  const confirmRemove = async () => {
    if (!removeSchool?.id) return
    setRemoving(true)
    try {
      await schoolsApi.remove(removeSchool.id)
      setData(schoolArr.filter((s: any) => s.id !== removeSchool.id))
      notify.success('Pending school removed.')
      setRemoveSchool(null)
    } catch (e: any) {
      notify.fromError(e)
    } finally {
      setRemoving(false)
    }
  }

  const openViewSchool = async (s: any) => {
    setViewOpen(true)
    setViewDetail(null)
    setViewLoading(true)
    try {
      const d = await schoolsApi.one(s.id)
      setViewDetail(d)
    } catch (e: any) {
      notify.fromError(e, 'Could not load school details.')
      setViewOpen(false)
    } finally {
      setViewLoading(false)
    }
  }

  const closeViewSchool = () => {
    setViewOpen(false)
    setViewDetail(null)
    setViewLoading(false)
  }

  const fmtDate = (d: string | undefined) => {
    if (!d) return ''
    try {
      return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    } catch {
      return String(d)
    }
  }

  return (
    <div>
      <Modal open={viewOpen} onClose={closeViewSchool} title={viewDetail?.name || 'School details'}>
        <div style={{ minHeight: viewLoading ? 120 : undefined }}>
          {viewLoading && <p className="text-muted text-sm" style={{ padding: '12px 0' }}>Loading details…</p>}
          {!viewLoading && viewDetail && (
            <div style={{ display: 'grid', gap: 4 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                <span className={`badge badge-${viewDetail.status === 'APPROVED' ? 'success' : viewDetail.status === 'PENDING' ? 'warning' : 'danger'}`}>{viewDetail.status}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>{viewDetail.code}</span>
              </div>
              <SchoolDetailRow label="Address" value={viewDetail.address} />
              <SchoolDetailRow label="State / LGA" value={[viewDetail.state, viewDetail.lga].filter(Boolean).join(' · ') || undefined} />
              <SchoolDetailRow label="Lead contact" value={viewDetail.principalName} />
              <SchoolDetailRow label="Principal phone" value={viewDetail.principalPhone} />
              <SchoolDetailRow label="Registered" value={fmtDate(viewDetail.createdAt)} />
              <SchoolDetailRow label="Student count (band)" value={viewDetail.studentCountBand} />
              {viewDetail.admins?.length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 14, borderTop: '1px solid var(--border2)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', marginBottom: 10, fontFamily: 'var(--font-display)' }}>School admin (registration)</div>
                  {viewDetail.admins.map((a: any) => (
                    <div key={a.id} style={{ marginBottom: 12, padding: '10px 12px', background: 'var(--muted3)', borderRadius: 8, border: '1px solid var(--border2)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--white)' }}>{[a.firstName, a.lastName].filter(Boolean).join(' ') || '—'}</div>
                      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>📧 {a.email || '—'}</div>
                      {a.phone && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>📞 {a.phone}</div>}
                    </div>
                  ))}
                </div>
              )}
              <SchoolDetailRow label="Internal notes" value={viewDetail.notes} />
              {Array.isArray(viewDetail.tutorAssignments) && viewDetail.tutorAssignments.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Active tutor assignments</div>
                  <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--white)', fontSize: 13 }}>
                    {viewDetail.tutorAssignments.map((ta: any) => (
                      <li key={ta.id}>
                        {ta.tutor?.user ? `${ta.tutor.user.firstName} ${ta.tutor.user.lastName}`.trim() : 'Tutor'} ({ta.tutor?.user?.email || '—'})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                Students in system: <strong style={{ color: 'var(--white)' }}>{viewDetail._count?.students ?? 0}</strong>
              </div>
              {viewDetail.status === 'PENDING' && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border2)' }}>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setPendingStatus({ school: viewDetail, next: 'APPROVED', fromView: true })}>
                    Approve school
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => setPendingStatus({ school: viewDetail, next: 'REJECTED', fromView: true })}>
                    Reject
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
      <Modal open={!!editSchool} onClose={() => !savingEmail && setEditSchool(null)} title="Update school admin email">
        <div style={{ display: 'grid', gap: 14 }}>
          <p className="text-muted text-sm" style={{ lineHeight: 1.55 }}>
            Change the email for <strong style={{ color: 'var(--white)' }}>{editSchool?.name}</strong>. Use &quot;Resend pending email&quot; after saving so they get the notice at the new address.
          </p>
          <div className="form-group">
            <label>Admin email</label>
            <input
              className="form-input"
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditSchool(null)} disabled={savingEmail}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={requestSaveAdminEmail} disabled={savingEmail} style={{ minWidth: 120 }}>
              {savingEmail ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
      <ConfirmModal
        open={!!pendingStatus}
        title={pendingStatus?.next === 'APPROVED' ? 'Approve school' : 'Reject school'}
        message={
          pendingStatus ? (
            <>
              {pendingStatus.next === 'APPROVED' ? 'Approve' : 'Reject'}{' '}
              <strong style={{ color: 'var(--white)' }}>{pendingStatus.school?.name}</strong>
              {pendingStatus.next === 'APPROVED'
                ? '? The school admin will be notified and can use the full dashboard after onboarding.'
                : '? The school will be marked rejected; you can explain next steps with the admin separately.'}
            </>
          ) : null
        }
        confirmText={pendingStatus?.next === 'APPROVED' ? 'Approve' : 'Reject'}
        danger={pendingStatus?.next === 'REJECTED'}
        busy={statusConfirmBusy}
        onConfirm={confirmStatusChange}
        onClose={() => !statusConfirmBusy && setPendingStatus(null)}
      />
      <ConfirmModal
        open={!!pendingResend}
        title="Resend pending-approval email"
        message={
          <>
            Send the pending-approval email again for <strong style={{ color: 'var(--white)' }}>{pendingResend?.name}</strong>
            {pendingResend?.admins?.[0]?.email ? (
              <>
                {' '}
                to <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{pendingResend.admins[0].email}</span>
              </>
            ) : null}
            ?
          </>
        }
        confirmText="Send email"
        busy={resendBusy}
        onConfirm={confirmResend}
        onClose={() => !resendBusy && setPendingResend(null)}
      />
      <ConfirmModal
        open={pendingEmailSave}
        title="Save admin email"
        message={
          <>
            Update the school admin email to{' '}
            <strong style={{ color: 'var(--white)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>{editEmail.trim()}</strong>?
            <span className="text-muted text-sm" style={{ display: 'block', marginTop: 10, lineHeight: 1.5 }}>
              Use &quot;Resend&quot; afterward so the admin receives the pending notice at the new address.
            </span>
          </>
        }
        confirmText="Save email"
        busy={savingEmail}
        onConfirm={confirmSaveAdminEmail}
        onClose={() => !savingEmail && setPendingEmailSave(false)}
      />
      <ConfirmModal
        open={!!removeSchool}
        title="Remove pending school"
        message={
          <>
            Permanently remove <strong style={{ color: 'var(--white)' }}>{removeSchool?.name}</strong>? This only works for pending schools with no students. If removal fails, use Reject instead.
          </>
        }
        confirmText="Remove"
        danger
        busy={removing}
        onConfirm={confirmRemove}
        onClose={() => !removing && setRemoveSchool(null)}
      />
      <div className="flex-between mb-20"><div><h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Registered Schools</h3><div className="text-muted text-sm">{schoolArr.length} schools total</div></div></div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['ALL', 'APPROVED', 'PENDING', 'REJECTED'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '8px 16px', borderRadius: 100, fontSize: 12, cursor: 'pointer', background: filter === f ? 'rgba(212,168,83,0.15)' : 'var(--muted3)', border: `1px solid ${filter === f ? 'var(--gold)' : 'var(--border2)'}`, color: filter === f ? 'var(--gold)' : 'var(--muted)' }}>
            {f === 'ALL' ? `All (${schoolArr.length})` : f === 'APPROVED' ? `Active (${schoolArr.filter((s: any) => s.status === 'APPROVED').length})` : f === 'PENDING' ? `Pending (${schoolArr.filter((s: any) => s.status === 'PENDING').length})` : `Rejected (${schoolArr.filter((s: any) => s.status === 'REJECTED').length})`}
          </button>
        ))}
      </div>
      {loading ? <p className="text-muted text-sm" style={{ padding: 20 }}>Loading schools…</p> : (
        <div className="card">
          <table className="data-table">
            <thead><tr><th>School</th><th>Code</th><th>State</th><th>Students</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((s: any) => (
                <tr key={s.id}>
                  <td><div style={{ fontWeight: 600, color: 'var(--white)' }}>{s.name}</div></td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{s.code}</td>
                  <td>{s.state}</td>
                  <td>{s._count?.students || 0}</td>
                  <td><span className={`badge badge-${s.status === 'APPROVED' ? 'success' : s.status === 'PENDING' ? 'warning' : 'danger'}`}>{s.status}</span></td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {s.status === 'PENDING' && (
                      <>
                        <button type="button" onClick={() => setPendingStatus({ school: s, next: 'APPROVED' })} className="btn btn-primary btn-sm" style={{ fontSize: 10 }}>
                          Approve
                        </button>
                        <button type="button" onClick={() => setPendingStatus({ school: s, next: 'REJECTED' })} className="btn btn-danger btn-sm" style={{ fontSize: 10 }}>
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingResend(s)}
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 10 }}
                          title="Resend pending-approval email to the admin"
                        >
                          Resend
                        </button>
                        <button type="button" onClick={() => openEditEmail(s)} className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} title="Update admin email">
                          Email
                        </button>
                        {(s._count?.students || 0) === 0 && (
                          <button type="button" onClick={() => setRemoveSchool(s)} className="btn btn-ghost btn-sm" style={{ fontSize: 10, color: '#F87171' }} title="Remove pending application">
                            Remove
                          </button>
                        )}
                      </>
                    )}
                    <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => openViewSchool(s)} title="View registration details">
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>No schools</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SAApprovals() {
  const { data: schools, loading, setData } = useData(['sa', 'approvals'], () => schoolsApi.all({ status: 'PENDING' }), [])
  const pending = Array.isArray(schools) ? schools : []
  const [actionDone, setActionDone] = useState<Record<string, string>>({})

  const act = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await schoolsApi.updateStatus(id, status)
      setActionDone(a => ({ ...a, [id]: status }))
    } catch (e: any) { notify.fromError(e) }
  }

  return (
    <div>
      <div className="flex-between mb-20"><div><h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Pending Approvals</h3><div className="text-muted text-sm">{pending.length} schools awaiting review</div></div></div>
      {loading && <p className="text-muted text-sm" style={{ padding: 20 }}>Loading…</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {pending.map((s: any) => (
          <div key={s.id} className="card">
            {actionDone[s.id] && <div style={{ background: actionDone[s.id] === 'APPROVED' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${actionDone[s.id] === 'APPROVED' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: actionDone[s.id] === 'APPROVED' ? '#4ADE80' : '#F87171' }}>✓ School {actionDone[s.id].toLowerCase()}</div>}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ fontSize: 36, flexShrink: 0 }}>🏫</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--white)', marginBottom: 4 }}>{s.name}</div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                  <span className="text-muted" style={{ fontSize: 13 }}>📍 {s.state}, {s.lga}</span>
                  <span className="text-muted" style={{ fontSize: 13 }}>📧 {s.admins?.[0]?.email || '—'}</span>
                  <span className="badge badge-warning">PENDING</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 16 }}>
                  {[['Lead contact', s.principalName], ['Phone', s.principalPhone], ['Address', s.address]].filter(([, v]) => v).map(([l, v]) => (
                    <div key={l}><div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3, fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div><div style={{ fontSize: 13, color: 'var(--white)' }}>{v}</div></div>
                  ))}
                </div>
                {!actionDone[s.id] && (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => act(s.id, 'APPROVED')} className="btn btn-primary btn-sm">✓ Approve School</button>
                    <button onClick={() => act(s.id, 'REJECTED')} className="btn btn-danger btn-sm">✗ Reject</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {!loading && pending.length === 0 && <div className="card" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>No pending approvals</div>}
      </div>
    </div>
  )
}

function SATutors() {
  const router = useRouter()
  const { data: tutors, loading, setData } = useData(['sa', 'tutors'], () => tutorsApi.all(), [])
  const { data: schools } = useData(['sa', 'schools-approved'], () => schoolsApi.all({ status: 'APPROVED' }), [])
  const { data: tracks } = useData(['sa', 'tracks-options'], () => tracksApi.all(), [])
  const arr = Array.isArray(tutors) ? tutors : []
  const schoolArr = Array.isArray(schools) ? schools : []
  const trackArr = (Array.isArray(tracks) ? tracks : []).filter((t: any) => t.isActive !== false)
  const trackCodes = trackArr.map((t: any) => String(t.code))
  const [showAdd, setShowAdd] = useState(false)
  const [assignTutorId, setAssignTutorId] = useState('')
  const [saving, setSaving] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [deactivatingId, setDeactivatingId] = useState<string>('')
  const [confirmTutor, setConfirmTutor] = useState<any>(null)
  const [schoolClasses, setSchoolClasses] = useState<any[]>([])
  const [loadingSchoolClasses, setLoadingSchoolClasses] = useState(false)
  const [newTutor, setNewTutor] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    specializations: [] as string[],
    tracks: [] as string[],
  })
  const [specInput, setSpecInput] = useState('')
  const [specOpen, setSpecOpen] = useState(false)
  const specRef = useRef<HTMLDivElement | null>(null)
  const [assignForm, setAssignForm] = useState({
    schoolId: '',
    termLabel: '',
    startDate: new Date().toISOString().slice(0, 10),
    expectedSessionsPerWeek: 3,
    /** Used when assigning TRACK_3 — drives student curriculum for modules 3–4 */
    track3Stack: 'PYTHON_FLASK' as 'PYTHON_FLASK' | 'REACT_NODE',
  })
  /** Tracks from tutor profile — one section of classes per track */
  const [assignTutorTracks, setAssignTutorTracks] = useState<string[]>([])
  /** Selected slots "TRACK_X::CLASSNAME" so same class name on different tracks stays distinct */
  const [selectedClassSlots, setSelectedClassSlots] = useState<string[]>([])
  const assignSeedRef = useRef('')

  const normTrack = (t: string) => String(t || '').trim().toUpperCase()
  const slotKey = (track: string, className: string) => `${normTrack(track)}::${String(className)}`
  /** Matches backend: academic year + current term from school profile. */
  const termLabelFromSchool = (school: any) => {
    const y = String(school?.academicYearLabel || '').trim()
    const cur = String(school?.currentTermLabel || '').trim()
    if (y && cur) return `${y} ${cur}`.replace(/\s+/g, ' ').trim()
    if (cur) return cur
    if (y) return y
    return ''
  }
  const trackLabel = (code: string) =>
    trackArr.find((x: any) => normTrack(x.code) === normTrack(code))?.name ||
    String(code).replace('TRACK_', 'Track ')

  const submitTutor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTutor.tracks.length) {
      notify.warning('Select at least one track this tutor will handle (use the track buttons below).')
      return
    }
    setSaving(true)
    try {
      const created = await tutorsApi.create({
        firstName: newTutor.firstName.trim(),
        lastName: newTutor.lastName.trim(),
        email: newTutor.email.trim().toLowerCase(),
        phone: newTutor.phone.trim() || undefined,
        specializations: Array.from(new Set((newTutor.specializations || []).map((s) => String(s || '').trim()).filter(Boolean))),
        tracks: newTutor.tracks,
      })
      setData([created, ...arr])
      setShowAdd(false)
      setNewTutor({ firstName: '', lastName: '', email: '', phone: '', specializations: [], tracks: [] })
      setSpecInput('')
      notify.success('Tutor created. Default password is Tutor@123')
    } catch (e: any) {
      notify.fromError(e)
    } finally {
      setSaving(false)
    }
  }

  const CURATED_SPECS = [
    'Digital Foundations',
    'Scratch',
    'Computer Basics',
    'Typing & Productivity',
    'Internet Safety',
    'HTML/CSS',
    'JavaScript',
    'TypeScript',
    'Python',
    'Databases',
    'Git/GitHub',
    'React',
    'Node.js',
    'API Design',
    'CBT Authoring',
    'Practical Assessments',
  ]
  const existingSpecs = Array.from(
    new Set(
      (arr || [])
        .flatMap((t: any) => (Array.isArray(t?.specializations) ? t.specializations : []))
        .map((s: any) => String(s || '').trim())
        .filter(Boolean),
    ),
  )
  const specPool = Array.from(new Set([...CURATED_SPECS, ...existingSpecs])).sort((a, b) => a.localeCompare(b))
  const specQuery = specInput.trim().toLowerCase()
  const specSuggestions = specQuery
    ? specPool.filter((s) => s.toLowerCase().includes(specQuery) && !(newTutor.specializations || []).includes(s)).slice(0, 8)
    : specPool.filter((s) => !(newTutor.specializations || []).includes(s)).slice(0, 8)
  const addSpec = (value: string) => {
    const v = String(value || '').trim()
    if (!v) return
    setNewTutor((prev) => {
      const next = Array.from(new Set([...(prev.specializations || []), v]))
      return { ...prev, specializations: next }
    })
    setSpecInput('')
  }
  const removeSpec = (value: string) => {
    setNewTutor((prev) => ({ ...prev, specializations: (prev.specializations || []).filter((s) => s !== value) }))
  }

  const deactivateTutor = async (tutor: any) => {
    const id = String(tutor?.id || '')
    if (!id) return
    setDeactivatingId(id)
    try {
      await tutorsApi.deactivate(id)
      setData((prev: any) => (Array.isArray(prev) ? prev.filter((t: any) => t.id !== id) : prev))
      notify.success('Tutor deactivated.')
    } catch (e: any) {
      notify.fromError(e)
    } finally {
      setDeactivatingId('')
    }
  }

  useEffect(() => {
    if (!specOpen) return
    const onDown = (ev: MouseEvent) => {
      const el = specRef.current
      if (!el) return
      if (ev.target && el.contains(ev.target as Node)) return
      setSpecOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [specOpen])

  const openAssign = (tutorId: string) => {
    const tutor = arr.find((t: any) => t.id === tutorId)
    const raw = Array.isArray(tutor?.tracks) ? tutor.tracks.map((x: any) => String(x)) : []
    setAssignTutorTracks(raw)
    setSelectedClassSlots([])
    assignSeedRef.current = ''
    setAssignTutorId(tutorId)
    const firstSchool = schoolArr[0]
    setAssignForm({
      schoolId: firstSchool?.id || '',
      termLabel: termLabelFromSchool(firstSchool),
      startDate: new Date().toISOString().slice(0, 10),
      expectedSessionsPerWeek: 3,
      track3Stack: 'PYTHON_FLASK',
    })
  }

  useEffect(() => {
    if (!assignTutorId || !assignForm.schoolId) return
    const sch = schoolArr.find((s: any) => s.id === assignForm.schoolId)
    if (!sch) return
    const next = termLabelFromSchool(sch)
    if (next) setAssignForm((f) => (f.termLabel === next ? f : { ...f, termLabel: next }))
  }, [assignTutorId, assignForm.schoolId])

  useEffect(() => {
    const loadSchoolClasses = async () => {
      if (!assignTutorId || !assignForm.schoolId) {
        setSchoolClasses([])
        return
      }
      setLoadingSchoolClasses(true)
      try {
        const rows = await schoolClassesApi.all(assignForm.schoolId)
        setSchoolClasses(Array.isArray(rows) ? rows : [])
      } catch {
        setSchoolClasses([])
      }
      setLoadingSchoolClasses(false)
    }
    loadSchoolClasses()
  }, [assignTutorId, assignForm.schoolId])

  const allSchoolClassRows = Array.isArray(schoolClasses) ? schoolClasses : []

  /** Default: all classes at this school for each of the tutor's tracks — checked (once per school/class list) */
  useEffect(() => {
    if (!assignTutorId || loadingSchoolClasses) return
    const rows = Array.isArray(schoolClasses) ? schoolClasses : []
    const rowsSig = rows
      .map((r: any) => `${normTrack(r.track)}:${String(r.className)}`)
      .sort()
      .join('|')
    const fp = `${assignTutorId}|${assignForm.schoolId}|${assignTutorTracks.join(',')}|${rowsSig}`
    if (assignSeedRef.current === fp) return
    assignSeedRef.current = fp
    const keys: string[] = []
    for (const tr of assignTutorTracks) {
      const ntr = normTrack(tr)
      for (const row of rows) {
        if (normTrack(row.track) === ntr) {
          keys.push(slotKey(ntr, row.className))
        }
      }
    }
    setSelectedClassSlots(Array.from(new Set(keys)))
  }, [assignTutorId, assignForm.schoolId, loadingSchoolClasses, schoolClasses, assignTutorTracks.join('|')])

  const classesForTutorTrack = (trackCode: string) =>
    Array.from(
      new Set(
        allSchoolClassRows
          .filter((c: any) => normTrack(c?.track) === normTrack(trackCode))
          .map((c: any) => String(c.className)),
      ),
    )

  const toggleAssignSlot = (trackCode: string, className: string) => {
    const key = slotKey(trackCode, className)
    setSelectedClassSlots((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const toggleTrackAll = (trackCode: string, selectAll: boolean) => {
    const names = classesForTutorTrack(trackCode)
    const keys = names.map((cn) => slotKey(trackCode, cn))
    setSelectedClassSlots((prev) => {
      if (selectAll) return Array.from(new Set([...prev, ...keys]))
      const drop = new Set(keys)
      return prev.filter((k) => !drop.has(k))
    })
  }

  const submitAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assignTutorId) return
    if (!selectedClassSlots.length) {
      notify.warning('Select at least one class (or add classes / students for this school)')
      return
    }
    const byTrack = new Map<string, string[]>()
    for (const key of selectedClassSlots) {
      const sep = key.indexOf('::')
      if (sep < 0) continue
      const tr = key.slice(0, sep)
      const cn = key.slice(sep + 2)
      if (!cn) continue
      const list = byTrack.get(tr) || []
      if (!list.includes(cn)) list.push(cn)
      byTrack.set(tr, list)
    }
    const startIso = new Date(assignForm.startDate).toISOString()
    setAssigning(true)
    const createdRows: any[] = []
    try {
      for (const [track, classNames] of Array.from(byTrack.entries())) {
        if (!classNames.length) continue
        const assignment = await tutorsApi.assign(assignTutorId, {
          schoolId: assignForm.schoolId,
          track,
          className: classNames[0],
          classNames,
          termLabel: assignForm.termLabel,
          startDate: startIso,
          expectedSessionsPerWeek: assignForm.expectedSessionsPerWeek,
          ...(normTrack(track) === 'TRACK_3' ? { track3Stack: assignForm.track3Stack } : {}),
        })
        createdRows.push(...(Array.isArray(assignment) ? assignment : [assignment]))
      }
      setData(arr.map((t: any) => (t.id === assignTutorId ? { ...t, assignments: [...(t.assignments || []), ...createdRows] } : t)))
      setAssignTutorId('')
      notify.success(`Created ${createdRows.length} assignment(s)`)
    } catch (e: any) {
      notify.fromError(e)
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div>
      <div className="flex-between mb-20">
        <div>
          <h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>All Tutors</h3>
          <div className="text-muted text-sm">{arr.length} tutors on platform</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add Tutor</button>
      </div>
      {loading ? <p className="text-muted text-sm" style={{ padding: 20 }}>Loading…</p> : arr.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 20px' }}>No tutors yet</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {arr.map((t: any) => {
            if (t?.user?.isActive === false) return null
            const name = `${t.user?.firstName} ${t.user?.lastName}`
            const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
            const schoolNames = (t.assignments || [])
              .filter((a: any) => a.isActive !== false)
              .map((a: any) => a.school?.name)
              .filter((n: any, index: number, list: any[]) => !!n && list.indexOf(n) === index)
            const onboard = t.onboardingStatus === 'COMPLETE' ? 'complete' : t.onboardingStatus === 'DRAFT' ? 'draft' : '—'
            return (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                className="card"
                style={{ cursor: 'pointer', transition: 'border-color 0.15s', border: '1px solid var(--border2)' }}
                onClick={() => router.push(`/dashboard/superadmin/tutors/${t.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/dashboard/superadmin/tutors/${t.id}`) } }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                  <div className="stu-av" style={{ width: 48, height: 48, fontSize: 16, background: 'rgba(26,127,212,0.2)', color: 'var(--teal2)', flexShrink: 0 }}>{initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="font-display fw-700 text-white" style={{ fontSize: 15 }}>{name}</div>
                    <div className="text-xs text-muted" style={{ wordBreak: 'break-all' }}>{t.user?.email}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  <span className={`badge badge-${t.isVerified ? 'success' : 'warning'}`} style={{ fontSize: 10 }}>{t.isVerified ? 'Verified' : 'Pending'}</span>
                  {onboard === 'complete' && <span className="badge badge-teal" style={{ fontSize: 10 }}>Profile complete</span>}
                  {onboard === 'draft' && <span className="badge badge-warning" style={{ fontSize: 10 }}>Profile draft</span>}
                  <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 12 }}>★ {t.rating || '—'}</span>
                </div>
                <div className="text-xs text-muted mb-10">Schools</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 14 }}>
                  {schoolNames.length > 0 ? schoolNames.map((sn: string) => <span key={sn} className="badge badge-gold" style={{ fontSize: 10 }}>{sn}</span>) : <span style={{ color: 'var(--muted)', fontSize: 12 }}>Not assigned</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span className="text-xs text-muted">{(t.specializations || []).slice(0, 3).join(' · ') || '—'}</span>
                </div>
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border2)' }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11 }}
                    onClick={(e) => { e.stopPropagation(); openAssign(t.id) }}
                  >
                    Assign school
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    style={{ fontSize: 11, marginLeft: 8 }}
                    disabled={deactivatingId === t.id}
                    onClick={(e) => { e.stopPropagation(); setConfirmTutor(t) }}
                    title="Deactivate tutor (disable login)"
                  >
                    {deactivatingId === t.id ? 'Deactivating…' : 'Delete'}
                  </button>
                  <span className="text-xs text-muted" style={{ marginLeft: 8 }}>Click card for full profile</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmModal
        open={!!confirmTutor}
        title="Deactivate tutor?"
        message={
          <div>
            This will disable the tutor’s login and hide them from lists.
            <div style={{ marginTop: 10, padding: 10, borderRadius: 10, border: '1px solid var(--border2)', background: 'var(--muted3)' }}>
              <div className="text-white" style={{ fontWeight: 700 }}>
                {confirmTutor ? `${confirmTutor.user?.firstName ?? ''} ${confirmTutor.user?.lastName ?? ''}`.trim() || 'Tutor' : 'Tutor'}
              </div>
              <div className="text-xs text-muted" style={{ wordBreak: 'break-all' }}>{confirmTutor?.user?.email}</div>
            </div>
          </div>
        }
        confirmText="Deactivate"
        cancelText="Cancel"
        danger
        busy={!!confirmTutor && deactivatingId === confirmTutor?.id}
        onClose={() => { if (!deactivatingId) setConfirmTutor(null) }}
        onConfirm={() => { if (confirmTutor) deactivateTutor(confirmTutor).finally(() => setConfirmTutor(null)) }}
      />

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Tutor">
        <form onSubmit={submitTutor} style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <div><label className="form-label">First name</label><input required className="form-input" value={newTutor.firstName} onChange={(e) => setNewTutor({ ...newTutor, firstName: e.target.value })} /></div>
            <div><label className="form-label">Last name</label><input required className="form-input" value={newTutor.lastName} onChange={(e) => setNewTutor({ ...newTutor, lastName: e.target.value })} /></div>
          </div>
          <div><label className="form-label">Email</label><input required type="email" className="form-input" value={newTutor.email} onChange={(e) => setNewTutor({ ...newTutor, email: e.target.value })} /></div>
          <div><label className="form-label">Phone</label><input className="form-input" value={newTutor.phone} onChange={(e) => setNewTutor({ ...newTutor, phone: e.target.value })} /></div>
          <div>
            <label className="form-label">Specializations</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {(newTutor.specializations || []).map((s) => (
                <span key={s} className="badge badge-teal" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', fontSize: 11 }}>
                  {s}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: 0, minWidth: 18, height: 18, lineHeight: '18px', fontSize: 12 }}
                    onClick={() => removeSpec(s)}
                    title="Remove"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div ref={specRef} style={{ position: 'relative' }}>
              <input
                className="form-input"
                placeholder="Type a skill and press Enter…"
                value={specInput}
                onChange={(e) => setSpecInput(e.target.value)}
                onFocus={() => setSpecOpen(true)}
                onClick={() => setSpecOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addSpec(specInput)
                    setSpecOpen(true)
                  }
                  if (e.key === ',' ) {
                    e.preventDefault()
                    addSpec(specInput)
                    setSpecOpen(true)
                  }
                }}
              />
              {specOpen && specSuggestions.length > 0 && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 20, background: 'var(--navy2)', border: '1px solid var(--border2)', borderRadius: 10, overflow: 'hidden' }}>
                  {specSuggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="btn btn-ghost"
                      style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, padding: '10px 12px' }}
                      onClick={() => { addSpec(s); setSpecOpen(false) }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="text-muted text-xs mt-6">Suggestions appear as you type. Press Enter to add a custom specialization.</div>
          </div>
          <div>
            <label className="form-label">Program tracks (select all that apply)</label>
            <p className="text-muted text-xs" style={{ margin: '0 0 8px', lineHeight: 1.45 }}>
              Toggle each track this tutor is qualified to teach. Multiple selections are allowed. These drive which class groups appear when you assign the tutor to a school.
            </p>
            {(() => {
              const trackOptions = (trackArr.length ? trackArr : [{ code: 'TRACK_1', name: 'Track 1' }, { code: 'TRACK_2', name: 'Track 2' }, { code: 'TRACK_3', name: 'Track 3' }]) as any[]
              const allCodes = trackOptions.map((t: any) => String(t.code))
              return (
                <>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 11 }}
                      onClick={() => setNewTutor((prev) => ({ ...prev, tracks: [...allCodes] }))}
                    >
                      Select all tracks
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 11 }}
                      onClick={() => setNewTutor((prev) => ({ ...prev, tracks: [] }))}
                    >
                      Clear
                    </button>
                    <span className="text-muted text-xs" style={{ alignSelf: 'center' }}>
                      {newTutor.tracks.length} selected
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {trackOptions.map((track: any) => (
                      <button
                        key={track.code}
                        type="button"
                        onClick={() =>
                          setNewTutor((prev) => ({
                            ...prev,
                            tracks: prev.tracks.includes(track.code) ? prev.tracks.filter((t) => t !== track.code) : [...prev.tracks, track.code],
                          }))
                        }
                        className="btn btn-ghost btn-sm"
                        style={{
                          fontSize: 11,
                          borderColor: newTutor.tracks.includes(track.code) ? 'var(--gold)' : undefined,
                          color: newTutor.tracks.includes(track.code) ? 'var(--gold)' : undefined,
                          fontWeight: newTutor.tracks.includes(track.code) ? 600 : 400,
                        }}
                      >
                        {newTutor.tracks.includes(track.code) ? '✓ ' : ''}
                        {track.name || String(track.code).replace('TRACK_', 'Track ')}
                      </button>
                    ))}
                  </div>
                </>
              )
            })()}
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            style={{ justifySelf: 'center', justifyContent: 'center', minWidth: 160 }}
            disabled={saving}
          >
            {saving ? 'Creating…' : 'Create Tutor'}
          </button>
        </form>
      </Modal>

      <Modal open={!!assignTutorId} onClose={() => setAssignTutorId('')} title="Assign Tutor to School">
        <form onSubmit={submitAssign} style={{ display: 'grid', gap: 12 }}>
          {(() => {
            const assignTutor = arr.find((t: any) => t.id === assignTutorId)
            const assignName = assignTutor ? `${assignTutor.user?.firstName || ''} ${assignTutor.user?.lastName || ''}`.trim() : ''
            return assignName ? (
              <div className="text-muted text-sm" style={{ lineHeight: 1.5 }}>
                <strong className="text-white">{assignName}</strong>
                <div className="mt-4">
                  Tutor profile tracks:{' '}
                  {assignTutorTracks.length
                    ? assignTutorTracks.map((c) => (
                        <span key={c} className="badge badge-teal" style={{ fontSize: 10, marginRight: 4 }}>
                          {trackLabel(c)}
                        </span>
                      ))
                    : '—'}
                </div>
                <div className="text-xs mt-4">Classes below are grouped by those tracks. All are selected by default — uncheck any you don’t want.</div>
              </div>
            ) : null
          })()}
          <div>
            <label className="form-label">School</label>
            <select
              required
              className="form-input"
              value={assignForm.schoolId}
              onChange={(e) => {
                assignSeedRef.current = ''
                setAssignForm({ ...assignForm, schoolId: e.target.value })
              }}
            >
              <option value="">Select school</option>
              {schoolArr.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Selected class slots</label>
            <input readOnly className="form-input" value={selectedClassSlots.length ? `${selectedClassSlots.length} selected` : 'None'} />
          </div>
          <div>
            <label className="form-label">Target classes by track</label>
            {loadingSchoolClasses ? (
              <div className="text-muted text-sm">Loading classes…</div>
            ) : assignTutorTracks.length === 0 ? (
              <div className="text-muted text-sm" style={{ lineHeight: 1.5 }}>
                No program tracks are saved for this tutor. New tutors must choose at least one in <strong>Add Tutor → Program tracks</strong>. Tutors created without tracks need their profile updated (e.g. PATCH tutor with <code style={{ fontSize: 11 }}>tracks</code>) before assignment.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {assignTutorTracks.map((trackCode) => {
                  const names = classesForTutorTrack(trackCode)
                  const allKeys = names.map((cn) => slotKey(trackCode, cn))
                  const allOn = allKeys.length > 0 && allKeys.every((k) => selectedClassSlots.includes(k))
                  return (
                    <div key={trackCode} style={{ border: '1px solid var(--border2)', borderRadius: 10, padding: 12, background: 'var(--muted3)' }}>
                      <div className="flex-between mb-10" style={{ alignItems: 'center', gap: 8 }}>
                        <div className="font-display fw-600 text-white" style={{ fontSize: 14 }}>{trackLabel(trackCode)}</div>
                        {names.length > 0 && (
                          <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => toggleTrackAll(trackCode, !allOn)}>
                            {allOn ? 'Uncheck all' : 'Check all'}
                          </button>
                        )}
                      </div>
                      {names.length === 0 ? (
                        <div className="text-muted text-sm">No classes at this school for this track yet.</div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,220px))', gap: 8 }}>
                          {names.map((className) => {
                            const key = slotKey(trackCode, className)
                            return (
                              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--border2)', borderRadius: 8, cursor: 'pointer', background: 'var(--navy2)' }}>
                                <input
                                  type="checkbox"
                                  checked={selectedClassSlots.includes(key)}
                                  onChange={() => toggleAssignSlot(trackCode, className)}
                                  style={{ accentColor: 'var(--teal)' }}
                                />
                                <span style={{ fontSize: 13, color: 'var(--white)' }}>{className}</span>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
                {allSchoolClassRows.length === 0 && !loadingSchoolClasses && (
                  <div className="text-muted text-sm" style={{ lineHeight: 1.5 }}>
                    No class list for this school yet. Add classes in <strong>School Admin → Classes</strong>, or enroll students (classes are inferred from student records).
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="form-label">Term label</label>
              <p className="text-muted text-xs mb-4" style={{ lineHeight: 1.45 }}>
                Auto-filled from the school’s <strong className="text-white">academic year</strong> and <strong className="text-white">current term</strong>. When a <strong className="text-white">new term</strong> starts, update those fields on the school first, then assign tutors again — a new assignment row is created for the new term. Older term assignments for the same class are closed automatically when the new one is created; <strong className="text-white">grades, attendance, and module progress stay in the database</strong> for reporting and student history.
              </p>
              <input
                className="form-input"
                placeholder="e.g. 2025/2026 Second Term"
                value={assignForm.termLabel}
                onChange={(e) => setAssignForm({ ...assignForm, termLabel: e.target.value })}
              />
            </div>
            <div><label className="form-label">Start date</label><input required type="date" className="form-input" value={assignForm.startDate} onChange={(e) => setAssignForm({ ...assignForm, startDate: e.target.value })} /></div>
          </div>
          {assignTutorTracks.some((t) => normTrack(t) === 'TRACK_3') && (
            <div>
              <label className="form-label">Track 3 curriculum (modules 3–4)</label>
              <select
                className="form-input"
                value={assignForm.track3Stack}
                onChange={(e) =>
                  setAssignForm({
                    ...assignForm,
                    track3Stack: e.target.value as 'PYTHON_FLASK' | 'REACT_NODE',
                  })
                }
              >
                <option value="PYTHON_FLASK">Python / Flask</option>
                <option value="REACT_NODE">React / Node (backend)</option>
              </select>
              <p className="text-muted text-xs mt-4">Students in assigned SS3 Track 3 classes see this stack for the branching modules. Applies to each Track 3 assignment you create in this form.</p>
            </div>
          )}
          <div>
            <label className="form-label">Expected sessions per week (per class)</label>
            <input
              type="number"
              min={1}
              max={14}
              className="form-input"
              style={{ maxWidth: 120 }}
              value={assignForm.expectedSessionsPerWeek}
              onChange={(e) => setAssignForm({ ...assignForm, expectedSessionsPerWeek: Math.min(14, Math.max(1, parseInt(e.target.value, 10) || 3)) })}
            />
            <p className="text-muted text-xs mt-4">Used for “delivered vs expected” on session coverage (1–14). Default 3.</p>
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            style={{ justifySelf: 'end', justifyContent: 'center', minWidth: 160 }}
            disabled={assigning}
          >
            {assigning ? 'Assigning…' : 'Assign Tutor'}
          </button>
        </form>
      </Modal>
    </div>
  )
}

function SAReports() {
  const { data: reports, loading, setData } = useData(['sa', 'reports'], () => reportsApi.all(), [])
  const arr = Array.isArray(reports) ? reports : []
  const [reviewing, setReviewing] = useState<string>('')
  const [reviewNote, setReviewNote] = useState<Record<string,string>>({})
  const [expanded, setExpanded] = useState<string>('')

  const review = async (r: any) => {
    try {
      await reportsApi.review(r.id, reviewNote[r.id] || 'Reviewed by Super Admin')
      setData(arr.map((x:any) => x.id===r.id ? {...x, status:'REVIEWED'} : x))
      setReviewing('')
    } catch(e:any){ notify.fromError(e) }
  }

  return (
    <div>
      <div className="flex-between mb-20"><div><h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Weekly Tutor Reports</h3><div className="text-muted text-sm">{arr.filter((r:any)=>r.status==='SUBMITTED').length} awaiting review</div></div></div>
      {loading ? <p className="text-muted text-sm" style={{ padding: 20 }}>Loading…</p> : (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {arr.map((r: any) => (
            <div key={r.id} className="card">
              <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,color:'var(--white)',fontSize:15}}>{r.tutor?.user?.firstName} {r.tutor?.user?.lastName}</div>
                  <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:4}}>
                    <span className="text-muted" style={{fontSize:12}}>{r.school?.name}</span>
                    <span className="text-muted" style={{fontSize:12}}>{new Date(r.weekStart).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })} – {new Date(r.weekEnd).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}</span>
                    {r.attendanceRate > 0 && <span style={{fontSize:12,color:r.attendanceRate>=85?'var(--success)':'var(--warning)'}}>Attendance: {r.attendanceRate}%</span>}
                  </div>
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <span className={`badge badge-${r.status === 'REVIEWED' ? 'success' : r.status === 'SUBMITTED' ? 'teal' : 'warning'}`}>{r.status}</span>
                  <button onClick={()=>setExpanded(expanded===r.id?'':r.id)} className="btn btn-ghost btn-sm" style={{fontSize:11}}>{expanded===r.id?'Hide':'View Details'}</button>
                  {r.status==='SUBMITTED' && <button onClick={()=>setReviewing(r.id)} className="btn btn-primary btn-sm" style={{fontSize:11}}>Review →</button>}
                </div>
              </div>
              {expanded===r.id && (
                <div style={{marginTop:16,paddingTop:16,borderTop:'1px solid var(--border2)'}}>
                  {r.highlights && <div style={{marginBottom:12}}><div className="form-label">Highlights</div><p className="text-muted text-sm">{r.highlights}</p></div>}
                  {r.challenges && <div style={{marginBottom:12}}><div className="form-label">Challenges</div><p className="text-muted text-sm">{r.challenges}</p></div>}
                  {r.nextWeekPlan && <div style={{marginBottom:12}}><div className="form-label">Next Week Plan</div><p className="text-muted text-sm">{r.nextWeekPlan}</p></div>}
                  {r.reviewNotes && <div style={{background:'rgba(34,197,94,0.08)',border:'1px solid rgba(34,197,94,0.2)',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#4ADE80'}}><strong>Review Note:</strong> {r.reviewNotes}</div>}
                </div>
              )}
              {reviewing===r.id && (
                <div style={{marginTop:14,paddingTop:14,borderTop:'1px solid var(--border2)',display:'flex',gap:10}}>
                  <input className="form-input" style={{flex:1}} placeholder="Add review note (optional)…" value={reviewNote[r.id]||''} onChange={e=>setReviewNote(n=>({...n,[r.id]:e.target.value}))} />
                  <button onClick={()=>review(r)} className="btn btn-primary btn-sm">Mark Reviewed ✓</button>
                  <button onClick={()=>setReviewing('')} className="btn btn-ghost btn-sm">Cancel</button>
                </div>
              )}
            </div>
          ))}
          {arr.length === 0 && <div className="card" style={{textAlign:'center',padding:'40px 0',color:'var(--muted)'}}>No reports yet</div>}
        </div>
      )}
    </div>
  )
}

function SAAssessments() {
  const { data: exams, loading, setData } = useData(['sa', 'assessments'], () => cbtApi.all(), [])
  const { data: schools } = useData(['sa', 'practical-schools'], () => schoolsApi.all(), [])
  const arr = Array.isArray(exams) ? exams : []
  const schoolArr = Array.isArray(schools) ? schools : []
  const [vetted, setVetted] = useState<Record<string, boolean>>({})
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewExam, setPreviewExam] = useState<any>(null)
  const [schoolId, setSchoolId] = useState('')
  const [loadingPracticals, setLoadingPracticals] = useState(true)
  const [practicalSummary, setPracticalSummary] = useState({ tasks: 0, submissions: 0, graded: 0, passRate: 0, pending: 0 })
  const [practicalRows, setPracticalRows] = useState<Array<{ schoolName: string; module: string; className: string; avgScore: number; passRate: number; submissions: number }>>([])

  useEffect(() => {
    const loadPracticals = async () => {
      setLoadingPracticals(true)
      try {
        const tasksRaw = await practicalsApi.listTasks(schoolId ? { schoolId } : undefined).catch(() => [])
        const tasks = Array.isArray(tasksRaw) ? tasksRaw : []
        if (!tasks.length) {
          setPracticalSummary({ tasks: 0, submissions: 0, graded: 0, passRate: 0, pending: 0 })
          setPracticalRows([])
          setLoadingPracticals(false)
          return
        }
        const submissionsByTask = await Promise.all(tasks.map((t: any) => practicalsApi.submissions(t.id).catch(() => [])))
        const allSubmissions = submissionsByTask.flat()
        const graded = allSubmissions.filter((s: any) => typeof s?.totalScore === 'number')
        const passed = graded.filter((s: any) => String(s?.status || '').toUpperCase() === 'PASSED')
        const pending = allSubmissions.length - graded.length
        setPracticalSummary({
          tasks: tasks.length,
          submissions: allSubmissions.length,
          graded: graded.length,
          passRate: graded.length ? Math.round((passed.length / graded.length) * 100) : 0,
          pending: Math.max(0, pending),
        })

        const rollup = new Map<string, { schoolName: string; module: string; className: string; total: number; passed: number; count: number }>()
        tasks.forEach((task: any, idx: number) => {
          const subs = (Array.isArray(submissionsByTask[idx]) ? submissionsByTask[idx] : []).filter((s: any) => typeof s?.totalScore === 'number')
          if (!subs.length) return
          const moduleLabel = task?.module ? `Module ${task.module.number}: ${task.module.title}` : (task?.title || 'Practical')
          const className = task?.className || '—'
          const schoolName = task?.schoolName || schoolArr.find((s: any) => s.id === task.schoolId)?.name || 'Unknown School'
          const key = `${schoolName}::${moduleLabel}::${className}`
          const existing = rollup.get(key) || { schoolName, module: moduleLabel, className, total: 0, passed: 0, count: 0 }
          subs.forEach((s: any) => {
            const score = Number(s.totalScore || 0)
            existing.total += score
            existing.count += 1
            if (String(s?.status || '').toUpperCase() === 'PASSED') existing.passed += 1
          })
          rollup.set(key, existing)
        })
        const rows = Array.from(rollup.values())
          .map((r) => ({
            schoolName: r.schoolName,
            module: r.module,
            className: r.className,
            submissions: r.count,
            avgScore: r.count ? Math.round(r.total / r.count) : 0,
            passRate: r.count ? Math.round((r.passed / r.count) * 100) : 0,
          }))
          .sort((a, b) => b.avgScore - a.avgScore)
        setPracticalRows(rows.slice(0, 12))
      } catch {
        setPracticalSummary({ tasks: 0, submissions: 0, graded: 0, passRate: 0, pending: 0 })
        setPracticalRows([])
      }
      setLoadingPracticals(false)
    }
    loadPracticals()
  }, [schoolId, schoolArr.length])

  const vetExam = async (id: string, approved: boolean) => {
    try {
      await cbtApi.vet(id, approved)
      setVetted(v => ({ ...v, [id]: approved }))
      if (approved) await cbtApi.publish(id)
    } catch (e: any) { notify.fromError(e) }
  }

  const openPreview = async (id: string) => {
    setPreviewOpen(true)
    setPreviewLoading(true)
    setPreviewExam(null)
    try {
      const exam = await cbtApi.one(id, true)
      setPreviewExam(exam)
    } catch (e: any) {
      notify.fromError(e, 'Could not load questions')
      setPreviewOpen(false)
    }
    setPreviewLoading(false)
  }

  return (
    <div>
      <Modal open={previewOpen} onClose={() => { setPreviewOpen(false); setPreviewExam(null) }} title="Preview CBT questions">
        {previewLoading ? (
          <div className="text-muted text-sm">Loading questions…</div>
        ) : previewExam?.questions?.length ? (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="badge badge-info">{previewExam.track?.replace('TRACK_', 'Track ')}</span>
              <span className="badge badge-teal">{previewExam.durationMins} min</span>
              <span className="text-muted text-xs">{previewExam.questions.length} questions</span>
            </div>
            {previewExam.questions.map((q: any) => (
              <div key={q.id || q.number} style={{ border: '1px solid var(--border2)', borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 700, color: 'var(--white)', marginBottom: 10 }}>{`Q${q.number}. ${q.questionText}`}</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {(q.options || []).map((opt: string, idx: number) => {
                    const isCorrect = idx === q.correctIndex
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 10,
                          border: `1px solid ${isCorrect ? 'rgba(34,197,94,0.35)' : 'var(--border2)'}`,
                          background: isCorrect ? 'rgba(34,197,94,0.10)' : 'var(--muted3)',
                          color: isCorrect ? '#4ADE80' : 'var(--white)',
                          fontSize: 13,
                        }}
                      >
                        <strong style={{ marginRight: 8 }}>{String.fromCharCode(65 + idx)}.</strong> {opt}
                      </div>
                    )
                  })}
                </div>
                {q.explanation && (
                  <div className="text-muted text-xs" style={{ marginTop: 10, lineHeight: 1.6 }}>
                    <strong style={{ color: 'var(--muted)' }}>Explanation:</strong> {q.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted text-sm">No questions found.</div>
        )}
      </Modal>

      <div className="flex-between mb-20"><div><h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Assessment Vetting</h3><div className="text-muted text-sm">Review and approve tutor-built CBT assessments before they go live</div></div></div>
      <div className="card mb-20">
        <div className="flex-between mb-16">
          <div>
            <div className="font-display fw-700 text-white" style={{ fontSize: 16 }}>Practical Performance Rollup</div>
            <div className="text-muted text-sm">Cross-school practical grading and pass-rate visibility</div>
          </div>
          <div style={{ minWidth: 220 }}>
            <select className="form-input" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} style={{ appearance: 'none' }}>
              <option value="">All schools</option>
              {schoolArr.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="stats-row" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 16 }}>
          <div className="stat-card"><div className="stat-card-icon" style={{ background: 'rgba(139,92,246,0.15)' }}>🧪</div><div className="stat-card-value">{practicalSummary.tasks}</div><div className="stat-card-label">Tasks</div></div>
          <div className="stat-card"><div className="stat-card-icon" style={{ background: 'rgba(26,127,212,0.15)' }}>📥</div><div className="stat-card-value">{practicalSummary.submissions}</div><div className="stat-card-label">Submissions</div></div>
          <div className="stat-card"><div className="stat-card-icon" style={{ background: 'rgba(34,197,94,0.15)' }}>✅</div><div className="stat-card-value">{practicalSummary.graded}</div><div className="stat-card-label">Graded</div></div>
          <div className="stat-card"><div className="stat-card-icon" style={{ background: 'rgba(212,168,83,0.15)' }}>📈</div><div className="stat-card-value">{practicalSummary.passRate}%</div><div className="stat-card-label">Pass Rate</div></div>
          <div className="stat-card"><div className="stat-card-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>⌛</div><div className="stat-card-value">{practicalSummary.pending}</div><div className="stat-card-label">Pending</div></div>
        </div>
        <table className="data-table">
          <thead><tr><th>School</th><th>Module Practical</th><th>Class</th><th>Submissions</th><th>Avg Score</th><th>Pass Rate</th></tr></thead>
          <tbody>
            {loadingPracticals && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0' }}>Loading practical performance…</td></tr>}
            {!loadingPracticals && practicalRows.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0' }}>No graded practical submissions yet</td></tr>}
            {!loadingPracticals && practicalRows.map((r) => (
              <tr key={`${r.schoolName}-${r.module}-${r.className}`}>
                <td>{r.schoolName}</td>
                <td>{r.module}</td>
                <td>{r.className}</td>
                <td>{r.submissions}</td>
                <td><strong style={{ color: r.avgScore >= 50 ? 'var(--success)' : 'var(--danger)' }}>{r.avgScore}%</strong></td>
                <td><strong style={{ color: r.passRate >= 70 ? 'var(--gold)' : 'var(--muted)' }}>{r.passRate}%</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading ? <p className="text-muted text-sm" style={{ padding: 20 }}>Loading…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {arr.map((e: any) => {
            const isApproved = vetted[e.id] !== undefined ? vetted[e.id] : (e.isVetted && e.isPublished)
            const isRejected = vetted[e.id] === false
            return (
              <div key={e.id} className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--white)', marginBottom: 6 }}>{e.title}</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span className="text-muted" style={{ fontSize: 12 }}>👩‍🏫 {e.tutor?.user?.firstName} {e.tutor?.user?.lastName}</span>
                      <span className="text-muted" style={{ fontSize: 12 }}>📝 {e.totalQuestions} questions</span>
                      <span className="text-muted" style={{ fontSize: 12 }}>⏱ {e.durationMins} min</span>
                      <span className="text-muted" style={{ fontSize: 12 }}>🎯 {e.track?.replace('TRACK_', 'Track ')}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {isApproved && <span className="badge badge-success">✓ Vetted &amp; Live</span>}
                    {isRejected && <span className="badge badge-danger">✗ Rejected</span>}
                    {!isApproved && !isRejected && <>
                      <button onClick={() => openPreview(e.id)} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>Preview Questions</button>
                      <button onClick={() => vetExam(e.id, true)} className="btn btn-primary btn-sm" style={{ fontSize: 11 }}>✓ Approve &amp; Publish</button>
                      <button onClick={() => vetExam(e.id, false)} className="btn btn-danger btn-sm" style={{ fontSize: 11 }}>✗ Reject</button>
                    </>}
                  </div>
                </div>
              </div>
            )
          })}
          {arr.length === 0 && <div className="card" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>No assessments submitted for vetting yet</div>}
        </div>
      )}
    </div>
  )
}

function SAPayments() {
  const { data: payments, loading } = useData(['sa', 'payments'], () => paymentsApi.all(), [])
  const { data: summary } = useData(['sa', 'payments-summary'], () => paymentsApi.summary(), { total: 0, paid: 0, unpaid: 0, count: 0 })
  const arr = Array.isArray(payments) ? payments : []
  const s = { ...DEFAULT_PAYMENTS_SUMMARY, ...(summary ?? {}) }

  return (
    <div>
      <h3 className="font-display fw-700 text-white mb-20" style={{ fontSize: 20 }}>Payments</h3>
      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
        {[
          { glow: 'var(--gold)', icon: '💰', bg: 'rgba(212,168,83,0.15)', val: `₦${((s.total || 0) / 1000).toFixed(0)}k`, label: 'Total Invoiced', delta: `${s.count || 0} invoices` },
          { glow: 'var(--success)', icon: '✅', bg: 'rgba(34,197,94,0.15)', val: `₦${((s.paid || 0) / 1000).toFixed(0)}k`, label: 'Collected', delta: `${s.paidCount || 0} paid` },
          { glow: 'var(--danger)', icon: '⏳', bg: 'rgba(239,68,68,0.15)', val: `₦${((s.unpaid || 0) / 1000).toFixed(0)}k`, label: 'Outstanding', delta: `${(s.count || 0) - (s.paidCount || 0)} pending` },
          { glow: 'var(--teal)', icon: '🏫', bg: 'rgba(26,127,212,0.15)', val: s.count || 0, label: 'Total Invoices', delta: 'All terms' },
        ].map((row) => (
          <div key={row.label} className="stat-card"><div className="stat-glow" style={{ background: row.glow }}></div><div className="stat-card-icon" style={{ background: row.bg }}>{row.icon}</div><div className="stat-card-value">{row.val}</div><div className="stat-card-label">{row.label}</div><div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>{row.delta}</div></div>
        ))}
      </div>
      {loading ? <p className="text-muted text-sm" style={{ padding: 20 }}>Loading…</p> : (
        <div className="card">
          <table className="data-table">
            <thead><tr><th>School</th><th>Description</th><th>Term</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {arr.map((p: any) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600, color: 'var(--white)' }}>{p.school?.name}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{p.description}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{p.termLabel}</td>
                  <td><strong style={{ color: 'var(--white)' }}>₦{(p.amount || 0).toLocaleString()}</strong></td>
                  <td><span className={`badge badge-${p.isPaid ? 'success' : 'warning'}`}>{p.isPaid ? 'Paid' : 'Pending'}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                </tr>
              ))}
              {arr.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>No payments yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


function SAPayroll() {
  const { data: payrolls, loading, setData } = useData(['sa', 'payroll'], () => payrollApi.all(), [])
  const { data: summary } = useData(['sa', 'payroll-summary'], () => payrollApi.summary(), { totalPayroll:0, paid:0, unpaid:0, tutorCount:0 })
  const arr = Array.isArray(payrolls) ? payrolls : []
  const s = { ...DEFAULT_PAYROLL_SUMMARY, ...(summary ?? {}) }
  const [calculating, setCalculating] = useState(false)

  const calcAll = async () => {
    setCalculating(true)
    let tutors: any[] = []
    try {
      const t = await tutorsApi.all()
      tutors = Array.isArray(t) ? t : []
    } catch (e: any) {
      notify.fromError(e, 'Could not load tutors')
      setCalculating(false)
      return
    }
    const now = new Date()
    let ok = 0
    let failed = 0
    for (const t of Array.isArray(tutors)?tutors:[]) {
      for (const a of t.assignments||[]) {
        try {
          await payrollApi.calculate(t.id, a.schoolId, now.getMonth() + 1, now.getFullYear())
          ok += 1
        } catch {
          failed += 1
        }
      }
    }
    try {
      const refreshed = await payrollApi.all()
      setData(Array.isArray(refreshed) ? refreshed : [])
    } catch (e: any) {
      notify.fromError(e, 'Could not refresh payroll list')
    }
    if (failed === 0) notify.success(`Payroll calculated for ${ok} assignment(s)`)
    else notify.warning(`Payroll calculated for ${ok} assignment(s); ${failed} failed`)
    setCalculating(false)
  }

  const markPaid = async (id:string) => {
    try { await payrollApi.markPaid(id); setData(arr.map((p:any)=>p.id===id?{...p,isPaid:true}:p)) } catch(e:any){ notify.fromError(e) }
  }

  return (
    <div>
      <div className="flex-between mb-20">
        <div><h3 className="font-display fw-700 text-white" style={{fontSize:20}}>Tutor Payroll</h3><div className="text-muted text-sm">AdharaEdu pays tutors based on sessions taught</div></div>
        <button onClick={calcAll} disabled={calculating} className="btn btn-primary btn-sm">{calculating?'Calculating…':'Calculate This Month'}</button>
      </div>
      <div className="stats-row" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:24}}>
        {[{glow:'var(--gold)',icon:'💰',bg:'rgba(212,168,83,0.15)',val:`₦${((s.totalPayroll||0)/1000).toFixed(0)}k`,label:'Total Payroll',delta:'This year'},
          {glow:'var(--success)',icon:'✅',bg:'rgba(34,197,94,0.15)',val:`₦${((s.paid||0)/1000).toFixed(0)}k`,label:'Paid Out',delta:'Processed'},
          {glow:'var(--danger)',icon:'⏳',bg:'rgba(239,68,68,0.15)',val:`₦${((s.unpaid||0)/1000).toFixed(0)}k`,label:'Outstanding',delta:'Due to tutors'},
          {glow:'var(--teal)',icon:'👩‍🏫',bg:'rgba(26,127,212,0.15)',val:s.tutorCount||0,label:'Tutors on Payroll',delta:'Active'},
        ].map((row)=>(
          <div key={row.label} className="stat-card"><div className="stat-glow" style={{background:row.glow}}></div><div className="stat-card-icon" style={{background:row.bg}}>{row.icon}</div><div className="stat-card-value">{row.val}</div><div className="stat-card-label">{row.label}</div><div className="text-muted" style={{fontSize:11,marginTop:4}}>{row.delta}</div></div>
        ))}
      </div>
      {loading ? <p className="text-muted text-sm" style={{padding:20}}>Loading…</p> : (
        <div className="card">
          <table className="data-table">
            <thead><tr><th>Tutor</th><th>School</th><th>Month</th><th>Sessions</th><th>Rate</th><th>Net Amount</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {arr.map((p:any) => (
                <tr key={p.id}>
                  <td style={{fontWeight:600,color:'var(--white)'}}>{p.tutor?.user?.firstName} {p.tutor?.user?.lastName}</td>
                  <td>{p.school?.name}</td>
                  <td style={{fontSize:12,color:'var(--muted)'}}>{new Date(p.year,p.month-1).toLocaleString('en-NG',{month:'long',year:'numeric'})}</td>
                  <td>{p.totalSessions}</td>
                  <td style={{fontSize:12}}>₦{p.ratePerSession?.toLocaleString()}/session</td>
                  <td><strong style={{color:'var(--white)'}}>₦{p.netAmount?.toLocaleString()}</strong></td>
                  <td><span className={`badge badge-${p.isPaid?'success':'warning'}`}>{p.isPaid?'Paid':'Pending'}</span></td>
                  <td>{!p.isPaid&&<button onClick={()=>markPaid(p.id)} className="btn btn-primary btn-sm" style={{fontSize:11}}>Mark Paid ✓</button>}</td>
                </tr>
              ))}
              {arr.length===0&&<tr><td colSpan={8} style={{textAlign:'center',color:'var(--muted)',padding:'32px 0'}}>No payroll records yet. Click "Calculate This Month" above.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SATracks() {
  const { data: tracks, loading, setData } = useData(['sa', 'tracks'], () => tracksApi.all(), [])
  const arr = Array.isArray(tracks) ? tracks : []
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', description: '', isActive: true })

  const createTrack = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const created = await tracksApi.create({
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        isActive: form.isActive,
      })
      setData((prev: any) => [created, ...(Array.isArray(prev) ? prev : [])])
      setForm({ code: '', name: '', description: '', isActive: true })
      setShowAdd(false)
    } catch (e: any) {
      notify.fromError(e)
    }
    setSaving(false)
  }

  const toggleActive = async (t: any) => {
    try {
      const updated = await tracksApi.update(t.id, { isActive: !t.isActive })
      setData((prev: any[]) => (Array.isArray(prev) ? prev.map((x: any) => (x.id === t.id ? updated : x)) : [updated]))
    } catch (e: any) {
      notify.fromError(e)
    }
  }

  return (
    <div>
      <div className="flex-between mb-20">
        <div>
          <h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Program Tracks</h3>
          <div className="text-muted text-sm">Create and manage tracks available to schools and tutors</div>
        </div>
        <button onClick={() => setShowAdd((v) => !v)} className="btn btn-primary btn-sm">+ New Track</button>
      </div>

      {showAdd && (
        <div className="card mb-20">
          <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 16 }}>Create Track</div>
          <form onSubmit={createTrack} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label className="form-label">Code</label>
              <input className="form-input" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="TRACK_4" />
            </div>
            <div>
              <label className="form-label">Name</label>
              <input className="form-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Cybersecurity Foundations" />
            </div>
            <div>
              <label className="form-label">Description</label>
              <input className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional short description" />
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Create'}</button>
          </form>
        </div>
      )}

      {loading ? <p className="text-muted text-sm" style={{ padding: 20 }}>Loading tracks…</p> : (
        <div className="card">
          <table className="data-table">
            <thead><tr><th>Code</th><th>Name</th><th>Description</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {arr.map((t: any) => (
                <tr key={t.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{t.code}</td>
                  <td style={{ fontWeight: 600, color: 'var(--white)' }}>{t.name}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{t.description || '—'}</td>
                  <td><span className={`badge badge-${t.isActive ? 'success' : 'warning'}`}>{t.isActive ? 'Active' : 'Archived'}</span></td>
                  <td><button onClick={() => toggleActive(t)} className="btn btn-ghost btn-sm">{t.isActive ? 'Archive' : 'Activate'}</button></td>
                </tr>
              ))}
              {arr.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>No tracks found</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SAModules() {
  const { data: modules, loading, setData } = useData(['sa', 'modules'], () => modulesApi.all(), [])
  const { data: tracks } = useData(['sa', 'modules-tracks'], () => tracksApi.all(), [])
  const { data: schools } = useData(['sa', 'modules-schools'], () => schoolsApi.all({ status: 'APPROVED' }), [])
  const arr = Array.isArray(modules) ? modules : []
  const schoolArr = Array.isArray(schools) ? schools : []
  const trackArr = (Array.isArray(tracks) ? tracks : []).filter((t: any) => t.isActive !== false)
  const trackChoices = trackArr.length
    ? trackArr.map((t: any) => ({ code: String(t.code), label: String(t.name || String(t.code).replace('TRACK_', 'Track ')) }))
    : [
        { code: 'TRACK_1', label: 'Track 1' },
        { code: 'TRACK_2', label: 'Track 2' },
        { code: 'TRACK_3', label: 'Track 3' },
      ]

  const [filterTrack, setFilterTrack] = useState('ALL')
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const [classOptions, setClassOptions] = useState<Array<{ className: string }>>([])
  const [loadingClasses, setLoadingClasses] = useState(false)
  const [selectedClass, setSelectedClass] = useState('')
  const [classProgress, setClassProgress] = useState<any>(null)
  const [loadingClassProgress, setLoadingClassProgress] = useState(false)
  const [advancingClass, setAdvancingClass] = useState(false)
  const [passMark, setPassMark] = useState('50')
  const [lessonModuleId, setLessonModuleId] = useState('')
  const [curriculumLessons, setCurriculumLessons] = useState<any[]>([])
  const [loadingLessons, setLoadingLessons] = useState(false)
  const [lessonSaving, setLessonSaving] = useState(false)
  const [lessonForm, setLessonForm] = useState({ title: '', position: '', isPublished: false })
  const [form, setForm] = useState({
    track: trackChoices[0]?.code || 'TRACK_1',
    number: '1',
    title: '',
    description: '',
    durationWeeks: '2',
    objectivesText: '',
    isActive: true,
  })

  useEffect(() => {
    if (!trackChoices.some((t) => t.code === form.track)) {
      setForm((prev) => ({ ...prev, track: trackChoices[0]?.code || 'TRACK_1' }))
    }
  }, [trackChoices.map((t) => t.code).join('|'), form.track])

  useEffect(() => {
    if (!schoolArr.length) return
    if (!selectedSchoolId || !schoolArr.some((s: any) => s.id === selectedSchoolId)) {
      setSelectedSchoolId(String(schoolArr[0].id))
    }
  }, [schoolArr.length, selectedSchoolId])

  useEffect(() => {
    const loadClasses = async () => {
      if (!selectedSchoolId) {
        setClassOptions([])
        setSelectedClass('')
        return
      }
      setLoadingClasses(true)
      try {
        const rows = await schoolClassesApi.all(selectedSchoolId)
        const options = (Array.isArray(rows) ? rows : [])
          .filter((c: any) => c?.className)
          .map((c: any) => ({ className: String(c.className) }))
        setClassOptions(options)
        setSelectedClass((prev) => (options.some((x) => x.className === prev) ? prev : (options[0]?.className || '')))
      } catch {
        setClassOptions([])
        setSelectedClass('')
      }
      setLoadingClasses(false)
    }
    loadClasses()
  }, [selectedSchoolId])

  useEffect(() => {
    const loadClassProgress = async () => {
      if (!selectedSchoolId || !selectedClass) {
        setClassProgress(null)
        return
      }
      setLoadingClassProgress(true)
      try {
        const data = await modulesApi.classProgress(selectedSchoolId, selectedClass)
        setClassProgress(data)
      } catch {
        setClassProgress(null)
      }
      setLoadingClassProgress(false)
    }
    loadClassProgress()
  }, [selectedSchoolId, selectedClass])

  useEffect(() => {
    if (!lessonModuleId) {
      setCurriculumLessons([])
      return
    }
    setLoadingLessons(true)
    curriculumApi
      .lessonsByModule(lessonModuleId, true)
      .then((rows) => setCurriculumLessons(Array.isArray(rows) ? rows : []))
      .catch(() => setCurriculumLessons([]))
      .finally(() => setLoadingLessons(false))
  }, [lessonModuleId])

  const filtered = arr
    .filter((m: any) => (filterTrack === 'ALL' ? true : String(m.track) === filterTrack))
    .filter((m: any) => {
      const q = search.trim().toLowerCase()
      if (!q) return true
      return (
        String(m.title || '').toLowerCase().includes(q) ||
        String(m.description || '').toLowerCase().includes(q) ||
        String(m.track || '').toLowerCase().includes(q) ||
        String(m.number || '').toLowerCase().includes(q)
      )
    })
    .sort((a: any, b: any) => {
      const byTrack = String(a.track).localeCompare(String(b.track))
      if (byTrack !== 0) return byTrack
      return Number(a.number || 0) - Number(b.number || 0)
    })
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  useEffect(() => {
    if (filtered.length && !filtered.some((m: any) => m.id === lessonModuleId)) {
      setLessonModuleId(String(filtered[0].id))
    }
  }, [filtered, lessonModuleId])

  useEffect(() => {
    setPage(1)
  }, [filterTrack, search])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const resetForm = () => {
    setEditingId('')
    setForm({
      track: trackChoices[0]?.code || 'TRACK_1',
      number: '1',
      title: '',
      description: '',
      durationWeeks: '2',
      objectivesText: '',
      isActive: true,
    })
  }

  const startEdit = (m: any) => {
    setEditingId(String(m.id))
    setShowNew(true)
    setForm({
      track: String(m.track || ''),
      number: String(m.number || 1),
      title: String(m.title || ''),
      description: String(m.description || ''),
      durationWeeks: String(m.durationWeeks || 2),
      objectivesText: Array.isArray(m.objectives) ? m.objectives.join('\n') : '',
      isActive: m.isActive !== false,
    })
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        track: form.track,
        number: Number(form.number),
        title: form.title.trim(),
        description: form.description.trim(),
        durationWeeks: Math.max(1, Number(form.durationWeeks || 2)),
        objectives: form.objectivesText
          .split('\n')
          .map((x) => x.trim())
          .filter(Boolean),
        isActive: !!form.isActive,
      }
      if (!payload.title || !payload.description || !payload.track || !payload.number) {
        notify.warning('Please complete all required fields')
        setSaving(false)
        return
      }
      const duplicate = arr.find(
        (m: any) =>
          String(m.track) === payload.track &&
          Number(m.number) === payload.number &&
          String(m.id) !== String(editingId || '')
      )
      if (duplicate) {
        notify.warning(`Module ${payload.number} already exists for ${String(payload.track).replace('TRACK_', 'Track ')}.`)
        setSaving(false)
        return
      }
      if (editingId) {
        const updated = await modulesApi.update(editingId, payload)
        setData((prev: any[]) => (Array.isArray(prev) ? prev.map((m: any) => (m.id === editingId ? updated : m)) : [updated]))
      } else {
        const created = await modulesApi.create(payload)
        setData((prev: any[]) => (Array.isArray(prev) ? [created, ...prev] : [created]))
      }
      setShowNew(false)
      resetForm()
    } catch (e: any) {
      notify.error(e.message || 'Failed to save module')
    }
    setSaving(false)
  }

  const toggleActive = async (m: any) => {
    try {
      const updated = await modulesApi.update(m.id, { isActive: !m.isActive })
      setData((prev: any[]) => (Array.isArray(prev) ? prev.map((x: any) => (x.id === m.id ? updated : x)) : [updated]))
    } catch (e: any) {
      notify.error(e.message || 'Failed to update module')
    }
  }

  const advanceSelectedClass = async () => {
    if (!selectedSchoolId || !selectedClass || !classProgress?.currentModule?.id) {
      notify.warning('Select a class with an active module to advance')
      return
    }
    setAdvancingClass(true)
    try {
      await modulesApi.advanceClass({
        schoolId: selectedSchoolId,
        className: selectedClass,
        moduleId: classProgress.currentModule.id,
        passMark: Math.max(0, Math.min(100, Number(passMark || 50))),
      })
      const refreshed = await modulesApi.classProgress(selectedSchoolId, selectedClass)
      setClassProgress(refreshed)
      notify.success('Class advanced to next module')
    } catch (e: any) {
      notify.error(e?.message || 'Failed to advance class module')
    }
    setAdvancingClass(false)
  }

  const addCurriculumLesson = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lessonModuleId || !lessonForm.title.trim()) {
      notify.warning('Select a module and enter a lesson title')
      return
    }
    setLessonSaving(true)
    try {
      await curriculumApi.createLesson({
        moduleId: lessonModuleId,
        title: lessonForm.title.trim(),
        position: lessonForm.position ? Number(lessonForm.position) : undefined,
        isPublished: lessonForm.isPublished,
      })
      setLessonForm({ title: '', position: '', isPublished: false })
      const rows = await curriculumApi.lessonsByModule(lessonModuleId, true)
      setCurriculumLessons(Array.isArray(rows) ? rows : [])
      notify.success('Curriculum lesson created')
    } catch (err: any) {
      notify.error(err?.message || 'Failed to create lesson')
    }
    setLessonSaving(false)
  }

  const toggleLessonPublished = async (id: string, isPublished: boolean) => {
    try {
      await curriculumApi.updateLesson(id, { isPublished: !isPublished })
      const rows = await curriculumApi.lessonsByModule(lessonModuleId, true)
      setCurriculumLessons(Array.isArray(rows) ? rows : [])
    } catch (err: any) {
      notify.error(err?.message || 'Failed to update lesson')
    }
  }

  const removeLesson = async (id: string) => {
    if (!window.confirm('Delete this curriculum lesson? Tutors will no longer need to select it for sessions.')) return
    try {
      await curriculumApi.deleteLesson(id)
      const rows = await curriculumApi.lessonsByModule(lessonModuleId, true)
      setCurriculumLessons(Array.isArray(rows) ? rows : [])
    } catch (err: any) {
      notify.error(err?.message || 'Failed to delete lesson')
    }
  }

  return (
    <div>
      <div className="flex-between mb-20">
        <div>
          <h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Modules</h3>
          <div className="text-muted text-sm">Create and manage curriculum modules by track</div>
        </div>
        <button onClick={() => { setShowNew((v) => !v); if (showNew) resetForm() }} className="btn btn-primary btn-sm">
          {showNew ? 'Close Form' : '+ New Module'}
        </button>
      </div>

      <div className="card mb-20">
        <div className="font-display fw-600 text-white mb-12" style={{ fontSize: 16 }}>Class Module Advancement (Super Admin)</div>
        <div className="text-muted text-sm mb-14">Advance a class to the next module after score review.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.6fr auto', gap: 10, alignItems: 'end' }}>
          <div>
            <label className="form-label">School</label>
            <select className="form-input" value={selectedSchoolId} onChange={(e) => setSelectedSchoolId(e.target.value)} style={{ appearance: 'none' }}>
              {schoolArr.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              {schoolArr.length === 0 && <option value="">No approved schools</option>}
            </select>
          </div>
          <div>
            <label className="form-label">Class</label>
            <select className="form-input" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} style={{ appearance: 'none' }} disabled={loadingClasses || classOptions.length === 0}>
              {classOptions.map((c) => <option key={c.className} value={c.className}>{c.className}</option>)}
              {classOptions.length === 0 && <option value="">{loadingClasses ? 'Loading classes…' : 'No classes found'}</option>}
            </select>
          </div>
          <div>
            <label className="form-label">Pass Mark</label>
            <input className="form-input" type="number" min={0} max={100} value={passMark} onChange={(e) => setPassMark(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={advanceSelectedClass} disabled={advancingClass || !classProgress?.currentModule?.id}>
            {advancingClass ? 'Advancing…' : 'Advance Class Module →'}
          </button>
        </div>
        <div style={{ marginTop: 12 }}>
          {loadingClassProgress ? (
            <span className="text-muted text-sm">Loading class module state…</span>
          ) : classProgress?.currentModule ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="badge badge-info">Current: Module {classProgress.currentModule.number}</span>
              <span style={{ color: 'var(--white)', fontWeight: 600 }}>{classProgress.currentModule.title}</span>
              <span className="text-muted text-xs">{classProgress.studentCount || 0} students</span>
              {classProgress.currentLesson?.title && (
                <span className="badge badge-success" style={{ fontSize: 11 }}>
                  Next lesson: {classProgress.currentLesson.title}
                </span>
              )}
            </div>
          ) : (
            <span className="text-muted text-sm">No active module found for selected class.</span>
          )}
        </div>
      </div>

      <div className="card mb-20">
        <div className="font-display fw-600 text-white mb-12" style={{ fontSize: 16 }}>Curriculum lessons (canonical)</div>
        <div className="text-muted text-sm mb-14">Published lessons make session delivery prescriptive for that module. Class &quot;next lesson&quot; updates when tutors end a session.</div>
        <div style={{ marginBottom: 16 }}>
          <label className="form-label">Module</label>
          <select
            className="form-input"
            value={lessonModuleId}
            onChange={(e) => setLessonModuleId(e.target.value)}
            disabled={filtered.length === 0}
            style={{ appearance: 'none' }}
          >
            {filtered.map((m: any) => (
              <option key={m.id} value={m.id}>
                {String(m.track).replace('TRACK_', 'T ')} · Mod {m.number}: {m.title}
              </option>
            ))}
          </select>
        </div>
        <form onSubmit={addCurriculumLesson} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'end', marginBottom: 20 }}>
          <div style={{ flex: '1 1 200px' }}>
            <label className="form-label">New lesson title</label>
            <input
              className="form-input"
              value={lessonForm.title}
              onChange={(e) => setLessonForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Introduction to variables"
            />
          </div>
          <div style={{ width: 100 }}>
            <label className="form-label">Position</label>
            <input
              className="form-input"
              type="number"
              min={1}
              value={lessonForm.position}
              onChange={(e) => setLessonForm((f) => ({ ...f, position: e.target.value }))}
              placeholder="auto"
            />
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={lessonForm.isPublished}
              onChange={(e) => setLessonForm((f) => ({ ...f, isPublished: e.target.checked }))}
            />
            Published
          </label>
          <button type="submit" className="btn btn-primary btn-sm" disabled={lessonSaving || !lessonModuleId}>
            {lessonSaving ? 'Saving…' : 'Add lesson'}
          </button>
        </form>
        {loadingLessons ? (
          <span className="text-muted text-sm">Loading lessons…</span>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>Published</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {curriculumLessons.map((L: any) => (
                  <tr key={L.id}>
                    <td>{L.position}</td>
                    <td style={{ fontWeight: 600, color: 'var(--white)' }}>{L.title}</td>
                    <td>
                      <button
                        type="button"
                        className={`btn btn-sm ${L.isPublished ? 'btn-success' : 'btn-ghost'}`}
                        onClick={() => toggleLessonPublished(L.id, L.isPublished)}
                      >
                        {L.isPublished ? 'Yes' : 'No'}
                      </button>
                    </td>
                    <td>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => removeLesson(L.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {curriculumLessons.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px 0' }}>
                      No lessons for this module yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNew && (
        <div className="card mb-20">
          <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 16 }}>{editingId ? 'Edit Module' : 'Create Module'}</div>
          <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1.2fr', gap: 12 }}>
              <div>
                <label className="form-label">Track</label>
                <select className="form-input" value={form.track} onChange={(e) => setForm({ ...form, track: e.target.value })} style={{ appearance: 'none' }}>
                  {trackChoices.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Module Number</label>
                <input type="number" min={1} required className="form-input" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Duration (Weeks)</label>
                <input type="number" min={1} required className="form-input" value={form.durationWeeks} onChange={(e) => setForm({ ...form, durationWeeks: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="form-label">Title</label>
              <input required className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Introduction to Frontend" />
            </div>
            <div>
              <label className="form-label">Description</label>
              <textarea required rows={3} className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ resize: 'vertical' }} />
            </div>
            <div>
              <label className="form-label">Objectives (one per line)</label>
              <textarea rows={4} className="form-input" value={form.objectivesText} onChange={(e) => setForm({ ...form, objectivesText: e.target.value })} style={{ resize: 'vertical' }} />
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13 }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Module is active
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update Module' : 'Create Module'}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowNew(false); resetForm() }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="flex-between mb-16" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div className="text-muted text-sm">
            {filtered.length} modules · Page {safePage}/{totalPages}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              className="form-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, description, track..."
              style={{ minWidth: 260 }}
            />
            <div style={{ minWidth: 220 }}>
              <select className="form-input" value={filterTrack} onChange={(e) => setFilterTrack(e.target.value)} style={{ appearance: 'none' }}>
                <option value="ALL">All tracks</option>
                {trackChoices.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
            </div>
          </div>
        </div>
        {loading ? <p className="text-muted text-sm" style={{ padding: 20 }}>Loading modules…</p> : (
          <>
            <table className="data-table">
              <thead><tr><th>Track</th><th>No.</th><th>Title</th><th>Description</th><th>Weeks</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {paged.map((m: any) => (
                  <tr key={m.id}>
                    <td>{String(m.track || '').replace('TRACK_', 'Track ')}</td>
                    <td>{m.number}</td>
                    <td style={{ fontWeight: 600, color: 'var(--white)' }}>{m.title}</td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{m.description}</td>
                    <td>{m.durationWeeks || '—'}</td>
                    <td><span className={`badge badge-${m.isActive ? 'success' : 'warning'}`}>{m.isActive ? 'Active' : 'Archived'}</span></td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => startEdit(m)}>Edit</button>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => toggleActive(m)}>{m.isActive ? 'Archive' : 'Activate'}</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>No modules found for this filter</td></tr>}
              </tbody>
            </table>
            {filtered.length > pageSize && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>Prev</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>Next</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SASettings() {
  const { data: schools } = useData(['sa', 'settings', 'schools'], () => schoolsApi.all(), [])
  const { data: tutors } = useData(['sa', 'settings', 'tutors'], () => tutorsApi.all(), [])
  const { data: payments } = useData(['sa', 'settings', 'payments'], () => paymentsApi.all(), [])
  const { data: reports } = useData(['sa', 'settings', 'reports'], () => reportsApi.all(), [])
  const schoolArr = Array.isArray(schools) ? schools : []
  const tutorArr = Array.isArray(tutors) ? tutors : []
  const paymentArr = Array.isArray(payments) ? payments : []
  const reportArr = Array.isArray(reports) ? reports : []
  const approvedSchools = schoolArr.filter((s: any) => s.status === 'APPROVED').length
  const pendingSchools = schoolArr.filter((s: any) => s.status === 'PENDING').length
  const unpaidPayments = paymentArr.filter((p: any) => !p.isPaid).length
  const pendingReports = reportArr.filter((r: any) => r.status === 'SUBMITTED' || r.status === 'DRAFT').length

  return (
    <div>
      <h3 className="font-display fw-700 text-white mb-20" style={{ fontSize: 20 }}>Platform Settings</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 900 }}>
        <div className="card">
          <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 16 }}>Platform Overview</div>
          {[
            ['Total Schools', schoolArr.length],
            ['Approved Schools', approvedSchools],
            ['Pending Approvals', pendingSchools],
            ['Total Tutors', tutorArr.length],
          ].map(([l, v]) => (
            <div key={String(l)} style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>{l}</span>
              <strong style={{ color: 'var(--white)' }}>{String(v)}</strong>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 16 }}>Operational Queue</div>
          {[
            ['Unpaid Payments', unpaidPayments],
            ['Reports Pending Review', pendingReports],
            ['Issued Payments', paymentArr.length - unpaidPayments],
            ['Reviewed Reports', reportArr.length - pendingReports],
          ].map(([l, v]) => (
            <div key={String(l)} style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>{l}</span>
              <strong style={{ color: 'var(--white)' }}>{String(v)}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** School cards → open `/dashboard/superadmin/sessions/[schoolId]` for session log table */
function SASessionSchools() {
  const router = useRouter()
  const { data: schools, loading } = useData(['sa', 'session-logs-schools'], () => schoolsApi.all(), [])
  const [q, setQ] = useState('')
  const schoolArr = Array.isArray(schools) ? schools : []
  const filtered = schoolArr.filter((s: any) => {
    if (!q.trim()) return true
    const t = q.toLowerCase()
    return `${s.name || ''} ${s.code || ''} ${s.state || ''}`.toLowerCase().includes(t)
  })

  const statusStyle = (status: string) => {
    if (status === 'APPROVED') return { bg: 'rgba(34,197,94,0.15)', color: '#4ADE80' }
    if (status === 'PENDING') return { bg: 'rgba(245,158,11,0.15)', color: '#FCD34D' }
    if (status === 'SUSPENDED') return { bg: 'rgba(239,68,68,0.12)', color: '#F87171' }
    return { bg: 'var(--muted3)', color: 'var(--muted)' }
  }

  return (
    <div>
      <div className="flex-between mb-20" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Tutor session logs</h3>
          <p className="text-muted text-sm" style={{ maxWidth: 560 }}>
            Select a school to see all recorded teaching sessions (class, track, duration, tutor). Used for payroll and accountability.
          </p>
        </div>
      </div>
      <input
        className="form-input mb-20"
        style={{ maxWidth: 400 }}
        placeholder="Search by school name, code, or state…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search schools"
      />
      {loading ? (
        <p className="text-muted text-sm" style={{ padding: 20 }}>Loading schools…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map((s: any) => {
            const st = statusStyle(s.status)
            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                className="card"
                onClick={() => router.push(`/dashboard/superadmin/sessions/${s.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    router.push(`/dashboard/superadmin/sessions/${s.id}`)
                  }
                }}
                style={{
                  cursor: 'pointer',
                  border: '1px solid var(--border2)',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(26,127,212,0.45)'
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border2)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div className="flex-between mb-12" style={{ alignItems: 'flex-start', gap: 8 }}>
                  <div className="font-display fw-700 text-white" style={{ fontSize: 17 }}>{s.name}</div>
                  <span className="badge" style={{ fontSize: 10, ...st }}>{s.status || '—'}</span>
                </div>
                <div className="text-muted text-xs mb-8">Code: <span style={{ color: 'var(--white)' }}>{s.code}</span></div>
                <div className="text-muted text-xs mb-16">{s.state}{s.lga ? ` · ${s.lga}` : ''}</div>
                <div style={{ fontSize: 12, color: 'var(--teal2)', fontWeight: 600 }}>View session logs →</div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-muted text-sm" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 0' }}>
              No schools match your search.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function SAClassInsights() {
  const { data: schools, loading } = useData(['sa', 'class-insights-schools'], () => schoolsApi.all(), [])
  const [schoolId, setSchoolId] = useState('')
  const schoolArr = Array.isArray(schools) ? schools : []
  return (
    <div>
      <div className="flex-between mb-20">
        <div>
          <h3 className="font-display fw-700 text-white" style={{ fontSize: 20 }}>Class performance</h3>
          <p className="text-muted text-sm" style={{ maxWidth: 680, lineHeight: 1.5 }}>
            Phase D roll-up: attendance over a chosen window, module progress for all students in the class, and average scores from homework, curriculum assignments, CBT attempts, and practicals.
          </p>
        </div>
      </div>
      <div className="mb-20" style={{ maxWidth: 420 }}>
        <label className="form-label">School</label>
        <select className="form-input" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
          <option value="">{loading ? 'Loading…' : 'Select school'}</option>
          {schoolArr.map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      {schoolId ? <ClassPerformancePanel schoolIdForFetch={schoolId} /> : null}
    </div>
  )
}

function SuperAdminDashboardInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [section, setSection] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [topbarAvatarUrl, setTopbarAvatarUrl] = useState<string | undefined>()
  const [superAdminNavLabel, setSuperAdminNavLabel] = useState<string | undefined>()
  const { data: sidebarSchools } = useData(['sa', 'sidebar-schools'], () => schoolsApi.all(), [])
  const { data: sidebarTutors } = useData(['sa', 'sidebar-tutors'], () => tutorsApi.all(), [])
  const { data: sidebarReports } = useData(['sa', 'sidebar-reports'], () => reportsApi.all(), [])
  const { data: sidebarAssessments } = useData(['sa', 'sidebar-assessments'], () => cbtApi.all(), [])
  const { data: sidebarPaymentsSummary } = useData(['sa', 'sidebar-payments-summary'], () => paymentsApi.summary(), DEFAULT_PAYMENTS_SUMMARY)

  const sidebarSchoolArr = Array.isArray(sidebarSchools) ? sidebarSchools : []
  const sidebarTutorArr = Array.isArray(sidebarTutors) ? sidebarTutors : []
  const sidebarReportArr = Array.isArray(sidebarReports) ? sidebarReports : []
  const sidebarAssessmentArr = Array.isArray(sidebarAssessments) ? sidebarAssessments : []
  const sidebarPendingApprovals = sidebarSchoolArr.filter((s: any) => s.status === 'PENDING').length
  const sidebarPendingReports = sidebarReportArr.filter((r: any) => r.status === 'SUBMITTED').length
  const sidebarPendingVetting = sidebarAssessmentArr.filter((e: any) => e.isVetted !== true).length
  const ps = { ...DEFAULT_PAYMENTS_SUMMARY, ...(sidebarPaymentsSummary ?? {}) }
  const sidebarPendingPayments = Math.max(0, (ps.count || 0) - (ps.paidCount || 0))
  const sidebarBadges = {
    schools: sidebarSchoolArr.length,
    approvals: sidebarPendingApprovals,
    tutors: sidebarTutorArr.length,
    payments: sidebarPendingPayments || null,
    reports: sidebarPendingReports || null,
    assessments: sidebarPendingVetting || null,
  }

  useEffect(() => {
    if (!localStorage.getItem('adhara_token')) { router.push('/auth/login'); return }
    setLoading(false)
    try {
      const u = JSON.parse(localStorage.getItem('adhara_user') || '{}')
      const a = typeof u?.avatarUrl === 'string' ? u.avatarUrl.trim() : ''
      if (a) setTopbarAvatarUrl(a)
      const nm = [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim()
      if (nm) setSuperAdminNavLabel(nm)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    const s = searchParams.get('section')
    if (s) setSection(s)
  }, [searchParams])

  const titles: Record<string, string> = {
    overview: 'Platform Overview', schools: 'Registered Schools', approvals: 'Pending Approvals',
    tutors: 'All Tutors', payments: 'Payments', reports: 'Weekly Tutor Reports',
    assessments: 'Assessment Vetting', cbt: 'Modules', tracks: 'Program Tracks', settings: 'Platform Settings', payroll: 'Tutor Payroll', certificates: 'All Certificates',
    'session-logs': 'Tutor session logs',
    'class-insights': 'Class performance',
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy)' }}>
      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 48, animation: 'float 2s ease-in-out infinite' }}>⚡</div><p style={{ color: 'var(--muted)', marginTop: 16 }}>Loading platform…</p></div>
    </div>
  )

  const render = () => {
    switch (section) {
      case 'schools': return <SASchools />
      case 'approvals': return <SAApprovals />
      case 'tutors': return <SATutors />
      case 'payments': return <SAPayments />
      case 'reports': return <SAReports />
      case 'assessments': return <SAAssessments />
      case 'cbt': return <SAModules />
      case 'tracks': return <SATracks />
      case 'payroll': return <SAPayroll />
      case 'settings': return <SASettings />
      case 'certificates': return <SACertificates />
      case 'session-logs': return <SASessionSchools />
      case 'class-insights': return <SAClassInsights />
      default: return <SAOverview onSection={setSection} />
    }
  }

  return (
    <DashboardShell role="superadmin" title={titles[section] || 'Overview'}
      subtitle={section === 'overview' ? 'AdharaEdu Platform · Super Admin View' : undefined}
      section={section} onSectionChange={setSection} navBadges={sidebarBadges}
      topbarAvatarUrl={topbarAvatarUrl}
      navUserLabel={superAdminNavLabel}
      navUserRole="Platform Administrator">
      {render()}
    </DashboardShell>
  )
}

export default function SuperAdminDashboard() {
  return (
    <Suspense
      fallback={(
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy)' }}>
          <p className="text-muted">Loading…</p>
        </div>
      )}
    >
      <SuperAdminDashboardInner />
    </Suspense>
  )
}
