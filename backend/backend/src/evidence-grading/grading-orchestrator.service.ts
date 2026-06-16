import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubmissionEvidenceService } from './submission-evidence.service';
import { RuleEngineService } from './rules/rule-engine.service';
import { AiGradingService } from './grading/ai-grading.service';
import { parseStructuredRubricFromTask } from './grading/build-grading-prompt';
import { EvidenceFetchInput, ExtractionStatus, SubmissionEvidence } from './types/submission-evidence.types';
import { GradingProposal } from './types/structured-rubric.types';

const CONFIDENCE_THRESHOLD = 0.6;

@Injectable()
export class GradingOrchestratorService {
  constructor(
    private evidenceService: SubmissionEvidenceService,
    private ruleEngine: RuleEngineService,
    private aiGrading: AiGradingService,
    private config: ConfigService,
  ) {}

  private threshold(): number {
    const raw = Number(this.config.get('AI_GRADING_CONFIDENCE_THRESHOLD'));
    return Number.isFinite(raw) && raw > 0 && raw < 1 ? raw : CONFIDENCE_THRESHOLD;
  }

  computeConfidence(opts: {
    extractionStatus: ExtractionStatus;
    evidence: SubmissionEvidence;
    aiConfidence?: number;
    rulePassRate: number;
  }): number {
    let base = 1;
    if (opts.extractionStatus === 'failed') base = 0;
    else if (opts.extractionStatus === 'partial') base = 0.45;
    else if (!this.evidenceService.hasVisibleEvidence(opts.evidence)) base = 0.2;

    const ai = opts.aiConfidence ?? 0.65;
    const rules = opts.rulePassRate;
    return Math.max(0, Math.min(1, base * 0.45 + ai * 0.35 + rules * 0.2));
  }

  async extractOnly(input: EvidenceFetchInput): Promise<{
    evidence: SubmissionEvidence;
    status: ExtractionStatus;
    error?: string;
  }> {
    return this.evidenceService.extract(input);
  }

  async buildProposal(opts: {
    task: {
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
    evidence: SubmissionEvidence;
    extractionStatus: ExtractionStatus;
    extractionError?: string;
  }): Promise<GradingProposal> {
    const rubric = parseStructuredRubricFromTask(opts.task);
    const maxScore = opts.task.maxScore || 100;

    const ruleEngineResult = this.ruleEngine.evaluate(opts.evidence, rubric);
    const rulePassRate =
      ruleEngineResult.automatedChecksTotal > 0
        ? ruleEngineResult.automatedChecksPassed / ruleEngineResult.automatedChecksTotal
        : 1;

    const aiCriteria = rubric.criteria.filter((c) => c.type === 'ai');
    let aiGradingResult;
    if (aiCriteria.length && opts.extractionStatus !== 'failed' && this.evidenceService.hasVisibleEvidence(opts.evidence)) {
      aiGradingResult = await this.aiGrading.grade({
        evidence: opts.evidence,
        rubric,
        modelAnswer: rubric.modelAnswer || opts.task.modelAnswer || undefined,
        lessonObjective: rubric.lessonObjective || opts.task.lessonObjective || undefined,
        taskTitle: opts.task.title,
        taskInstructions: opts.task.instructions || opts.task.description || undefined,
      });
    }

    const aiScore = aiGradingResult?.criteria.reduce((s, c) => s + c.score, 0) ?? 0;
    const automatedScore = ruleEngineResult.automatedScore;
    const totalProposedScore = Math.min(maxScore, automatedScore + aiScore);

    const confidence = this.computeConfidence({
      extractionStatus: opts.extractionStatus,
      evidence: opts.evidence,
      aiConfidence: aiGradingResult?.confidence,
      rulePassRate,
    });

    const threshold = this.threshold();
    const manualReviewRequired =
      opts.extractionStatus === 'failed' ||
      !this.evidenceService.hasVisibleEvidence(opts.evidence) ||
      confidence < threshold;

    const canAutoApprove = !manualReviewRequired && opts.extractionStatus === 'ok';

    const breakdown = [
      ...ruleEngineResult.criteria.map((c) => ({
        id: c.id,
        title: c.title,
        score: c.score,
        maxPoints: c.maxPoints,
        method: 'rule' as const,
        detail: c.detail,
      })),
      ...(aiGradingResult?.criteria || []).map((c) => {
        const meta = rubric.criteria.find((r) => r.id === c.id);
        return {
          id: c.id,
          title: meta?.title || c.id,
          score: c.score,
          maxPoints: c.maxPoints,
          method: 'ai' as const,
          feedback: c.feedback,
        };
      }),
    ];

    return {
      automatedScore,
      aiScore,
      totalProposedScore,
      maxScore,
      confidence,
      manualReviewRequired,
      canAutoApprove,
      extractionStatus: opts.extractionStatus,
      ruleEngineResult,
      aiGradingResult,
      breakdown,
      overallFeedback:
        aiGradingResult?.overallFeedback ||
        (opts.extractionError ? `Extraction issue: ${opts.extractionError}` : 'Automated checks complete — please review.'),
      provider: aiGradingResult?.provider,
      modelUsed: aiGradingResult?.modelUsed,
    };
  }
}
