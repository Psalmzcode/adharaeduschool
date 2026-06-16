'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import './home-loader.css'

const NAME = 'AdharaEdu'
const ACCENT_START = 6
const TOTAL_DURATION = 2700

type Props = {
  onDismiss: () => void
}

export function HomePageLoader({ onDismiss }: Props) {
  const [exiting, setExiting] = useState(false)
  const [removed, setRemoved] = useState(false)
  const dismissedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return
    dismissedRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    setExiting(true)
    onDismiss()
    document.body.classList.remove('hl-loading')
  }, [onDismiss])

  useLayoutEffect(() => {
    document.body.classList.add('hl-loading')
  }, [])

  useEffect(() => {
    timerRef.current = setTimeout(dismiss, TOTAL_DURATION)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      document.body.classList.remove('hl-loading')
    }
  }, [dismiss])

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || !exiting) return
    setRemoved(true)
  }

  if (removed) return null

  return (
    <div
      className={`hl-overlay${exiting ? ' hl-exit' : ''}`}
      onClick={dismiss}
      onTransitionEnd={handleTransitionEnd}
      role="status"
      aria-live="polite"
      aria-label="Loading AdharaEdu"
    >
      <div className="hl-corner tl" aria-hidden />
      <div className="hl-corner tr" aria-hidden />
      <div className="hl-corner bl" aria-hidden />
      <div className="hl-corner br" aria-hidden />

      <div className="hl-glow" aria-hidden />
      <div className="hl-glow-gold" aria-hidden />

      <div className="hl-logo">
        <div className="hl-icon">
          <div className="hl-orbit-ring" aria-hidden />
          <div className="hl-icon-dot" aria-hidden />

          <svg className="hl-star-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <polygon
              className="hl-star-glow"
              points="12,1.5 14.8,8.5 22.5,8.5 16.5,13 18.8,20 12,16 5.2,20 7.5,13 1.5,8.5 9.2,8.5"
            />
            <polygon
              className="hl-star-outline"
              points="12,1.5 14.8,8.5 22.5,8.5 16.5,13 18.8,20 12,16 5.2,20 7.5,13 1.5,8.5 9.2,8.5"
            />
          </svg>
        </div>

        <div className="hl-wordmark">
          <div className="hl-name">
            {NAME.split('').map((ch, i) => (
              <span
                key={`${ch}-${i}`}
                className={`hl-letter${i >= ACCENT_START ? ' hl-accent' : ''}`}
                style={{ animationDelay: `${1.2 + i * 0.055}s` }}
              >
                {ch === ' ' ? '\u00A0' : ch}
              </span>
            ))}
          </div>
          <div className="hl-tagline">Tech education for secondary schools</div>
        </div>
      </div>

      <div className="hl-progress">
        <div className="hl-progress-track">
          <div className="hl-progress-fill" />
        </div>
        <div className="hl-progress-label">Loading</div>
      </div>
    </div>
  )
}
