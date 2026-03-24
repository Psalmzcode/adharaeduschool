'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardShell } from '@/components/DashboardShell'
import { TutorProfileDetail } from '@/components/TutorProfileDetail'
import { tutorsApi, tracksApi } from '@/lib/api'

export default function SchoolAdminTutorDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : ''

  const [loading, setLoading] = useState(true)
  const [tutor, setTutor] = useState<any>(null)
  const [err, setErr] = useState('')
  const [trackArr, setTrackArr] = useState<any[]>([])

  const nav = (section: string) => {
    router.push(`/dashboard/admin?section=${encodeURIComponent(section)}`)
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

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy)' }}>
        <p className="text-muted">Loading tutor…</p>
      </div>
    )
  }

  if (err || !tutor) {
    return (
      <DashboardShell role="admin" title="Tutor" section="tutors" onSectionChange={nav} navBadges={{}}>
        <div className="card">
          <p className="text-muted">{err || 'This tutor could not be loaded.'}</p>
          <button type="button" className="btn btn-primary btn-sm mt-16" onClick={() => nav('tutors')}>
            ← Back to tutors
          </button>
        </div>
      </DashboardShell>
    )
  }

  const name = `${tutor.user?.firstName || ''} ${tutor.user?.lastName || ''}`.trim()

  return (
    <DashboardShell
      role="admin"
      title={name || 'Tutor profile'}
      subtitle={tutor.user?.email}
      section="tutors"
      onSectionChange={nav}
      navBadges={{}}
      topbarRight={
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => nav('tutors')}>
          ← All tutors
        </button>
      }
    >
      <TutorProfileDetail tutor={tutor} trackLabel={trackLabel} scope="school" />
    </DashboardShell>
  )
}
