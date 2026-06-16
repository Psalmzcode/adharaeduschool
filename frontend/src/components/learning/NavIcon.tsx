'use client'

import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  ClipboardList,
  FlaskConical,
} from 'lucide-react'

/** Lucide icons for learning-related nav sections (Phase 3 lite). */
export const LEARNING_NAV_ICONS: Record<string, LucideIcon> = {
  'student-modules': BookOpen,
  'student-assignments': ClipboardList,
  'student-practicals': FlaskConical,
  'tutor-lessons': BookOpen,
  'tutor-practicals': FlaskConical,
  'tutor-assignments': ClipboardList,
}

type NavIconProps = {
  section: string
  fallbackEmoji: string
  active?: boolean
}

export function NavIcon({ section, fallbackEmoji, active }: NavIconProps) {
  const Icon = LEARNING_NAV_ICONS[section]
  if (!Icon) {
    return <span className="link-icon">{fallbackEmoji}</span>
  }
  return (
    <span className="link-icon nav-icon-lucide" aria-hidden>
      <Icon size={18} strokeWidth={1.75} color={active ? 'var(--gold2)' : 'currentColor'} />
    </span>
  )
}
