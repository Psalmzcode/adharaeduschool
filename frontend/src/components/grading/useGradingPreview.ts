'use client'

import { useEffect, useState } from 'react'
import { assignmentsApi, practicalsApi } from '@/lib/api'

export type GradingPreviewPayload = {
  submissionId: string
  extractionStatus?: string
  extractionError?: string | null
  hasVisibleEvidence?: boolean
  canAutoApprove?: boolean
  aiProposedScore?: number | null
  aiConfidence?: number | null
  manualReviewRequired?: boolean | null
}

export function useGradingPreview(
  submissionId: string | null | undefined,
  kind: 'assignment' | 'practical',
  refreshKey = 0,
) {
  const [preview, setPreview] = useState<GradingPreviewPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!submissionId) {
      setPreview(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    const load =
      kind === 'assignment'
        ? assignmentsApi.gradingPreview(submissionId)
        : practicalsApi.gradingPreview(submissionId)
    load
      .then((data) => {
        if (!cancelled) setPreview(data as GradingPreviewPayload)
      })
      .catch((e: any) => {
        if (!cancelled) {
          setPreview(null)
          setError(e?.message || 'Could not load grading preview')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [submissionId, kind, refreshKey])

  return { preview, loading, error }
}
