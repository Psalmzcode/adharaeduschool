import { BadRequestException, Injectable } from '@nestjs/common';
import { SubmissionEvidence, ExtractionStatus } from './types/submission-evidence.types';
import { GradingProposal } from './types/structured-rubric.types';
import { GradingOrchestratorService } from './grading-orchestrator.service';
import { SubmissionEvidenceService } from './submission-evidence.service';

export type GradableTask = {
  title: string;
  instructions?: string | null;
  description?: string | null;
  maxScore?: number;
  structuredRubric?: unknown;
  rubric?: unknown;
  submissionType?: string | null;
  modelAnswer?: string | null;
  lessonObjective?: string | null;
  allowedExtensions?: unknown;
  maxSizeMB?: number | null;
};

export type GradableSubmissionInput = {
  evidenceUrl?: string | null;
  evidenceText?: string | null;
  fileUrl?: string | null;
  textBody?: string | null;
  extractedEvidence?: unknown;
  extractionStatus?: string | null;
};

@Injectable()
export class SubmissionGradingHelperService {
  constructor(
    private orchestrator: GradingOrchestratorService,
    private evidenceService: SubmissionEvidenceService,
  ) {}

  submissionHasGradeableSource(submission: GradableSubmissionInput): boolean {
    return (
      Boolean(
        String(
          submission.evidenceUrl || submission.fileUrl || submission.evidenceText || submission.textBody || '',
        ).trim(),
      ) || this.evidenceService.hasVisibleEvidence(submission.extractedEvidence as SubmissionEvidence)
    );
  }

  private gradeableInlineText(submission: GradableSubmissionInput): string | undefined {
    const raw = String(submission.evidenceText || submission.textBody || '').trim();
    if (!raw) return undefined;
    if (this.evidenceService.isSeedLabelOnly(raw)) return undefined;
    return raw;
  }

  async extractAndPropose(task: GradableTask, submission: GradableSubmissionInput) {
    const hasFile = Boolean(String(submission.evidenceUrl || submission.fileUrl || '').trim());
    const cached = submission.extractedEvidence as SubmissionEvidence | null | undefined;
    const cachedStatus = String(submission.extractionStatus || '') as ExtractionStatus;
    const canUseCache =
      cached &&
      this.evidenceService.isRichExtractedEvidence(cached, task.submissionType) &&
      (cachedStatus === 'ok' || cachedStatus === 'partial');

    let evidence: SubmissionEvidence;
    let status: ExtractionStatus;
    let error: string | undefined;

    if (canUseCache) {
      evidence = cached;
      status = cachedStatus;
    } else {
      const extracted = await this.orchestrator.extractOnly({
        evidenceUrl: submission.evidenceUrl || submission.fileUrl,
        evidenceText: this.gradeableInlineText(submission),
        submissionType: task.submissionType,
        allowedExtensions: Array.isArray(task.allowedExtensions) ? (task.allowedExtensions as string[]) : null,
        maxSizeMB: task.maxSizeMB,
        lessonObjective: task.lessonObjective,
      });
      evidence = extracted.evidence;
      status = extracted.status;
      error = extracted.error;
    }

    const proposal = await this.orchestrator.buildProposal({
      task,
      evidence,
      extractionStatus: status,
      extractionError: error,
    });

    return { evidence, status, error, proposal };
  }

  proposalPersistData(
    proposal: GradingProposal,
    evidence: SubmissionEvidence,
    status: ExtractionStatus,
    error?: string,
  ) {
    return {
      extractedEvidence: evidence as any,
      extractionStatus: status,
      extractionError: error || null,
      extractedAt: new Date(),
      ruleEngineResult: proposal.ruleEngineResult as any,
      automatedScore: proposal.automatedScore,
      aiScore: proposal.aiScore,
      aiProposedScore: proposal.totalProposedScore,
      aiProposedFeedback: proposal.overallFeedback,
      aiScoreBreakdown: {
        breakdown: proposal.breakdown,
        flags: proposal.aiGradingResult?.flags || [],
      } as any,
      aiConfidence: proposal.confidence,
      manualReviewRequired: proposal.manualReviewRequired,
      gradingProvider: proposal.provider || null,
      gradingModelUsed: proposal.modelUsed || null,
      aiGradedAt: new Date(),
    };
  }

  extractionPersistData(
    evidence: SubmissionEvidence,
    status: ExtractionStatus,
    error?: string,
  ) {
    return {
      extractedEvidence: evidence as any,
      extractionStatus: status,
      extractionError: error || null,
      extractedAt: new Date(),
    };
  }

  /** Wipe cached extraction + AI fields when a student replaces their submission file. */
  clearEvidenceOnResubmit() {
    return {
      extractedEvidence: null,
      extractionError: null,
      extractedAt: null,
      ruleEngineResult: null,
      automatedScore: null,
      aiScore: null,
      aiProposedScore: null,
      aiProposedFeedback: null,
      aiScoreBreakdown: null,
      aiConfidence: null,
      aiGradedAt: null,
      manualReviewRequired: false,
      gradingProvider: null,
      gradingModelUsed: null,
    };
  }

  assertCanApproveAi(
    submission: {
      aiProposedScore?: number | null;
      extractedEvidence?: unknown;
      extractionStatus?: string | null;
      manualReviewRequired?: boolean | null;
    },
    submissionType?: string | null,
  ) {
    if (submission.aiProposedScore == null) {
      throw new BadRequestException('No AI grade proposal — run AI suggest grade first');
    }
    const hasEvidence = this.evidenceService.isRichExtractedEvidence(
      submission.extractedEvidence as SubmissionEvidence,
      submissionType,
    );
    if (submission.extractionStatus === 'failed' || !hasEvidence) {
      throw new BadRequestException(
        'Cannot approve AI grade — evidence was not extracted. Grade manually after reviewing the original file.',
      );
    }
    if (submission.manualReviewRequired) {
      throw new BadRequestException(
        'Manual review required (low confidence or partial extraction). Use Save grade after reviewing.',
      );
    }
  }

  gradingPreviewPayload(submission: any, task: { id: string; title: string; maxScore?: number; submissionType?: string }) {
    const hasEvidence = this.evidenceService.isRichExtractedEvidence(
      submission.extractedEvidence,
      task.submissionType,
    );
    const canAutoApprove =
      submission.extractionStatus === 'ok' &&
      hasEvidence &&
      !submission.manualReviewRequired &&
      (submission.aiConfidence ?? 0) >= 0.6 &&
      submission.aiProposedScore != null &&
      !submission.gradedAt;

    return {
      submissionId: submission.id,
      extractionStatus: submission.extractionStatus,
      extractionError: submission.extractionError,
      extractedEvidence: submission.extractedEvidence,
      hasVisibleEvidence: hasEvidence,
      ruleEngineResult: submission.ruleEngineResult,
      automatedScore: submission.automatedScore,
      aiScore: submission.aiScore,
      aiProposedScore: submission.aiProposedScore,
      aiProposedFeedback: submission.aiProposedFeedback,
      aiScoreBreakdown: submission.aiScoreBreakdown,
      aiConfidence: submission.aiConfidence,
      manualReviewRequired: submission.manualReviewRequired,
      canAutoApprove,
      gradedAt: submission.gradedAt,
      task,
    };
  }
}
