/**
 * Grading flow without DB or live Gemini.
 * Run: RUN_INTEGRATION=1 pnpm test:integration
 */
import { ConfigService } from '@nestjs/config';
import { EvidenceFixtureBuilder } from './fixtures/evidence-fixture.builder';
import { SubmissionEvidenceService } from './submission-evidence.service';
import { UploadValidationService } from './validation/upload-validation.service';
import { HtmlPreviewService } from './html-preview.service';
import { RuleEngineService } from './rules/rule-engine.service';
import { GradingOrchestratorService } from './grading-orchestrator.service';
import { SubmissionGradingHelperService } from './submission-grading-helper.service';
import { AiGradingService } from './grading/ai-grading.service';
import { GeminiGradingAdapter } from './grading/gemini-grading.adapter';
import { parseStructuredRubricFromTask } from './grading/build-grading-prompt';

const runIntegration = process.env.RUN_INTEGRATION === '1';

(runIntegration ? describe : describe.skip)('Grading flow (extract → propose → approve gate)', () => {
  let evidenceService: SubmissionEvidenceService;
  let orchestrator: GradingOrchestratorService;
  let gradingHelper: SubmissionGradingHelperService;

  beforeAll(() => {
    const config = new ConfigService({
      ENABLE_HTML_PREVIEW: '0',
      GEMINI_API_KEY: '',
      AI_GRADING_CONFIDENCE_THRESHOLD: 0.6,
    });
    evidenceService = new SubmissionEvidenceService(
      new UploadValidationService(),
      config,
      new HtmlPreviewService(config),
    );
    const ruleEngine = new RuleEngineService();
    const aiGrading = new AiGradingService(new GeminiGradingAdapter(config));
    orchestrator = new GradingOrchestratorService(evidenceService, ruleEngine, aiGrading, config);
    gradingHelper = new SubmissionGradingHelperService(orchestrator, evidenceService);
  });

  it('ZIP: extract → buildProposal → rich evidence passes approve gate', async () => {
    const zip = await EvidenceFixtureBuilder.zipWebProject();
    const { evidence, status } = await evidenceService.extractFromBuffer(zip, 'web.zip', 'zip');
    expect(status).toBe('ok');

    const task = {
      title: 'ZIP web project',
      submissionType: 'zip',
      maxScore: 100,
      instructions: 'Submit HTML, CSS, JS in a ZIP',
      structuredRubric: {
        submissionType: 'zip',
        criteria: [
          { id: 'html', title: 'HTML in project', points: 15, type: 'rule', ruleKey: 'zip.hasHtml' },
          { id: 'css', title: 'CSS in project', points: 10, type: 'rule', ruleKey: 'zip.hasCss' },
          { id: 'js', title: 'JavaScript in project', points: 10, type: 'rule', ruleKey: 'zip.hasJs' },
        ],
      },
    };
    const proposal = await orchestrator.buildProposal({ task, evidence, extractionStatus: status });
    expect(proposal.totalProposedScore).toBeGreaterThan(0);
    expect((evidence.codeFiles?.length ?? 0) > 0).toBe(true);

    expect(() =>
      gradingHelper.assertCanApproveAi(
        {
          aiProposedScore: proposal.totalProposedScore,
          extractedEvidence: evidence,
          extractionStatus: status,
          manualReviewRequired: proposal.manualReviewRequired,
        },
        task.submissionType,
      ),
    ).not.toThrow();
  });

  it('rejects approve when submissionType is zip but evidence is label-only', () => {
    const thin = {
      extractedText: '[SEED] ZIP demo — generated web project archive',
      metadata: { fileType: 'zip' },
    };
    expect(() =>
      gradingHelper.assertCanApproveAi(
        {
          aiProposedScore: 80,
          extractedEvidence: thin,
          extractionStatus: 'ok',
          manualReviewRequired: false,
        },
        'zip',
      ),
    ).toThrow();
  });

  it('gradingPreviewPayload surfaces canAutoApprove for rich zip evidence', async () => {
    const zip = await EvidenceFixtureBuilder.zipWebProject();
    const { evidence, status } = await evidenceService.extractFromBuffer(zip, 'web.zip', 'zip');
    const task = { id: 't1', title: 'ZIP', maxScore: 100, submissionType: 'zip' };
    const payload = gradingHelper.gradingPreviewPayload(
      {
        id: 'sub1',
        extractedEvidence: evidence,
        extractionStatus: status,
        aiProposedScore: 85,
        aiConfidence: 0.9,
        manualReviewRequired: false,
        gradedAt: null,
      },
      task,
    );
    expect(payload.hasVisibleEvidence).toBe(true);
    expect(payload.canAutoApprove).toBe(true);
  });

  it('default scratch rubric produces automated points from fixture', async () => {
    const sb3 = await EvidenceFixtureBuilder.sb3();
    const { evidence, status } = await evidenceService.extractFromBuffer(sb3, 'game.sb3', 'scratch');
    const rubric = parseStructuredRubricFromTask({ submissionType: 'scratch', maxScore: 100 });
    const rules = new RuleEngineService().evaluate(evidence, rubric);
    expect(status).toBe('ok');
    expect(rules.automatedScore).toBeGreaterThan(0);
  });
});
