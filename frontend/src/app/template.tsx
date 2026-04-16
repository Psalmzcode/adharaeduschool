'use client'

import { usePathname } from 'next/navigation'
import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Fade + slight lift on client route changes. First full page load skips motion
 * (transitionId stays 0) so LCP is not blocked. prefers-reduced-motion handled in CSS.
 */
export default function RootTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [transitionId, setTransitionId] = useState(0)
  const prevPath = useRef<string | null>(null)

  useLayoutEffect(() => {
    if (prevPath.current === null) {
      prevPath.current = pathname
      return
    }
    if (prevPath.current !== pathname) {
      prevPath.current = pathname
      setTransitionId((i) => i + 1)
    }
  }, [pathname])

  const shouldEnter = transitionId > 0

  return (
    <div
      key={`${pathname}-${transitionId}`}
      className={shouldEnter ? 'app-page-shell app-page-shell--enter' : 'app-page-shell'}
    >
      {children}
    </div>
  )
}
