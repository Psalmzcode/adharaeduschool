'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { MarketingNav } from '@/components/MarketingNav'

const TEAM = [
  {
    name: 'Ali Samuel Chidera',
    role: 'CEO & Co-Founder',
    bio: 'Founder and CEO of AdharaEdu Tech Solutions Limited. A former technology educator building hands-on, employable tech pathways for Nigerian secondary school students.',
    details: {
      title: 'Ali Samuel Chidera – CEO & Co-Founder',
      lead: 'Students working in a computer lab – an environment Ali Chidera is determined to improve.',
      paragraphs: [
        'Ali Samuel Chidera is the visionary Founder and CEO of AdharaEdu Tech Solutions Limited. A former technology educator, Ali spent years teaching web development and digital skills to Nigerian secondary school students.',
        'He founded AdharaEdu after witnessing the digital divide firsthand – for example, many students still rely on costly cybercafés just to practice exam software. Today his mission is to bridge that gap in education by bringing practical, affordable tech education into every school.',
        'Ali’s passion is equipping public schools with functional computer labs and creating clear tech-education pathways for youth (especially girls and rural students). He focuses on recruiting and training qualified tutors and deploying hands-on curriculum, so that every student gains practical, employable skills in coding, design and digital literacy.',
      ],
      bullets: [
        { label: 'Background', text: 'Technology educator with deep experience in secondary school e-learning.' },
        { label: 'Motivation', text: 'Closing Nigeria’s digital skills gap by bringing affordable tech education into every school.' },
        { label: 'Impact focus', text: 'Building computer labs, training teachers, and empowering youth with practical digital skills.' },
      ],
    },
    socials: [
      { href: '#', label: 'LinkedIn', text: 'in' },
      { href: '#', label: 'Twitter', text: '𝕏' },
      { href: '#', label: 'Email', text: '@' },
    ],
  },
  {
    name: 'Okechukwu Emmanuel Ukwueji',
    role: 'CTO & Co-Founder',
    bio: 'Leads platform engineering and system architecture — building reliable school dashboards, lesson tools, and assessments that work even on slow internet.',
    details: {
      title: 'Okechukwu Emmanuel Ukwueji – CTO & Co-Founder',
      lead: 'A software engineer coding – representing the technology platform that powers AdharaEdu.',
      paragraphs: [
        'Okechukwu Emmanuel Ukwueji is the Chief Technology Officer and Co-Founder of AdharaEdu. With expertise in software development and system architecture, he leads the design and deployment of AdharaEdu’s learning platform and digital curriculum.',
        'He joined the team after seeing a glaring disconnect: Nigerian schools often teach outdated computer theory, yet very few practical tech tools are available to students. He is passionate about creating simple, reliable, and scalable educational technology.',
        'He is most excited about iterating the platform’s features (like real-time lesson reports and gamified exercises) so that educators can effortlessly deliver quality digital education to every student.',
      ],
      bullets: [
        { label: 'Role', text: 'Leads all technical development — from curriculum software to student dashboards.' },
        { label: 'Approach', text: 'Builds robust solutions that remain usable on slow internet and limited devices.' },
        { label: 'Vision', text: 'Automate attendance, progress tracking, and assessments so schools focus on teaching, not tech headaches.' },
      ],
    },
    socials: [
      { href: '#', label: 'LinkedIn', text: 'in' },
      { href: '#', label: 'Twitter', text: '𝕏' },
      { href: '#', label: 'GitHub', text: '⌥' },
    ],
  },
  {
    name: '[Name]',
    role: 'COO & Co-Founder',
    bio: 'Leads operations, partnerships, and programme delivery — scaling AdharaEdu into new schools and ensuring inclusive access for girls and underserved communities.',
    details: {
      title: '[Name] – COO & Co-Founder',
      lead: 'Female students collaborating on laptops – a reminder of the opportunities AdharaEdu is creating for girls in tech.',
      paragraphs: [
        '[Name] is the Chief Operating Officer and Co-Founder of AdharaEdu. With a strong background in operations, partnership-building and education management, she drives the organization’s expansion into new regions and schools.',
        'She was inspired to co-found AdharaEdu by a deep concern for students in underserved communities, especially girls. She works on forging partnerships with public schools and community groups to bring tech training directly to these students.',
        'She is most excited about scaling AdharaEdu’s reach across Nigeria: by strengthening school relationships and tailoring programs for different regions, she ensures no child is left behind in the digital economy.',
      ],
      bullets: [
        { label: 'Expertise', text: 'Operations and education program management with an emphasis on inclusion.' },
        { label: 'Focus', text: 'Serving girls and rural students through dedicated programs and partnerships.' },
        { label: 'Ambition', text: 'Build a nationwide network of tech-enabled schools and expand partnerships across regions.' },
      ],
    },
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
  const [openMemberIdx, setOpenMemberIdx] = useState<number | null>(null)

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMemberIdx(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (openMemberIdx == null) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [openMemberIdx])

  const openMember = openMemberIdx != null ? TEAM[openMemberIdx] : null

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
              <img
                src="/about/hero-main.png"
                alt="Student using a laptop in a library study environment"
                width={900}
                height={600}
                decoding="async"
              />
            </div>
            <div className="hero-img-accent">
              <img
                src="/about/hero-accent.png"
                alt="Modern computer lab with rows of workstations"
                width={600}
                height={400}
                decoding="async"
              />
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
                <div className="team-photo-placeholder" aria-hidden>
                  <div className="avatar-ring">👤</div>
                </div>
                <div className="team-photo-overlay" />
              </div>
              <div className="team-info">
                <h3>{m.name}</h3>
                <div className="team-role">{m.role}</div>
                <p className="team-bio">{m.bio}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpenMemberIdx(idx)}>
                    Read more →
                  </button>
                  <div className="team-socials" style={{ marginTop: 0 }}>
                    {m.socials.map((s) => (
                      <a key={s.label} className="social-dot" href={s.href} title={s.label}>
                        {s.text}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Read more modal — styles: .about-team-modal* in globals.css (tablet/mobile safe areas, dvh) */}
      {openMember && (
        <div
          className="about-team-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`${openMember.name} details`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenMemberIdx(null)
          }}
        >
          <div
            className="card about-team-modal__panel"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="btn btn-ghost btn-sm about-team-modal__close"
              onClick={() => setOpenMemberIdx(null)}
              aria-label="Close"
            >
              Close ✕
            </button>

            <div className="about-team-modal__head">
              <div className="about-team-modal__avatar" aria-hidden>
                👤
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="section-eyebrow" style={{ marginBottom: 8 }}>
                  // founder
                </div>
                <div className="font-display fw-800 text-white about-team-modal__title">
                  {(openMember as any).details?.title || `${openMember.name} — ${openMember.role}`}
                </div>
                {(openMember as any).details?.lead && (
                  <div className="text-muted text-sm" style={{ marginTop: 10 }}>
                    {(openMember as any).details.lead}
                  </div>
                )}
              </div>
            </div>

            <div className="about-team-modal__body" style={{ marginTop: 18 }}>
              {Array.isArray((openMember as any).details?.paragraphs) && (openMember as any).details.paragraphs.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(openMember as any).details.paragraphs.map((p: string, i: number) => (
                    <p key={i} style={{ color: 'var(--muted)', lineHeight: 1.75 }}>
                      {p}
                    </p>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--muted)', lineHeight: 1.75 }}>{openMember.bio}</p>
              )}

              {Array.isArray((openMember as any).details?.bullets) && (openMember as any).details.bullets.length ? (
                <div className="about-team-modal__bullets" style={{ marginTop: 16, display: 'grid', gap: 10 }}>
                  {(openMember as any).details.bullets.map((b: any, i: number) => (
                    <div
                      key={i}
                      style={{ background: 'var(--muted3)', border: '1px solid var(--border2)', borderRadius: 14, padding: 12 }}
                    >
                      <div className="about-team-modal__bullet-label">{b.label}</div>
                      <div className="about-team-modal__bullet-text" style={{ marginTop: 6, lineHeight: 1.6 }}>
                        {b.text}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

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
