'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { MarketingNav } from '@/components/MarketingNav'

const TEAM = [
  {
    name: 'Founder Name',
    role: 'CEO & Co-Founder',
    bio: "Write a short bio here. Talk about their background, what drove them to start AdharaEdu, and what they're most excited about.",
    socials: [
      { href: '#', label: 'LinkedIn', text: 'in' },
      { href: '#', label: 'Twitter', text: '𝕏' },
      { href: '#', label: 'Email', text: '@' },
    ],
  },
  {
    name: 'Founder Name',
    role: 'CTO & Co-Founder',
    bio: "Write a short bio here. Talk about their background, what drove them to start AdharaEdu, and what they're most excited about.",
    socials: [
      { href: '#', label: 'LinkedIn', text: 'in' },
      { href: '#', label: 'Twitter', text: '𝕏' },
      { href: '#', label: 'GitHub', text: '⌥' },
    ],
  },
  {
    name: 'Founder Name',
    role: 'COO & Co-Founder',
    bio: "Write a short bio here. Talk about their background, what drove them to start AdharaEdu, and what they're most excited about.",
    socials: [
      { href: '#', label: 'LinkedIn', text: 'in' },
      { href: '#', label: 'Twitter', text: '𝕏' },
      { href: '#', label: 'Email', text: '@' },
    ],
  },
]

const VALUES = [
  {
    icon: '🎯',
    title: 'Access for All',
    text: 'We build curriculum that works in schools with old computers and slow internet — because that\'s the reality for most Nigerian students.',
  },
  {
    icon: '🏆',
    title: 'Quality Without Compromise',
    text: 'Every tutor we deploy is trained and vetted. Every module we teach maps to real industry skills — not watered-down textbook theory.',
  },
  {
    icon: '🌍',
    title: 'Local First, Global Ready',
    text: 'We root our teaching in Nigerian context — local examples, local case studies — while preparing students to compete globally on platforms like Fiverr and Upwork.',
  },
  {
    icon: '📊',
    title: 'Accountability to Schools',
    text: 'Our platform gives school admins full visibility: attendance, progress, reports, exams. We earn trust through transparency.',
  },
]

function StatCell({
  target,
  label,
  delayClass = '',
}: {
  target: number
  label: string
  delayClass?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [started, setStarted] = useState(false)
  const [display, setDisplay] = useState('0')

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setStarted(true)
          io.unobserve(e.target)
        }
      },
      { threshold: 0.5 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!started) return
    let start = 0
    const dur = 1800
    const tick = (timestamp: number) => {
      if (!start) start = timestamp
      const progress = Math.min((timestamp - start) / dur, 1)
      const ease = 1 - (1 - progress) ** 3
      const current = Math.floor(ease * target)
      let text: string
      if (target >= 1000) {
        text = current >= 1000 ? `${(current / 1000).toFixed(1)}k` : String(current)
      } else {
        text = String(current)
      }
      if (progress >= 1) {
        if (target >= 1000) text = `${(target / 1000).toFixed(0)}k`
        else if (target === 98) text = '98%'
        else text = String(target)
      }
      setDisplay(text)
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [started, target])

  return (
    <div ref={ref} className={`stat-cell reveal ${delayClass}`.trim()}>
      <div className="stat-num">{display}</div>
      <div className="stat-lbl">{label}</div>
    </div>
  )
}

export default function AboutPage() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('visible')
        })
      },
      { threshold: 0.15 }
    )
    root.querySelectorAll('.reveal, .value-item, .team-card').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={rootRef} className="about-page marketing-subpage">
      <MarketingNav />

      <div className="about-hero">
        <div className="about-hero-text">
          <div className="section-eyebrow">// our story</div>
          <h1>
            Built for
            <br />
            <span>Nigerian Schools</span>
          </h1>
          <p>
            AdharaEdu was founded on one belief: every Nigerian student deserves access to quality tech education — regardless of where their school is located or how much
            funding it has.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/contact" className="btn btn-primary">
              Partner With Us →
            </Link>
            <Link href="/services" className="btn btn-outline">
              Our Curriculum
            </Link>
          </div>
        </div>
        <div className="about-hero-visual">
          <div className="hero-img-stack">
            <div className="hero-img-main">
              <div className="img-placeholder">
                <span>🏫</span>
                <p>// school-photo.jpg</p>
              </div>
            </div>
            <div className="hero-img-accent">
              <div className="img-placeholder">
                <span>📸</span>
                <p>// founders.jpg</p>
              </div>
            </div>
            <div className="floating-badge-about">
              <div className="badge-num">50+</div>
              <div className="badge-lbl">Partner Schools</div>
            </div>
          </div>
        </div>
      </div>

      <div className="stats-strip">
        <StatCell target={50} label="Schools Partnered" />
        <StatCell target={12000} label="Students Enrolled" delayClass="reveal-delay-1" />
        <StatCell target={98} label="% Completion Rate" delayClass="reveal-delay-2" />
        <StatCell target={3} label="Learning Tracks" delayClass="reveal-delay-3" />
      </div>

      <div className="mission-section" id="mission">
        <div className="mission-grid">
          <div className="mission-sticky">
            <div className="section-eyebrow">// mission & values</div>
            <h2 className="section-title marketing-mission-title">
              Why We Do
              <br />
              What We Do
            </h2>
            <p className="mission-text">
              Nigeria has some of the most brilliant young minds in the world. What they often lack is structured access to the skills that will define the next economy —
              coding, design, data, and digital entrepreneurship.
            </p>
            <p className="mission-text" style={{ marginTop: 16 }}>
              AdharaEdu bridges that gap, one classroom at a time.
            </p>
          </div>
          <div>
            {VALUES.map((v) => (
              <div key={v.title} className="value-item">
                <div className="value-icon">{v.icon}</div>
                <div>
                  <h4>{v.title}</h4>
                  <p>{v.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="team-section">
        <div className="team-header reveal">
          <div className="section-eyebrow">// the team</div>
          <h2 className="section-title marketing-team-title">The Founders</h2>
          <p>The people who left comfortable jobs to bet on Nigerian students.</p>
        </div>
        <div className="team-grid">
          {TEAM.map((m, idx) => (
            <div key={`${m.role}-${idx}`} className="team-card">
              <div className="team-photo">
                <div className="team-photo-placeholder">
                  <div className="avatar-ring">👤</div>
                  <p>// photo</p>
                </div>
                <div className="team-photo-overlay" />
              </div>
              <div className="team-info">
                <h3>{m.name}</h3>
                <div className="team-role">{m.role}</div>
                <p className="team-bio">{m.bio}</p>
                <div className="team-socials">
                  {m.socials.map((s) => (
                    <a key={s.label} className="social-dot" href={s.href} title={s.label}>
                      {s.text}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="about-cta-banner">
        <div className="section-eyebrow" style={{ justifyContent: 'center', display: 'flex' }}>
          // join us
        </div>
        <h2>Bring Tech Skills to Your School</h2>
        <p>Reach out and let&apos;s start a conversation about what AdharaEdu can do for your students.</p>
        <Link href="/contact" className="btn btn-primary">
          Contact Us Today →
        </Link>
      </div>

      <footer className="marketing-footer">
        <p>© 2026 AdharaEdu. All rights reserved.</p>
        <p>
          Built for Nigerian Schools 🇳🇬 &nbsp;·&nbsp;{' '}
          <a href="mailto:info@adharaedu.com">info@adharaedu.com</a>
        </p>
      </footer>
    </div>
  )
}
