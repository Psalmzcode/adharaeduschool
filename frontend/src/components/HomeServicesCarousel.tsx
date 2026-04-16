'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

const SERVICES = [
  { icon: '💻', title: 'Tech Skills Education', desc: 'Track-based curriculum taught by expert tutors in your school.' },
  { icon: '👩‍🏫', title: 'Staff Training', desc: 'Professional development for teachers on pedagogy and technology.' },
  { icon: '🏆', title: 'Student Competitions', desc: 'Inter-school coding challenges with prizes and certificates.' },
  { icon: '🌐', title: 'School Website', desc: 'Professional website, email, and digital presence for your school.' },
  { icon: '💰', title: 'Grants & Funding', desc: 'We help schools apply for government and NGO grants.' },
  { icon: '🎯', title: 'Student Coaching', desc: 'One-on-one academic coaching for students who need more support.' },
] as const

export function HomeServicesCarousel() {
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  const scrollByDir = useCallback((dir: -1 | 1) => {
    const el = trackRef.current
    if (!el) return
    const first = el.querySelector<HTMLElement>('[data-service-card]')
    const gap = 20
    const step = (first?.offsetWidth ?? 300) + gap
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }, [])

  const goTo = useCallback((i: number) => {
    const el = trackRef.current
    if (!el) return
    const cards = el.querySelectorAll<HTMLElement>('[data-service-card]')
    const card = cards[i]
    card?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
  }, [])

  useEffect(() => {
    const root = trackRef.current
    if (!root) return
    const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-service-card]'))
    if (cards.length === 0) return

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const idx = cards.indexOf(entry.target as HTMLElement)
          if (idx >= 0 && entry.intersectionRatio >= 0.45) setActive(idx)
        })
      },
      { root, rootMargin: '0px -20% 0px -20%', threshold: [0.45, 0.55, 0.75] },
    )
    cards.forEach((c) => io.observe(c))
    return () => io.disconnect()
  }, [])

  return (
    <div className="home-services-carousel-root">
      <p className="home-services-carousel-hint">Swipe on touch devices, or use the arrows.</p>

      <div ref={trackRef} className="home-services-carousel-track">
        {SERVICES.map(({ icon, title, desc }) => (
          <div key={title} data-service-card className="home-services-carousel-card card">
            <div className="home-services-carousel-icon" aria-hidden>{icon}</div>
            <h3 className="home-services-carousel-title">{title}</h3>
            <p className="home-services-carousel-desc">{desc}</p>
          </div>
        ))}
      </div>

      <div className="home-services-carousel-toolbar">
        <button type="button" className="home-services-carousel-btn" aria-label="Previous services" onClick={() => scrollByDir(-1)}>
          ‹
        </button>
        <div className="home-services-carousel-dots" role="tablist" aria-label="Service slides">
          {SERVICES.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === active}
              className={`home-services-dot${i === active ? ' active' : ''}`}
              aria-label={`Go to service ${i + 1}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
        <button type="button" className="home-services-carousel-btn" aria-label="Next services" onClick={() => scrollByDir(1)}>
          ›
        </button>
      </div>

      <div className="home-services-carousel-cta">
        <Link href="/services" className="btn btn-primary btn-lg">
          View All 9 Services →
        </Link>
      </div>
    </div>
  )
}
