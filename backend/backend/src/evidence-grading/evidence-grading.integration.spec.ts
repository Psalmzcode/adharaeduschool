/**
 * Optional pipeline integration (extract → rules). No database required.
 * Run: RUN_INTEGRATION=1 pnpm test:integration
 * ZIP render preview: ENABLE_HTML_PREVIEW=1 RUN_INTEGRATION=1 pnpm test:integration
 */
import { ConfigService } from '@nestjs/config';
import { EvidenceFixtureBuilder } from './fixtures/evidence-fixture.builder';
import { SubmissionEvidenceService } from './submission-evidence.service';
import { UploadValidationService } from './validation/upload-validation.service';
import { HtmlPreviewService } from './html-preview.service';
import { RuleEngineService } from './rules/rule-engine.service';
import { parseStructuredRubricFromTask } from './grading/build-grading-prompt';

const runIntegration = process.env.RUN_INTEGRATION === '1';

(runIntegration ? describe : describe.skip)('Evidence grading pipeline integration', () => {
  let evidenceService: SubmissionEvidenceService;

  beforeAll(() => {
    const config = new ConfigService({
      ENABLE_HTML_PREVIEW: process.env.ENABLE_HTML_PREVIEW || '0',
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    });
    evidenceService = new SubmissionEvidenceService(
      new UploadValidationService(),
      config,
      new HtmlPreviewService(config),
    );
  });

  it('extracts word, excel, scratch, and zip fixtures from buffers', async () => {
    const docx = await EvidenceFixtureBuilder.docx();
    const word = await evidenceService.extractFromBuffer(docx, 'essay.docx', 'word');
    expect(word.status).toBe('ok');
    expect(evidenceService.hasVisibleEvidence(word.evidence)).toBe(true);

    const xlsx = EvidenceFixtureBuilder.xlsx();
    const excel = await evidenceService.extractFromBuffer(xlsx, 'sheet.xlsx', 'excel');
    expect(excel.status).toBe('ok');
    expect(excel.evidence.tables?.length).toBeGreaterThan(0);

    const sb3 = await EvidenceFixtureBuilder.sb3();
    const scratch = await evidenceService.extractFromBuffer(sb3, 'game.sb3', 'scratch');
    expect(scratch.status).toBe('ok');
    expect(scratch.evidence.scratchData?.hasMotion).toBe(true);

    const zip = await EvidenceFixtureBuilder.zipWebProject();
    const zipResult = await evidenceService.extractFromBuffer(zip, 'web.zip', 'zip');
    expect(zipResult.status).toBe('ok');
    if (process.env.ENABLE_HTML_PREVIEW === '1') {
      expect(zipResult.evidence.extractedText).toMatch(/Rendered page text/i);
    }
  });

  it('scores scratch evidence with default structured rubric rules', async () => {
    const ruleEngine = new RuleEngineService();
    const sb3 = await EvidenceFixtureBuilder.sb3();
    const { evidence, status } = await evidenceService.extractFromBuffer(sb3, 'game.sb3', 'scratch');
    expect(status).toBe('ok');
    const rubric = parseStructuredRubricFromTask({ submissionType: 'scratch', maxScore: 100 });
    const rules = ruleEngine.evaluate(evidence, rubric);
    expect(rules.automatedScore).toBeGreaterThan(0);
    expect(rules.automatedChecksPassed).toBeGreaterThanOrEqual(2);
  });
});
