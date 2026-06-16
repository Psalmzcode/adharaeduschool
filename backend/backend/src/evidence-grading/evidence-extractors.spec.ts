import { EvidenceFixtureBuilder } from './fixtures/evidence-fixture.builder';
import { extractFromHtmlSources, extractFromPlainText } from './extractors/html.extractor';
import { extractFromDocxBuffer } from './extractors/word.extractor';
import { extractFromXlsxBuffer } from './extractors/excel.extractor';
import { extractFromSb3Buffer } from './extractors/scratch.extractor';
import { extractFromZipBuffer } from './extractors/zip.extractor';
import { RuleEngineService } from './rules/rule-engine.service';
import { defaultStructuredRubric } from './rules/rule-catalog';

describe('Evidence extractors', () => {
  describe('html', () => {
    it('detects semantic layout and JS listener', () => {
      const html = `<!DOCTYPE html><html><head><title>T</title><link rel="stylesheet" href="s.css"></head>
<body><header></header><nav></nav><main><button id="b">Go</button></main><footer></footer>
<script>document.getElementById('b').addEventListener('click',()=>{});</script></body></html>`;
      const evidence = extractFromHtmlSources([{ filename: 'index.html', content: html }]);
      expect(evidence.extractedText).toMatch(/header/i);
      expect(evidence.codeFiles?.length).toBeGreaterThan(0);
    });

    it('parses pasted HTML via plain text path', () => {
      const evidence = extractFromPlainText('<html><title>Hi</title></html>', 'html');
      expect(evidence.metadata.fileType).toBe('html');
    });
  });

  describe('word', () => {
    it('extracts text from minimal docx', async () => {
      const buf = await EvidenceFixtureBuilder.docx();
      const evidence = await extractFromDocxBuffer(buf, 'essay.docx');
      expect(evidence.extractedText).toMatch(/Digital citizenship/i);
      expect((evidence.metadata.wordCount ?? 0) >= 200).toBe(true);
    });
  });

  describe('excel', () => {
    it('extracts sheets, rows, and formulas', () => {
      const buf = EvidenceFixtureBuilder.xlsx();
      const evidence = extractFromXlsxBuffer(buf, 'budget.xlsx');
      expect(evidence.tables?.length).toBeGreaterThan(0);
      expect(evidence.tables?.[0]?.headers).toContain('Item');
      expect(evidence.tables?.[0]?.formulas?.length).toBeGreaterThan(0);
    });
  });

  describe('scratch', () => {
    it('parses sprites, motion, and events from sb3', async () => {
      const buf = await EvidenceFixtureBuilder.sb3();
      const evidence = await extractFromSb3Buffer(buf, 'game.sb3');
      expect(evidence.scratchData?.spriteCount).toBeGreaterThanOrEqual(1);
      expect(evidence.scratchData?.hasMotion).toBe(true);
      expect(evidence.scratchData?.hasLoops).toBe(true);
      expect(evidence.scratchData?.scriptSummary?.length).toBeGreaterThan(0);
    });
  });

  describe('zip', () => {
    it('extracts multi-file web project', async () => {
      const buf = await EvidenceFixtureBuilder.zipWebProject();
      const evidence = await extractFromZipBuffer(buf, 'web.zip');
      expect(evidence.codeFiles?.some((f) => f.filename.includes('index.html'))).toBe(true);
      expect(evidence.codeFiles?.some((f) => f.filename.endsWith('.css'))).toBe(true);
      expect(evidence.extractedText).toMatch(/SS3 Club Budget/i);
    });
  });

  describe('rule engine with default rubrics', () => {
    const engine = new RuleEngineService();

    it('scores html rubric rules', async () => {
      const buf = await EvidenceFixtureBuilder.zipWebProject();
      const zipEvidence = await extractFromZipBuffer(buf);
      const rubric = defaultStructuredRubric('zip', 100);
      const result = engine.evaluate(zipEvidence, rubric);
      expect(result.automatedChecksTotal).toBeGreaterThan(0);
      expect(result.automatedScore).toBeGreaterThan(0);
    });

    it('scores scratch rubric rules', async () => {
      const buf = await EvidenceFixtureBuilder.sb3();
      const evidence = await extractFromSb3Buffer(buf);
      const rubric = defaultStructuredRubric('scratch', 100);
      const result = engine.evaluate(evidence, rubric);
      expect(result.automatedChecksPassed).toBeGreaterThanOrEqual(2);
    });
  });
});
