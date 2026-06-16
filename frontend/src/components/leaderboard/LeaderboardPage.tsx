'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { leaderboardsApi } from '@/lib/api'
import { leaderboardGradient, trackLabel, trackNumberLabel, trackSubtitle, classPaceLabel, formatModulesLabel, shortSchoolName } from './leaderboard.utils'
import './leaderboard.css'

type Role = 'student' | 'tutor' | 'admin' | 'superadmin'

type Props = {
  role: Role
  classLabel?: string
}

function rankClass(rank: number) {
  if (rank === 1) return 'gold'
  if (rank === 2) return 'silver'
  if (rank === 3) return 'bronze'
  return ''
}

function GapLabel({ text }: { text: string }) {
  const m = text.match(/^Need \+(\d+)%(.+)$/)
  if (!m) return <>{text}</>
  return (
    <>
      Need <strong>+{m[1]}%</strong>
      {m[2]}
    </>
  )
}

function PodiumCard({
  pod,
  place,
  animate,
  delay = 0,
  scope,
  crossSchool,
}: {
  pod: any
  place: 1 | 2 | 3
  animate: boolean
  delay?: number
  scope: 'class' | 'track'
  crossSchool?: boolean
}) {
  if (!pod) {
    return (
      <div className={`lb-pod lb-pod-${place}${animate ? ' lb-animate' : ''}`} style={{ animationDelay: `${delay}ms` }}>
        <div className="lb-pod-medal">{place}</div>
        <div className="lb-pod-name" style={{ color: 'var(--lb-t3)' }}>—</div>
      </div>
    )
  }
  const grad = leaderboardGradient(pod.studentId || pod.name)
  const [c1, c2] = grad.split(',')
  let sub = pod.className
  if (scope === 'track') {
    sub = classPaceLabel(pod.className, pod.modulesCompleted ?? 0)
    if (crossSchool && pod.schoolName) {
      sub = `${sub} · ${shortSchoolName(pod.schoolName)}`
    }
  } else if (place === 1 && pod.schoolName) {
    sub = `${pod.className} · ${shortSchoolName(pod.schoolName)}`
  }
  return (
    <div
      className={`lb-pod lb-pod-${place}${animate ? ' lb-animate' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {place === 1 && <div style={{ fontSize: 18 }}>👑</div>}
      <div className="lb-pod-medal">{place}</div>
      <div className="lb-pod-avatar" style={{ background: `linear-gradient(135deg,${c1},${c2})` }}>
        {pod.initials}
      </div>
      <div className="lb-pod-name">{pod.name}</div>
      <div className={`lb-pod-class${scope === 'track' ? ' lb-pod-pace' : ''}`}>{sub}</div>
      <div className="lb-pod-score">
        {pod.averageScore}
        <span style={{ fontSize: 12, opacity: 0.6 }}>%</span>
      </div>
    </div>
  )
}

function RankCard({
  row,
  scope,
  crossSchool,
  animate,
  delay = 0,
}: {
  row: any
  scope: 'class' | 'track'
  crossSchool?: boolean
  animate: boolean
  delay?: number
}) {
  const grad = leaderboardGradient(row.studentId || row.name)
  const [c1, c2] = grad.split(',')
  const modulesLabel = formatModulesLabel(row.modulesCompleted ?? 0)
  const paceLabel = classPaceLabel(row.className, row.modulesCompleted ?? 0)

  let tag1: string
  let tag2: string | null = null
  let paceTag = false

  if (scope === 'class') {
    tag1 = row.regNumber || row.className
    tag2 = modulesLabel
  } else {
    tag1 = paceLabel
    paceTag = true
    if (crossSchool && row.schoolName) {
      tag2 = shortSchoolName(row.schoolName)
    }
  }

  return (
    <div
      className={`lb-card${row.isYou ? ' is-you' : ''}${animate ? ' lb-animate' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`lb-c-rank ${rankClass(row.rank)}`}>{row.rank}</div>
      <div className="lb-c-person">
        <div className="lb-c-avatar" style={{ background: `linear-gradient(135deg,${c1},${c2})` }}>
          {row.initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="lb-c-name">
            {row.name}
            {row.isYou && (
              <span
                style={{
                  fontSize: 9,
                  color: 'var(--lb-blue)',
                  fontWeight: 700,
                  marginLeft: 4,
                  background: 'var(--lb-blue-dim)',
                  padding: '1px 5px',
                  borderRadius: 4,
                }}
              >
                YOU
              </span>
            )}
          </div>
          <div className="lb-c-sub">
            <span className={`lb-c-tag${paceTag ? ' lb-c-tag-pace' : ''}`}>{tag1}</span>
            {tag2 ? <span className="lb-c-tag">{tag2}</span> : null}
          </div>
        </div>
      </div>
      <div>
        <div className={`lb-c-score${row.averageScore >= 80 ? ' high' : ''}`}>{row.averageScore}%</div>
        <div className="lb-c-bar">
          <div
            className={`lb-c-bar-fill${row.averageScore >= 80 ? ' gold' : ''}${animate ? ' lb-bar-ready' : ''}`}
            style={{ transform: animate ? `scaleX(${Math.max(0.05, row.averageScore / 100)})` : 'scaleX(0)' }}
          />
        </div>
      </div>
    </div>
  )
}

export function LeaderboardPage({ role, classLabel }: Props) {
  const [scope, setScope] = useState<'class' | 'track'>('class')
  const [track, setTrack] = useState<string>('TRACK_1')
  const [schoolId, setSchoolId] = useState<string>('')
  const [className, setClassName] = useState<string>('')
  const [filters, setFilters] = useState<any>(null)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [animateIn, setAnimateIn] = useState(false)
  const [crossSchool, setCrossSchool] = useState(false)
  const animateKey = useRef(0)

  const segmentClassLabel =
    role === 'student' ? 'My Class' : classLabel || className || 'This Class'
  const segmentTrackLabel = 'All Classes'

  useEffect(() => {
    let cancelled = false
    leaderboardsApi
      .filters()
      .then((f) => {
        if (cancelled) return
        setFilters(f)
        setTrack(f?.defaults?.track || 'TRACK_1')
        setSchoolId(f?.defaults?.schoolId || '')
        setClassName(f?.defaults?.className || '')
      })
      .catch(() => {
        if (!cancelled) setError('Could not load filters')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!filters) return
    let cancelled = false
    setLoading(true)
    setError('')
    leaderboardsApi
      .get({
        track,
        scope,
        crossSchool: role === 'superadmin' && scope === 'track' && crossSchool,
        schoolId:
          role === 'superadmin' && scope === 'track' && crossSchool
            ? undefined
            : schoolId || filters?.defaults?.schoolId || undefined,
        className: scope === 'class' ? className || undefined : undefined,
      })
      .then((d) => {
        if (!cancelled) {
          setData(d)
          setLoading(false)
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e.message || 'Could not load leaderboard')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [filters, track, scope, schoolId, className, role, crossSchool])

  useEffect(() => {
    if (loading || error || !data) {
      setAnimateIn(false)
      return
    }
    setAnimateIn(false)
    animateKey.current += 1
    const t = window.setTimeout(() => setAnimateIn(true), 40)
    return () => window.clearTimeout(t)
  }, [loading, error, data, scope, track, schoolId, className])

  const classOptions = useMemo(() => {
    if (!filters?.classes) return []
    const onTrack = filters.classes.filter((c: any) => c.track === track)
    if (role === 'superadmin' && crossSchool) return onTrack
    return onTrack.filter((c: any) => !schoolId || c.schoolId === schoolId)
  }, [filters, track, schoolId, role, crossSchool])

  const schoolNameById = useMemo(() => {
    const m = new Map<string, string>()
    filters?.schools?.forEach((s: any) => m.set(s.id, s.name))
    return m
  }, [filters])

  const top3Ordered = useMemo(() => {
    const t = data?.top3 || []
    return { second: t[1], first: t[0], third: t[2] }
  }, [data])

  const listRows = useMemo(() => {
    const rows = data?.rankings || []
    if (scope === 'class') return rows
    const meIdx = rows.findIndex((r: any) => r.isYou)
    if (meIdx < 0) return rows
    const head = rows.slice(0, 5)
    const around = rows.filter(
      (r: any) => r.rank >= Math.max(1, (rows[meIdx]?.rank || 1) - 2) && r.rank <= (rows[meIdx]?.rank || 1) + 2,
    )
    const seen = new Set<number>()
    const out: any[] = []
    const push = (r: any) => {
      if (seen.has(r.rank)) return
      seen.add(r.rank)
      out.push(r)
    }
    head.forEach(push)
    if (rows[meIdx]?.rank > 6) {
      out.push({ divider: `${rows[meIdx].rank - 6} students`, key: 'gap1' })
    }
    if (meIdx >= 0 && rows[meIdx].rank > 5) {
      out.push({ divider: 'Your position', key: 'you-div' })
    }
    around.forEach(push)
    return out
  }, [data, scope])

  const crossSchoolTrack =
    (role === 'superadmin' && crossSchool && scope === 'track') || Boolean(data?.crossSchoolTrack)

  const heroCountSuffix = useMemo(() => {
    if (scope !== 'track' || !data?.meta) return ''
    if (crossSchoolTrack && (data.meta.schoolCount ?? 0) > 1) {
      return ` · ${data.meta.schoolCount} schools`
    }
    if ((data.meta.classCount ?? 0) > 1) {
      return ` · ${data.meta.classCount} classes`
    }
    return ''
  }, [scope, data, crossSchoolTrack])

  const top3Label =
    scope === 'class'
      ? 'Top 3 this term'
      : crossSchoolTrack
        ? 'Top 3 across all schools'
        : 'Top 3 across all classes'
  const showSchoolFilter =
    role === 'superadmin' && !crossSchool && (filters?.schools?.length || 0) > 1
  const showCrossSchoolToggle = role === 'superadmin'
  const showTrackFilter = (filters?.tracks?.length || 0) > 1
  const showClassPills = role !== 'student' && classOptions.length > 1

  return (
    <>
      <div className="lb-ambient" aria-hidden>
        <div className="lb-ambient-1" />
        <div className="lb-ambient-2" />
      </div>
      <div className="lb-page">
        <header className="lb-header">
          <div className="lb-brand">
            <div className="lb-brand-icon" aria-hidden>
              <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
                <polygon
                  points="10,1 13,8 20,8 14.5,12.5 16.5,20 10,15.5 3.5,20 5.5,12.5 0,8 7,8"
                  fill="#FFFFFF"
                />
              </svg>
            </div>
            <div>
              <div className="lb-brand-name">{trackNumberLabel(data?.track || track)}</div>
              <div className="lb-brand-sub">{trackSubtitle(data?.track || track)}</div>
            </div>
          </div>
          <div className="lb-live">
            <div className="lb-live-dot" />
            <span className="lb-live-text">Live</span>
          </div>
        </header>

        {(showTrackFilter || showSchoolFilter || showCrossSchoolToggle) && (
          <div className="lb-filters">
            {showTrackFilter && (
              <select
                className="lb-filter-select"
                value={track}
                onChange={(e) => {
                  setTrack(e.target.value)
                  const first = filters.classes.find(
                    (c: any) => c.track === e.target.value && (!schoolId || c.schoolId === schoolId),
                  )
                  if (first) setClassName(first.className)
                }}
              >
                {filters.tracks.map((t: string) => (
                  <option key={t} value={t}>
                    {trackLabel(t)}
                  </option>
                ))}
              </select>
            )}
            {showSchoolFilter && (
              <select
                className="lb-filter-select"
                value={schoolId}
                onChange={(e) => {
                  setSchoolId(e.target.value)
                  const first = filters.classes.find(
                    (c: any) => c.schoolId === e.target.value && c.track === track,
                  )
                  if (first) setClassName(first.className)
                }}
              >
                {filters.schools.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            {showCrossSchoolToggle && (
              <label className="lb-cross-toggle">
                <span className="lb-cross-toggle-label">All schools on track</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={crossSchool}
                  className={`lb-cross-switch${crossSchool ? ' on' : ''}`}
                  onClick={() => {
                    setCrossSchool((v) => {
                      const next = !v
                      if (next) setScope('track')
                      return next
                    })
                  }}
                >
                  <span className="lb-cross-switch-knob" />
                </button>
              </label>
            )}
          </div>
        )}

        {showClassPills && (
          <div className="lb-class-pills">
            {classOptions.map((c: any) => {
              const schoolLabel = schoolNameById.get(c.schoolId)
              const pillLabel =
                role === 'superadmin' && crossSchool && schoolLabel
                  ? `${c.className} · ${schoolLabel.split(' ')[0]}`
                  : c.className
              return (
              <button
                key={`${c.schoolId}-${c.className}`}
                type="button"
                className={`lb-class-pill${className === c.className && schoolId === c.schoolId ? ' active' : ''}`}
                onClick={() => {
                  setSchoolId(c.schoolId)
                  setClassName(c.className)
                  setScope('class')
                }}
              >
                {pillLabel}
              </button>
            )})}
          </div>
        )}

        <div className="lb-hero">
          <div className="lb-hero-eyebrow">
            {trackLabel(data?.track || track)} · {data?.termLabel || 'Current term'}
          </div>
          <h1 className="lb-hero-title">
            Top <span>Performers</span>
          </h1>
          <div className="lb-hero-meta">
            <div className="lb-hero-tag">
              <span className="lb-hero-tag-dot" />
              <span>{trackLabel(data?.track || track)} Active</span>
            </div>
            <span className="lb-hero-count">
              {data?.meta?.studentCount ?? '—'} students{heroCountSuffix}
            </span>
          </div>
        </div>

        <div className="lb-segment">
          <button
            type="button"
            className={`lb-seg-btn${scope === 'class' ? ' active' : ''}`}
            onClick={() => setScope('class')}
          >
            {segmentClassLabel}
          </button>
          <button
            type="button"
            className={`lb-seg-btn${scope === 'track' ? ' active' : ''}`}
            onClick={() => setScope('track')}
          >
            {segmentTrackLabel}
          </button>
        </div>

        {loading && <div className="lb-loading">Loading rankings…</div>}
        {error && !loading && <div className="lb-empty">{error}</div>}

        {!loading && !error && data && (
          <>
            <div className="lb-section-label">{top3Label}</div>
            <div className="lb-podium">
              <PodiumCard pod={top3Ordered.second} place={2} animate={animateIn} delay={100} scope={scope} crossSchool={crossSchoolTrack} />
              <PodiumCard pod={top3Ordered.first} place={1} animate={animateIn} delay={0} scope={scope} crossSchool={crossSchoolTrack} />
              <PodiumCard pod={top3Ordered.third} place={3} animate={animateIn} delay={200} scope={scope} crossSchool={crossSchoolTrack} />
            </div>

            {data.me && (
              <div className={`lb-you${animateIn ? ' lb-animate' : ''}`}>
                <div className="lb-you-pill">You</div>
                <div className="lb-you-rank">
                  {data.me.rank}
                  <sup>th</sup>
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div className="lb-you-name">{data.me.name}</div>
                  <div className="lb-you-detail">
                    {scope === 'track'
                      ? `${classPaceLabel(data.me.className, data.me.modulesCompleted ?? 0)}${
                          crossSchoolTrack && data.me.schoolName ? ` · ${shortSchoolName(data.me.schoolName)}` : ''
                        }`
                      : `${data.me.className} · ${data.me.schoolName}`}
                  </div>
                </div>
                <div>
                  <div className="lb-you-score">{data.me.averageScore}%</div>
                  {data.me.gapLabel ? (
                    <div className="lb-you-gap">
                      <GapLabel text={data.me.gapLabel} />
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            <div className="lb-stats">
              <div className={`lb-stat${animateIn ? ' lb-animate' : ''}`} style={{ animationDelay: '250ms' }}>
                <div className="lb-stat-val">
                  {scope === 'class' ? data.meta?.inYourClass ?? data.meta?.studentCount : data.meta?.studentCount}
                </div>
                <div className="lb-stat-lbl">{scope === 'class' ? 'In your class' : 'Total students'}</div>
              </div>
              <div className={`lb-stat${animateIn ? ' lb-animate' : ''}`} style={{ animationDelay: '330ms' }}>
                <div className="lb-stat-val">{data.meta?.trackAverage ?? '—'}%</div>
                <div className="lb-stat-lbl">{scope === 'class' ? 'Class average' : 'Track average'}</div>
              </div>
              <div className={`lb-stat${animateIn ? ' lb-animate' : ''}`} style={{ animationDelay: '410ms' }}>
                <div className="lb-stat-val">{data.meta?.modulesActive ?? '—'}</div>
                <div className="lb-stat-lbl">Modules counted</div>
              </div>
            </div>

            <div className="lb-section-label">
              {scope === 'class'
                ? 'Full Rankings'
                : role === 'student' && data.me
                  ? 'Around your position'
                  : 'Full Rankings'}
            </div>
            <div className="lb-cards">
              {listRows.length === 0 && (
                <div className="lb-empty">No ranked students yet — scores appear when modules are completed.</div>
              )}
              {listRows.map((row: any, i: number) =>
                row.divider ? (
                  <div key={row.key} className="lb-divider">
                    <div className="lb-divider-line" />
                    <div className="lb-divider-label">{row.divider}</div>
                    <div className="lb-divider-line" />
                  </div>
                ) : (
                  <RankCard
                    key={`${row.studentId}-${animateKey.current}`}
                    row={row}
                    scope={scope}
                    crossSchool={crossSchoolTrack}
                    animate={animateIn}
                    delay={350 + i * 40}
                  />
                ),
              )}
            </div>

            <footer className="lb-footer">
              <p className="lb-footer-note">
                Rankings reflect the <b>average of completed module scores</b> — finalized when your tutor advances the class. Last assessments (CBT, practical) can change your module outcome before advance.
              </p>
            </footer>
          </>
        )}
      </div>
    </>
  )
}
