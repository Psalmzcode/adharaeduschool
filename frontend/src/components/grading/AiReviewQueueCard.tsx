'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { assignmentsApi, practicalsApi } from '@/lib/api'

export const PENDING_AI_REVIEW_KEY = 'adhara-tutor-pending-ai-review'

export type AiReviewItem = {
  id: string
  kind: 'assignment' | 'practical'
  title: string
  studentLabel: string
  aiProposedScore: number
  maxScore: number
  parentId: string
  manualReviewRequired?: boolean
  aiConfidence?: number | null
  canAutoApprove?: boolean
}

function studentLabel(s: any): string {
  if (!s?.student) return s?.studentId || 'Student'
  return `${s.student.user?.firstName || ''} ${s.student.user?.lastName || ''}`.trim() || s.studentId
}

function mapQueueItems(asg: any[], prac: any[]): AiReviewItem[] {
  return [
    ...(Array.isArray(asg) ? asg : []).map((s: any) => ({
      id: s.id,
      kind: 'assignment' as const,
      title: s.assignment?.title || 'Assignment',
      studentLabel: studentLabel(s),
      aiProposedScore: s.aiProposedScore,
      maxScore: s.assignment?.maxScore || 100,
      parentId: s.assignment?.id,
      manualReviewRequired: s.manualReviewRequired,
      aiConfidence: s.aiConfidence,
      canAutoApprove: s.canAutoApprove,
    })),
    ...(Array.isArray(prac) ? prac : []).map((s: any) => ({
      id: s.id,
      kind: 'practical' as const,
      title: s.task?.title || 'Practical',
      studentLabel: studentLabel(s),
      aiProposedScore: s.aiProposedScore,
      maxScore: s.task?.maxScore || 100,
      parentId: s.task?.id,
      manualReviewRequired: s.manualReviewRequired,
      aiConfidence: s.aiConfidence,
      canAutoApprove: s.canAutoApprove,
    })),
  ]
    .filter((x) => x.parentId && x.aiProposedScore != null)
    .sort((a, b) => {
      if (a.manualReviewRequired !== b.manualReviewRequired) {
        return a.manualReviewRequired ? -1 : 1
      }
      const ac = a.aiConfidence ?? 1
      const bc = b.aiConfidence ?? 1
      return ac - bc
    })
}

export function useUnifiedAiReviewQueue(refreshKey = 0) {
  const [items, setItems] = useState<AiReviewItem[]>([])

  const load = useCallback(async () => {
    const [asg, prac] = await Promise.all([
      assignmentsApi.aiReviewQueue().catch(() => []),
      practicalsApi.aiReviewQueue().catch(() => []),
    ])
    setItems(mapQueueItems(asg, prac))
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  return { items, reload: load }
}

export function consumePendingAiReview(): AiReviewItem | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(PENDING_AI_REVIEW_KEY)
    if (!raw) return null
    sessionStorage.removeItem(PENDING_AI_REVIEW_KEY)
    const parsed = JSON.parse(raw) as AiReviewItem
    return parsed?.parentId ? parsed : null
  } catch {
    return null
  }
}

export function AiReviewQueueCard({
  items,
  onReview,
  onApprove,
  approvingId,
}: {
  items: AiReviewItem[]
  onReview: (item: AiReviewItem) => void
  onApprove?: (item: AiReviewItem) => void | Promise<void>
  approvingId?: string | null
}) {
  const [showAll, setShowAll] = useState(false)
  const visible = useMemo(() => (showAll ? items : items.slice(0, 12)), [items, showAll])

  if (!items.length) return null

  return (
    <div className="card mb-20" style={{ borderColor: 'rgba(212,168,83,0.4)', background: 'rgba(212,168,83,0.06)' }}>
      <div className="font-display fw-600 text-white mb-6" style={{ fontSize: 15 }}>AI grading review queue</div>
      <div className="text-muted text-sm mb-10">
        {items.length} submission(s) awaiting approval — sorted by items needing manual review first, then lowest confidence.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map((item) => (
          <div key={`${item.kind}-${item.id}`} className="flex-between" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="text-sm" style={{ color: 'var(--white)', flex: 1, minWidth: 200 }}>
              <span className={`badge badge-${item.kind === 'assignment' ? 'info' : 'teal'}`} style={{ marginRight: 8, fontSize: 10 }}>
                {item.kind === 'assignment' ? 'Assignment' : 'Practical'}
              </span>
              {item.manualReviewRequired ? (
                <span className="badge badge-warning" style={{ marginRight: 8, fontSize: 10 }}>
                  Manual review
                </span>
              ) : null}
              {item.title} · {item.studentLabel} · AI {item.aiProposedScore}/{item.maxScore}
              {item.aiConfidence != null ? (
                <span className="text-muted" style={{ marginLeft: 6 }}>
                  ({Math.round(item.aiConfidence * 100)}% conf.)
                </span>
              ) : null}
            </span>
            <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {onApprove && item.canAutoApprove && !item.manualReviewRequired ? (
                <button
                  type="button"
                  className="btn btn-success btn-sm"
                  disabled={approvingId === item.id}
                  onClick={() => onApprove(item)}
                >
                  {approvingId === item.id ? 'Approving…' : 'Approve'}
                </button>
              ) : null}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onReview(item)}>
                Review →
              </button>
            </span>
          </div>
        ))}
      </div>
      {items.length > 12 ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 10 }}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'Show fewer' : `Show all ${items.length}`}
        </button>
      ) : null}
    </div>
  )
}
