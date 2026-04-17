'use client'

import Link from 'next/link'
import { useRef, useState, useEffect, useCallback } from 'react'

const CATALOG = [
  { icon: '👩‍🏫', num: '02', label: 'FOR SCHOOLS', title: 'Staff Training & Professional Development', desc: 'Transform teaching quality through hands-on, practical workshops — from foundational pedagogy to technology integration and school leadership.' },
  { icon: '🎯', num: '03', label: 'FOR STUDENTS', title: 'Student 1-on-1 Coaching', desc: 'Personalised academic coaching, JAMB preparation, university application support, and career direction for SS students.' },
  { icon: '🌐', num: '04', label: 'DIGITAL PRESENCE', title: 'School Website & Digital Identity', desc: 'Professional website, custom email, social media setup, and Google Business profile — complete digital presence for your school.' },
  { icon: '🏆', num: '05', label: 'COMPETITIONS', title: 'Inter-School Tech Competitions', desc: 'Annual coding, typing, and digital skills competitions with prizes, trophies, and Adhara certificates for top students and schools.' },
  { icon: '💰', num: '06', label: 'FUNDING', title: 'Grants, Funding & Partnerships', desc: 'We identify, apply, and manage grants from government, NGOs, and international bodies on behalf of partner schools.' },
  { icon: '📊', num: '07', label: 'MANAGEMENT', title: 'School Management Consulting', desc: 'Academic performance reviews, administrative systems, parent engagement strategies, and school improvement planning.' },
  { icon: '💻', num: '08', label: 'ONLINE', title: 'Online Bootcamps for Students', desc: 'Holiday and weekend intensive programmes — web development, Python, digital marketing, and graphic design for secondary students.' },
  { icon: '🎓', num: '09', label: 'CERTIFICATION', title: 'Adhara Digital Skills Certification', desc: 'Nationally-recognised certificates for students who complete AdharaEdu tracks. Issued digitally and physically, verifiable online.' },
] as const

export function ServicesCatalogCarousel() {
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  const scrollByDir = useCallback((dir: -1 | 1) => {
    const el = trackRef.current
    if (!el) return
    const first = el.querySelector<HTMLElement>('[data-catalog-card]')
    const gap = 16
    const step = (first?.offsetWidth ?? 320) + gap
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth)
    if (maxScroll <= 0) return
    if (dir === 1) {
      if (el.scrollLeft + step >= maxScroll - 8) {
        el.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        el.scrollBy({ left: step, behavior: 'smooth' })
      }
    } else {
      if (el.scrollLeft <= 8) {
        el.scrollTo({ left: maxScroll, behavior: 'smooth' })
      } else {
        el.scrollBy({ left: -step, behavior: 'smooth' })
      }
    }
  }, [])

  const goTo = useCallback((i: number) => {
    const el = trackRef.current
    if (!el) return
    const cards = el.querySelectorAll<HTMLElement>('[data-catalog-card]')
    const card = cards[i]
    card?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
  }, [])

  useEffect(() => {
    const root = trackRef.current
    if (!root) return
    const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-catalog-card]'))
    if (cards.length === 0) return

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const idx = cards.indexOf(entry.target as HTMLElement)
          if (idx >= 0 && entry.intersectionRatio >= 0.4) setActive(idx)
        })
      },
      { root, rootMargin: '0px -15% 0px -15%', threshold: [0.35, 0.5, 0.65] },
    )
    cards.forEach((c) => io.observe(c))
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (paused) return
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => {
      scrollByDir(1)
    }, 5200)
    return () => window.clearInterval(id)
  }, [paused, scrollByDir])

  return (
    <div
      className="services-catalog-carousel-root"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setPaused(false)
      }}
    >
      <p className="services-catalog-carousel-hint">Auto-advances — swipe or use arrows. Pauses on hover.</p>

      <div ref={trackRef} className="services-catalog-carousel-track" role="region" aria-label="AdharaEdu services catalogue">
        {CATALOG.map((s) => (
          <div key={s.num} data-catalog-card className="services-catalog-carousel-card">
            <div className="services-catalog-card-inner">
              <div className="services-catalog-card-icon">{s.icon}</div>
              <div className="services-catalog-card-body">
                <div className="services-catalog-card-meta">
                  SERVICE {s.num} · {s.label}
                </div>
                <h3 className="services-catalog-card-title">{s.title}</h3>
                <p className="services-catalog-card-desc">{s.desc}</p>
              </div>
              <Link href="/auth/register" className="btn btn-outline btn-sm services-catalog-card-cta">
                Enquire →
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="services-catalog-carousel-toolbar">
        <button type="button" className="services-catalog-carousel-btn" aria-label="Previous service" onClick={() => scrollByDir(-1)}>
          ‹
        </button>
        <div className="services-catalog-carousel-dots" role="tablist" aria-label="Service slides">
          {CATALOG.map((s, i) => (
            <button
              key={s.num}
              type="button"
              role="tab"
              aria-selected={i === active}
              className={`services-catalog-dot${i === active ? ' active' : ''}`}
              aria-label={`Go to service ${s.num}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
        <button type="button" className="services-catalog-carousel-btn" aria-label="Next service" onClick={() => scrollByDir(1)}>
          ›
        </button>
      </div>
    </div>
  )
}
