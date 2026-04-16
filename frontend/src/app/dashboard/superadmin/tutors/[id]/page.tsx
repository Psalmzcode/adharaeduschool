'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardShell } from '@/components/DashboardShell'
import { TutorProfileDetail } from '@/components/TutorProfileDetail'
import { tutorsApi, tracksApi } from '@/lib/api'
import { notify } from '@/lib/notify'

export default function SuperAdminTutorDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : ''

  const [loading, setLoading] = useState(true)
  const [tutor, setTutor] = useState<any>(null)
  const [err, setErr] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [trackArr, setTrackArr] = useState<any[]>([])
  const [removingAssignmentId, setRemovingAssignmentId] = useState('')

  const nav = (section: string) => {
    router.push(`/dashboard/superadmin?section=${encodeURIComponent(section)}`)
  }

  const load = useCallback(async () => {
    if (!id) return
    setErr('')
    try {
      const [t, tracks] = await Promise.all([tutorsApi.one(id), tracksApi.all().catch(() => [])])
      setTutor(t)
      setTrackArr(Array.isArray(tracks) ? tracks.filter((x: any) => x.isActive !== false) : [])
    } catch (e: any) {
      setErr(e.message || 'Failed to load tutor')
      setTutor(null)
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    if (!localStorage.getItem('adhara_token')) {
      router.push('/auth/login')
      return
    }
    load()
  }, [load, router])

  const trackLabel = (code: string) =>
    trackArr.find((x: any) => String(x.code).toUpperCase() === String(code).toUpperCase())?.name ||
    String(code).replace('TRACK_', 'Track ')

  const toggleVerify = async () => {
    if (!tutor?.id) return
    setVerifying(true)
    try {
      const next = !tutor?.isVerified
      const updated = await tutorsApi.setVerified(tutor.id, next)
      setTutor(updated)
      notify.success(next ? 'Tutor verified' : 'Tutor unverified')
    } catch (e: any) {
      notify.fromError(e)
    }
    setVerifying(false)
  }

  const removeAssignment = async (assignmentId: string) => {
    const ok = window.confirm('Remove this assignment? This will end the assignment (set it inactive).')
    if (!ok) return
    setRemovingAssignmentId(assignmentId)
    try {
      await tutorsApi.removeAssignment(assignmentId)
      const t = await tutorsApi.one(id)
      setTutor(t)
      notify.success('Assignment removed.')
    } catch (e: any) {
      notify.fromError(e)
    }
    setRemovingAssignmentId('')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy)' }}>
        <p className="text-muted">Loading tutor…</p>
      </div>
    )
  }

  if (err || !tutor) {
    return (
      <DashboardShell role="superadmin" title="Tutor not found" section="tutors" onSectionChange={nav} navBadges={{}}>
        <div className="card">
          <p className="text-muted">{err || 'This tutor could not be loaded.'}</p>
          <button type="button" className="btn btn-primary btn-sm mt-16" onClick={() => nav('tutors')}>
            ← Back to all tutors
          </button>
        </div>
      </DashboardShell>
    )
  }

  const name = `${tutor.user?.firstName || ''} ${tutor.user?.lastName || ''}`.trim()

  return (
    <DashboardShell
      role="superadmin"
      title={name || 'Tutor profile'}
      subtitle={tutor.user?.email}
      section="tutors"
      onSectionChange={nav}
      navBadges={{}}
      topbarRight={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${tutor?.isVerified ? 'btn-ghost' : 'btn-primary'} btn-sm`}
            onClick={toggleVerify}
            disabled={verifying}
            title="Mark this tutor as verified after reviewing KYC"
            style={{ justifyContent: 'center', minWidth: 140 }}
          >
            {verifying ? 'Saving…' : tutor?.isVerified ? 'Unverify' : 'Verify tutor'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => nav('tutors')}>
            ← All tutors
          </button>
        </div>
      }
    >
      <TutorProfileDetail tutor={tutor} trackLabel={trackLabel} />
      <div className="card mt-20">
        <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 16 }}>Manage assignments</div>
        {!(tutor?.assignments || []).length ? (
          <p className="text-muted text-sm">No assignments</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>School</th>
                  <th>Class</th>
                  <th>Track</th>
                  <th>Term</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {(tutor.assignments as any[]).map((a: any) => (
                  <tr key={a.id}>
                    <td>{a.school?.name || '—'}</td>
                    <td>{a.className}</td>
                    <td>{trackLabel(a.track)}</td>
                    <td style={{ fontSize: 12 }}>{a.termLabel}</td>
                    <td>
                      <span className={`badge badge-${a.isActive !== false ? 'success' : 'warning'}`}>
                        {a.isActive !== false ? 'Active' : 'Ended'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        style={{ fontSize: 11 }}
                        disabled={removingAssignmentId === a.id || a.isActive === false}
                        onClick={() => removeAssignment(a.id)}
                      >
                        {removingAssignmentId === a.id ? 'Removing…' : 'Remove'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
