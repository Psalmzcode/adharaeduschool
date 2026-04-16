/** Labels for school onboarding / profile display (matches complete-school-profile options). */

export const SCHOOL_TYPE_LABELS: Record<string, string> = {
  NURSERY_PRIMARY: 'Nursery / Primary',
  PRIMARY: 'Primary',
  SECONDARY: 'Secondary',
  MIXED: 'Mixed (Primary & Secondary)',
  OTHER: 'Other',
}

export const TRACK_LABELS: Record<string, string> = {
  TRACK_1: 'Track 1 — Computer Appreciation (JSS–SS1)',
  TRACK_2: 'Track 2 — Introduction to Programming (SS1–SS2)',
  TRACK_3: 'Track 3 — Advanced Tech Skills (SS3)',
}

export function formatSchoolType(v: string | undefined | null): string {
  if (!v) return '—'
  return SCHOOL_TYPE_LABELS[v] || v
}

export function formatTrack(v: string | undefined | null): string {
  if (!v) return '—'
  return TRACK_LABELS[v] || v.replace(/^TRACK_/, 'Track ')
}

/** Same order as original complete-school-profile form */
export const SCHOOL_TYPE_OPTIONS: { v: string; l: string }[] = [
  { v: 'NURSERY_PRIMARY', l: SCHOOL_TYPE_LABELS.NURSERY_PRIMARY },
  { v: 'PRIMARY', l: SCHOOL_TYPE_LABELS.PRIMARY },
  { v: 'SECONDARY', l: SCHOOL_TYPE_LABELS.SECONDARY },
  { v: 'MIXED', l: SCHOOL_TYPE_LABELS.MIXED },
  { v: 'OTHER', l: SCHOOL_TYPE_LABELS.OTHER },
]

export const TRACK_OPTIONS: { v: string; l: string }[] = [
  { v: 'TRACK_1', l: TRACK_LABELS.TRACK_1 },
  { v: 'TRACK_2', l: TRACK_LABELS.TRACK_2 },
  { v: 'TRACK_3', l: TRACK_LABELS.TRACK_3 },
]
