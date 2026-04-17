'use client'
import Link from 'next/link'
import { MarketingNav } from '@/components/MarketingNav'
import { ServicesCatalogCarousel } from '@/components/ServicesCatalogCarousel'

const TRACK_CARDS = [
  {
    color: 'rgba(26,127,212,0.2)',
    border: 'rgba(26,127,212,0.2)',
    label: 'TRACK 01 · JSS1–SS1',
    labelColor: 'var(--teal2)',
    title: 'Computer Appreciation',
    items: ['Computer parts, mouse, keyboard basics', 'Windows OS, files & folders', 'Microsoft Word & Excel', 'Internet safety & email etiquette', 'Typing speed (target: 25 wpm)'],
  },
  {
    color: 'rgba(212,168,83,0.3)',
    border: 'rgba(212,168,83,0.3)',
    label: 'TRACK 02 · SS1–SS2',
    labelColor: 'var(--gold)',
    title: 'Intro to Programming',
    items: ['Scratch: events, loops, conditionals, mini-games', 'HTML — building real webpages', 'CSS — colors, fonts, layouts', 'JavaScript basics & interactivity', 'Final project: personal portfolio page'],
  },
  {
    color: 'rgba(59,130,246,0.2)',
    border: 'rgba(59,130,246,0.2)',
    label: 'TRACK 03 · SS3',
    labelColor: '#93C5FD',
    title: 'Advanced Tech Skills',
    items: ['Frontend dev: HTML + CSS + JS combined', 'Responsive design for mobile', 'Python: variables, loops, functions', 'Backend basics & databases', 'Freelancing, Fiverr & capstone project'],
  },
] as const

export default function ServicesPage() {
  return (
    <div id="page-services" className="page active" style={{ display: 'block' }}>
      <MarketingNav />

      <div className="services-page-hero">
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 60% at 50% 100%,rgba(212,168,83,0.07),transparent)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', textAlign: 'center', maxWidth: 700, margin: '0 auto' }}>
          <div className="hero-eyebrow" style={{ justifyContent: 'center' }}>
            <span className="dot" /> Complete Service Catalogue
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(40px,5vw,68px)', marginBottom: 20, lineHeight: 1.05 }}>
            Everything AdharaEdu
            <br />
            <span
              style={{
                background: 'linear-gradient(135deg,var(--gold),var(--teal2))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Does for Schools
            </span>
          </h1>
          <p style={{ fontSize: 17, color: 'rgba(248,245,239,0.6)', lineHeight: 1.8, marginBottom: 36 }}>
            Nine services designed to address every challenge Nigerian schools face — from classroom quality to digital presence, student performance to international funding.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <span className="badge badge-gold">For Schools</span>
            <span className="badge badge-teal">For Students</span>
            <span className="badge badge-info">Online</span>
            <span className="badge badge-success">Events</span>
            <span className="badge badge-warning">Funding</span>
          </div>
        </div>
      </div>

      <div className="services-page-content">
        <div style={{ marginBottom: 80 }} id="svc-tech">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
            <div
              style={{
                width: 56,
                height: 56,
                background: 'rgba(212,168,83,0.15)',
                border: '1px solid rgba(212,168,83,0.3)',
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 26,
                flexShrink: 0,
              }}
            >
              💻
            </div>
            <div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--gold)', letterSpacing: '0.1em', marginBottom: 4 }}>SERVICE 01 · FLAGSHIP</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(24px,3vw,36px)' }}>Tech Skills Education Program</h2>
            </div>
          </div>
          <div className="services-page-track-grid">
            {TRACK_CARDS.map((s) => (
              <div key={s.title} className="services-page-track-card" style={{ border: `1px solid ${s.border}` }}>
                <div className="services-page-track-label" style={{ color: s.labelColor }}>{s.label}</div>
                <h4 className="services-page-track-card-title">{s.title}</h4>
                <div className="services-page-track-card-items">
                  {s.items.map((item) => (
                    <div key={item} className="services-page-track-card-item">
                      <span style={{ color: s.labelColor, flexShrink: 0 }} aria-hidden>→</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border2)', marginBottom: 80 }} />

        <ServicesCatalogCarousel />
      </div>

      <div className="services-page-cta">
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,48px)', fontWeight: 800, marginBottom: 16 }}>Ready to Partner with AdharaEdu?</h2>
        <p style={{ fontSize: 17, color: 'var(--muted)', marginBottom: 36, maxWidth: 500, margin: '0 auto 36px' }}>Contact us today to discuss how we can bring these services to your school.</p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/auth/register" className="btn btn-primary btn-lg">
            Register Your School →
          </Link>
          <Link href="/auth/login" className="btn btn-outline btn-lg">
            View Demo Dashboard
          </Link>
        </div>
      </div>

      <footer>
        <div className="footer-bottom">
          <p>© 2026 AdharaEdu. All rights reserved.</p>
          <Link href="/" style={{ color: 'var(--gold)', textDecoration: 'none', fontSize: 13 }}>
            ← Back to Home
          </Link>
        </div>
      </footer>
    </div>
  )
}
