export const FORMAL_TEST_DURATION_SEC = 180
export const PROGRAMME_WPM_TARGET = 25
export const TRACK1_TYPING_MODULE_NUMBER = 2

/** Track 1 Module 2 — where typing is first taught; lab stays open for the rest of Track 1. */
export function isTrack1TypingAnchorModule(
  module: { number?: number; track?: string } | null | undefined,
): boolean {
  if (!module) return false
  return String(module.track || '') === 'TRACK_1' && Number(module.number) === TRACK1_TYPING_MODULE_NUMBER
}

export function computeTypingMetrics(
  typed: string,
  source: string,
  elapsedSec: number,
  kind: 'practice' | 'formal_test',
) {
  const durationSec = Math.max(1, Math.round(elapsedSec))
  let correctChars = 0
  let errorCount = 0
  const len = typed.length
  const srcLen = Math.max(1, source.length)
  for (let i = 0; i < len; i++) {
    if (typed[i] === source[i % srcLen]) correctChars += 1
    else errorCount += 1
  }
  const accuracy = len > 0 ? Math.round((correctChars / len) * 1000) / 10 : 0
  const minutes = durationSec / 60
  const wpm = Math.round(correctChars / 5 / minutes)
  const isValidScore =
    kind !== 'formal_test' || (correctChars >= 150 && accuracy >= 90)
  return { wpm, accuracy, correctChars, errorCount, durationSec, isValidScore }
}

export function formatCountdown(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
