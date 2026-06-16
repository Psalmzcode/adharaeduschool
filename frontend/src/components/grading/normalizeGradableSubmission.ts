/** Unify practical vs assignment submission field names for grading UI. */
export function normalizeGradableSubmission<T extends Record<string, unknown>>(submission: T | null | undefined) {
  if (!submission) return submission
  const s = submission as Record<string, unknown>
  return {
    ...submission,
    evidenceUrl: (s.evidenceUrl as string) || (s.fileUrl as string) || null,
    fileUrl: (s.fileUrl as string) || (s.evidenceUrl as string) || null,
    evidenceText: (s.evidenceText as string) || (s.textBody as string) || null,
    textBody: (s.textBody as string) || (s.evidenceText as string) || null,
    totalScore: s.totalScore ?? s.score,
    score: s.score ?? s.totalScore,
  } as T
}
