'use client'

import { useMemo } from 'react'
import { ExtractedEvidenceDetails } from './ExtractedEvidenceDetails'
import { normalizeGradableSubmission } from './normalizeGradableSubmission'
import { useGradingPreview } from './useGradingPreview'

type GradingRow = {
  id: string
  title: string
  score: number
  maxPoints: number
  method: 'rule' | 'ai'
  detail?: string
  feedback?: string
}

export function SubmissionGradingProposal({
  submission: s,
  maxScore,
  scoreValue,
  feedbackValue,
  onScoreChange,
  onFeedbackChange,
  onAiGrade,
  onApprove,
  onSave,
  aiGradingId,
  grading,
  submissionType,
  gradingKind = 'practical',
  previewRefreshKey = 0,
}: {
  submission: any
  maxScore: number
  scoreValue: string
  feedbackValue: string
  onScoreChange: (v: string) => void
  onFeedbackChange: (v: string) => void
  onAiGrade: () => void
  onApprove: () => void
  onSave: () => void
  aiGradingId: string | null
  grading: boolean
  submissionType?: string | null
  gradingKind?: 'assignment' | 'practical'
  /** Bump after AI grade / resubmit to reload grading-preview. */
  previewRefreshKey?: number
}) {
  const submission = useMemo(() => normalizeGradableSubmission(s), [s])
  const { preview, loading: previewLoading } = useGradingPreview(
    submission?.id,
    gradingKind,
    previewRefreshKey,
  )
  const effectivePreview = preview?.submissionId === submission?.id ? preview : null

  const scoreVal = submission?.totalScore ?? submission?.score
  const graded =
    submission?.gradedAt != null ||
    (scoreVal != null && ['GRADED', 'PASSED'].includes(String(submission?.status || '')))
  const canApprove =
    effectivePreview?.canAutoApprove ??
    (submission?.aiProposedScore != null &&
      !graded &&
      !submission?.manualReviewRequired &&
      submission?.extractionStatus === 'ok' &&
      (submission?.aiConfidence ?? 0) >= 0.6)

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <label className="form-label">Score</label>
          <input
            className="form-input"
            inputMode="decimal"
            value={scoreValue}
            onChange={(e) => onScoreChange(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ minWidth: 0 }}>
          <label className="form-label">Feedback</label>
          <textarea
            className="form-input"
            rows={3}
            value={feedbackValue}
            onChange={(e) => onFeedbackChange(e.target.value)}
            style={{ width: '100%', resize: 'vertical', minHeight: 72 }}
          />
        </div>
      </div>

      {previewLoading && (
        <div className="text-xs text-muted" style={{ padding: '6px 0' }}>
          Loading grading preview…
        </div>
      )}
      {effectivePreview?.canAutoApprove && !graded && submission?.aiProposedScore != null && (
        <div
          className="text-xs"
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.25)',
            color: '#4ADE80',
          }}
        >
          Ready for quick approve — extraction ok, confidence ≥ 60%, no manual review flag.
        </div>
      )}

      {submission?.extractionStatus === 'pending' && (
        <div
          className="text-xs"
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            background: 'rgba(26,127,212,0.08)',
            border: '1px solid rgba(26,127,212,0.25)',
            color: 'var(--muted)',
          }}
        >
          Extracting evidence from the submission… You can wait, run AI suggest grade, or grade manually using the original file.
        </div>
      )}

      {(submission?.extractionStatus === 'failed' || effectivePreview?.extractionStatus === 'failed') && (
        <div
          className="text-xs"
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: '#F87171',
          }}
        >
          Evidence extraction failed
          {submission?.extractionError || effectivePreview?.extractionError
            ? `: ${submission?.extractionError || effectivePreview?.extractionError}`
            : ''}
          . Grade manually after reviewing the original file.
        </div>
      )}

      {submission?.extractedEvidence &&
        (submission.extractionStatus === 'ok' || submission.extractionStatus === 'partial') &&
        (submission.extractedEvidence.extractedText ||
          submission.extractedEvidence.codeFiles?.length ||
          submission.extractedEvidence.tables?.length ||
          submission.extractedEvidence.scratchData) && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(45,212,191,0.06)',
              border: '1px solid rgba(45,212,191,0.2)',
            }}
          >
            <div className="text-xs text-muted mb-4">
              Extracted evidence · {submission.extractionStatus}
              {submission.extractedAt ? ` · ${new Date(submission.extractedAt).toLocaleString()}` : ''}
              {effectivePreview?.hasVisibleEvidence === false ? ' · preview: no rich evidence' : ''}
            </div>
            <ExtractedEvidenceDetails
              evidence={submission.extractedEvidence}
              evidenceUrl={submission.evidenceUrl || submission.fileUrl}
              submissionType={submissionType}
            />
          </div>
        )}

      {submission?.aiProposedScore != null && !graded && (
        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.25)' }}>
          <div className="text-xs text-muted mb-4">
            AI proposal{submission.aiConfidence != null ? ` · confidence ${Math.round(submission.aiConfidence * 100)}%` : ''}
            {submission.extractionStatus ? ` · extraction ${submission.extractionStatus}` : ''}
            {submission.automatedScore != null ? ` · rules ${submission.automatedScore}` : ''}
            {submission.aiScore != null ? ` · AI ${submission.aiScore}` : ''}
          </div>
          <div className="text-sm" style={{ color: 'var(--white)' }}>
            Score {submission.aiProposedScore}/{maxScore}
            {submission.aiProposedFeedback && <span className="text-muted"> — {submission.aiProposedFeedback}</span>}
          </div>
          {Array.isArray(submission.aiScoreBreakdown?.breakdown) && submission.aiScoreBreakdown.breakdown.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(submission.aiScoreBreakdown.breakdown as GradingRow[]).map((row) => (
                <div key={row.id} className="text-xs text-muted">
                  {row.method === 'rule' ? '✓' : '◆'} {row.title}: {row.score}/{row.maxPoints}
                  {row.detail ? ` — ${row.detail}` : row.feedback ? ` — ${row.feedback}` : ''}
                </div>
              ))}
            </div>
          )}
          {submission.manualReviewRequired && (
            <div className="text-xs" style={{ color: 'var(--warning)', marginTop: 8 }}>
              Manual review required — use Save grade after checking the submission.
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onAiGrade} disabled={aiGradingId === submission?.id || grading}>
          {aiGradingId === submission?.id ? 'AI grading…' : 'AI suggest grade'}
        </button>
        {canApprove && (
          <button type="button" className="btn btn-success btn-sm" onClick={onApprove} disabled={grading}>
            Approve AI grade
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={onSave} disabled={grading}>
          Save grade
        </button>
      </div>
    </>
  )
}

const SUBMISSION_TYPES = [
  { value: 'mixed', label: 'Mixed (any supported file or text)' },
  { value: 'html', label: 'Web design (HTML/CSS/JS)' },
  { value: 'text', label: 'Written text / pasted content' },
  { value: 'word', label: 'Word document (.docx)' },
  { value: 'excel', label: 'Excel spreadsheet (.xlsx)' },
  { value: 'scratch', label: 'Scratch project (.sb3)' },
  { value: 'zip', label: 'ZIP code project' },
  { value: 'image', label: 'Image / PDF (screenshot or scan)' },
]

export function SubmissionTypeFields({
  submissionType,
  modelAnswer,
  lessonObjective,
  allowedExtensions,
  maxSizeMB,
  onChange,
}: {
  submissionType: string
  modelAnswer: string
  lessonObjective: string
  allowedExtensions?: string
  maxSizeMB?: string | number
  onChange: (patch: {
    submissionType?: string
    modelAnswer?: string
    lessonObjective?: string
    allowedExtensions?: string
    maxSizeMB?: string
  }) => void
}) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="form-label">Submission type</label>
          <select
            className="form-input"
            value={submissionType}
            onChange={(e) => onChange({ submissionType: e.target.value })}
            style={{ appearance: 'none' }}
          >
            {SUBMISSION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Lesson objective (optional)</label>
          <input
            className="form-input"
            value={lessonObjective}
            onChange={(e) => onChange({ lessonObjective: e.target.value })}
            placeholder="What students must demonstrate"
          />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <div>
          <label className="form-label">Allowed extensions (optional)</label>
          <input
            className="form-input"
            value={allowedExtensions || ''}
            onChange={(e) => onChange({ allowedExtensions: e.target.value })}
            placeholder=".docx, .zip, .html"
          />
        </div>
        <div>
          <label className="form-label">Max file size (MB)</label>
          <input
            className="form-input"
            inputMode="decimal"
            value={maxSizeMB ?? '10'}
            onChange={(e) => onChange({ maxSizeMB: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className="form-label">Model answer / checklist (optional)</label>
        <textarea
          className="form-input"
          rows={2}
          value={modelAnswer}
          onChange={(e) => onChange({ modelAnswer: e.target.value })}
          placeholder="Must include: header, nav, flex layout, click handler…"
          style={{ resize: 'vertical' }}
        />
      </div>
    </>
  )
}
