'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/lib/theme'

function LogoLink() {
  return (
    <Link href="/" className="nav-logo" aria-label="AdharaEdu home">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 50" height="44" width="220" aria-hidden>
        <rect x="1" y="4" width="38" height="40" rx="12" ry="14" fill="#1E7FD4" />
        <polygon points="20,10 23.5,18.5 33,18.5 25.5,24 28.5,33 20,27.5 11.5,33 14.5,24 7,18.5 16.5,18.5" fill="#F5C518" />
        <text x="46" y="33" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="26" fill="var(--white)">Adhara</text>
        <text x="153" y="14" fontFamily="Arial, sans-serif" fontWeight="700" fontStyle="italic" fontSize="12" fill="#1E7FD4">Edu</text>
        <text x="46" y="46" fontFamily="Georgia, serif" fontStyle="italic" fontSize="9.5" fill="var(--muted)" letterSpacing="0.3">Learn Smart. Grow Together</text>
      </svg>
    </Link>
  )
}

export function MarketingNav() {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const linkClass = (path: string) =>
    pathname === path ? 'active' : undefined

  return (
    <>
      <nav className="nav">
        <LogoLink />
        <ul className="nav-links">
          <li>
            <Link href="/" className={pathname === '/' ? 'active' : undefined}>
              Home
            </Link>
          </li>
          <li>
            <Link href="/services" className={linkClass('/services')}>
              Services
            </Link>
          </li>
          <li>
            <Link href="/#how-it-works">
              How It Works
            </Link>
          </li>
          <li>
            <Link href="/about" className={linkClass('/about')}>
              About
            </Link>
          </li>
          <li>
            <Link href="/contact" className={linkClass('/contact')}>
              Contact
            </Link>
          </li>
        </ul>
        <div className="nav-actions">
          <button
            type="button"
            onClick={toggle}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 18, padding: '10px 14px' }}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <Link href="/auth/login" className="btn btn-outline btn-sm">
            Sign In
          </Link>
          <Link href="/auth/register" className="btn btn-primary btn-sm">
            Get Started →
          </Link>
        </div>
        <button
          type="button"
          className={`hamburger${mobileOpen ? ' open' : ''}`}
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Menu"
          aria-expanded={mobileOpen}
        >
          <span />
          <span />
          <span />
        </button>
      </nav>

      <div className={`mobile-menu${mobileOpen ? ' open' : ''}`} style={{ display: mobileOpen ? 'flex' : 'none' }}>
        <div className="mobile-menu-header">
          <LogoLink />
          <button type="button" className="mobile-menu-close" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            ✕
          </button>
        </div>
        <div className="mobile-menu-links">
          <Link href="/" className="mobile-menu-link" onClick={() => setMobileOpen(false)}>
            Home <span className="link-arrow">→</span>
          </Link>
          <Link href="/services" className="mobile-menu-link" onClick={() => setMobileOpen(false)}>
            Services <span className="link-arrow">→</span>
          </Link>
          <Link href="/#how-it-works" className="mobile-menu-link" onClick={() => setMobileOpen(false)}>
            How It Works <span className="link-arrow">→</span>
          </Link>
          <Link href="/about" className="mobile-menu-link" onClick={() => setMobileOpen(false)}>
            About <span className="link-arrow">→</span>
          </Link>
          <Link href="/contact" className="mobile-menu-link" onClick={() => setMobileOpen(false)}>
            Contact <span className="link-arrow">→</span>
          </Link>
        </div>
        <div className="mobile-menu-actions">
          <Link href="/auth/register" className="btn btn-primary btn-lg" onClick={() => setMobileOpen(false)}>
            Get Started →
          </Link>
          <Link href="/auth/login" className="btn btn-outline btn-lg" onClick={() => setMobileOpen(false)}>
            Sign In
          </Link>
        </div>
      </div>
    </>
  )
}
