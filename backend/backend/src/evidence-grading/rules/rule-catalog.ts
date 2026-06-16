import { SubmissionEvidence } from '../types/submission-evidence.types';
import { RuleCriterionResult } from '../types/structured-rubric.types';

type RuleFn = (evidence: SubmissionEvidence) => { passed: boolean; detail: string };

export const RULE_CATALOG: Record<string, RuleFn> = {
  'html.hasTitle': (e) => {
    const html = e.codeFiles?.filter((f) => f.language === 'html').map((f) => f.content).join('\n') || e.extractedText || '';
    const passed = /<title[\s>][\s\S]*?<\/title>/i.test(html);
    return { passed, detail: passed ? 'Page has a <title> element' : 'Missing <title> element' };
  },
  'html.hasHeader': (e) => {
    const html = e.codeFiles?.filter((f) => f.language === 'html').map((f) => f.content).join('\n') || e.extractedText || '';
    const passed = /<header[\s>]/i.test(html);
    return { passed, detail: passed ? 'Has <header>' : 'Missing <header>' };
  },
  'html.hasNav': (e) => {
    const html = e.codeFiles?.filter((f) => f.language === 'html').map((f) => f.content).join('\n') || e.extractedText || '';
    const passed = /<nav[\s>]/i.test(html);
    return { passed, detail: passed ? 'Has <nav>' : 'Missing <nav>' };
  },
  'html.hasMain': (e) => {
    const html = e.codeFiles?.filter((f) => f.language === 'html').map((f) => f.content).join('\n') || e.extractedText || '';
    const passed = /<main[\s>]/i.test(html);
    return { passed, detail: passed ? 'Has <main>' : 'Missing <main>' };
  },
  'html.hasFooter': (e) => {
    const html = e.codeFiles?.filter((f) => f.language === 'html').map((f) => f.content).join('\n') || e.extractedText || '';
    const passed = /<footer[\s>]/i.test(html);
    return { passed, detail: passed ? 'Has <footer>' : 'Missing <footer>' };
  },
  'html.semanticLayout': (e) => {
    const html = e.codeFiles?.filter((f) => f.language === 'html').map((f) => f.content).join('\n') || e.extractedText || '';
    const tags = ['header', 'nav', 'main', 'footer'].filter((t) => new RegExp(`<${t}[\\s>]`, 'i').test(html));
    const passed = tags.length >= 3;
    return {
      passed,
      detail: passed ? `Semantic layout tags found: ${tags.join(', ')}` : `Only ${tags.length}/4 core semantic tags (header, nav, main, footer)`,
    };
  },
  'html.cssLinked': (e) => {
    const html = e.codeFiles?.filter((f) => f.language === 'html').map((f) => f.content).join('\n') || e.extractedText || '';
    const css = e.codeFiles?.filter((f) => f.language === 'css').map((f) => f.content).join('\n') || '';
    const passed = /<link[^>]+stylesheet/i.test(html) || css.length > 20;
    return { passed, detail: passed ? 'CSS is linked or included' : 'No linked stylesheet or CSS file detected' };
  },
  'html.usesFlexOrGrid': (e) => {
    const css = e.codeFiles?.filter((f) => f.language === 'css').map((f) => f.content).join('\n') || e.extractedText || '';
    const passed = /display\s*:\s*(flex|grid)/i.test(css);
    return { passed, detail: passed ? 'Uses flexbox or grid' : 'No flex/grid display rule found' };
  },
  'html.jsEventListener': (e) => {
    const js = e.codeFiles?.filter((f) => f.language === 'javascript').map((f) => f.content).join('\n') || e.extractedText || '';
    const passed = /addEventListener\s*\(|onclick\s*=|\.on\s*\(\s*['"]click/i.test(js);
    return { passed, detail: passed ? 'JavaScript event listener detected' : 'No click/event listener pattern found' };
  },
  'text.minWordCount200': (e) => {
    const words = (e.extractedText || '').split(/\s+/).filter(Boolean).length;
    const passed = words >= 200;
    return { passed, detail: passed ? `${words} words (≥200)` : `${words} words (need ≥200)` };
  },
  'word.minWordCount200': (e) => {
    const words = e.metadata?.wordCount ?? (e.extractedText || '').split(/\s+/).filter(Boolean).length;
    const passed = words >= 200;
    return { passed, detail: passed ? `${words} words (≥200)` : `${words} words (need ≥200)` };
  },
  'word.hasMultipleParagraphs': (e) => {
    const paragraphs = (e.extractedText || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).length;
    const passed = paragraphs >= 3;
    return { passed, detail: passed ? `${paragraphs} paragraphs (≥3)` : `${paragraphs} paragraphs (need ≥3)` };
  },
  'word.hasStructure': (e) => {
    const text = e.extractedText || '';
    const passed = /^(#{1,6}\s|\d+\.\s|[A-Z][A-Za-z0-9\s]{2,40}:)/m.test(text);
    return { passed, detail: passed ? 'Heading or section structure detected' : 'No clear headings or sections found' };
  },
  'excel.hasHeaders': (e) => {
    const table = e.tables?.[0];
    const headers = table?.headers?.filter((h) => String(h || '').trim()) || [];
    const passed = headers.length >= 2;
    return { passed, detail: passed ? `${headers.length} column headers` : 'Missing or sparse header row' };
  },
  'excel.hasDataRows': (e) => {
    const rows = e.tables?.[0]?.rows?.filter((r) => r.some((c) => String(c ?? '').trim())) || [];
    const passed = rows.length >= 3;
    return { passed, detail: passed ? `${rows.length} data rows` : `${rows.length} data rows (need ≥3)` };
  },
  'excel.hasFormulas': (e) => {
    const formulas = e.tables?.flatMap((t) => t.formulas) || [];
    const passed = formulas.length > 0;
    return { passed, detail: passed ? `${formulas.length} formula(s) found` : 'No formulas detected' };
  },
  'excel.multipleSheets': (e) => {
    const count = e.metadata?.sheets ?? e.tables?.length ?? 0;
    const passed = count >= 2;
    return { passed, detail: passed ? `${count} sheets` : `${count} sheet(s) (need ≥2)` };
  },
  'scratch.minSprites': (e) => {
    const count = e.scratchData?.spriteCount ?? 0;
    const passed = count >= 1;
    return { passed, detail: passed ? `${count} sprite(s)` : 'No sprites found (need ≥1)' };
  },
  'scratch.hasMotion': (e) => {
    const passed = Boolean(e.scratchData?.hasMotion);
    return { passed, detail: passed ? 'Motion blocks detected' : 'No motion blocks found' };
  },
  'scratch.hasLoops': (e) => {
    const passed = Boolean(e.scratchData?.hasLoops);
    return { passed, detail: passed ? 'Loop blocks detected' : 'No loop blocks found' };
  },
  'scratch.hasLogic': (e) => {
    const passed = Boolean(e.scratchData?.hasLoops || e.scratchData?.hasConditionals);
    return {
      passed,
      detail: passed ? 'Loops or conditionals detected' : 'No loop or conditional blocks found',
    };
  },
  'scratch.hasConditionals': (e) => {
    const passed = Boolean(e.scratchData?.hasConditionals);
    return { passed, detail: passed ? 'Conditional blocks detected' : 'No conditional blocks found' };
  },
  'scratch.hasEvents': (e) => {
    const scripts = e.scratchData?.scriptSummary || [];
    const passed = scripts.some((s) => /event_/.test(s));
    return { passed, detail: passed ? 'Event-driven scripts found' : 'No event handlers (flag/key/click) detected' };
  },
  'zip.hasHtml': (e) => {
    const files = e.codeFiles || [];
    const passed = files.some((f) => /\.html?$/i.test(f.filename) || f.language === 'html');
    return { passed, detail: passed ? 'HTML file(s) in archive' : 'No HTML files in ZIP' };
  },
  'zip.hasCss': (e) => {
    const files = e.codeFiles || [];
    const passed = files.some((f) => /\.css$/i.test(f.filename) || f.language === 'css');
    return { passed, detail: passed ? 'CSS file(s) in archive' : 'No CSS files in ZIP' };
  },
  'zip.hasJs': (e) => {
    const files = e.codeFiles || [];
    const passed = files.some((f) => /\.js$/i.test(f.filename) || f.language === 'javascript');
    return { passed, detail: passed ? 'JavaScript file(s) in archive' : 'No JS files in ZIP' };
  },
};

export function defaultStructuredRubric(submissionType: string, maxScore = 100): import('../types/structured-rubric.types').StructuredRubric {
  if (submissionType === 'html') {
    return {
      submissionType: 'html',
      allowedExtensions: ['.html', '.htm', '.css', '.js', '.zip'],
      criteria: [
        { id: 'semantic', title: 'Semantic HTML layout', points: 20, type: 'rule', ruleKey: 'html.semanticLayout' },
        { id: 'css', title: 'CSS linked', points: 10, type: 'rule', ruleKey: 'html.cssLinked' },
        { id: 'layout', title: 'Flexbox or Grid', points: 10, type: 'rule', ruleKey: 'html.usesFlexOrGrid' },
        { id: 'js', title: 'JavaScript interactivity', points: 10, type: 'rule', ruleKey: 'html.jsEventListener' },
        { id: 'quality', title: 'Code quality & UX', points: Math.max(20, maxScore - 50), type: 'ai' },
      ],
    };
  }

  if (submissionType === 'word') {
    return {
      submissionType: 'word',
      allowedExtensions: ['.docx'],
      criteria: [
        { id: 'length', title: 'Minimum word count (200+)', points: 15, type: 'rule', ruleKey: 'word.minWordCount200' },
        { id: 'structure', title: 'Document structure', points: 10, type: 'rule', ruleKey: 'word.hasStructure' },
        { id: 'paragraphs', title: 'Multiple paragraphs', points: 10, type: 'rule', ruleKey: 'word.hasMultipleParagraphs' },
        { id: 'content', title: 'Content quality & requirements', points: Math.max(25, maxScore - 35), type: 'ai' },
      ],
    };
  }

  if (submissionType === 'excel') {
    return {
      submissionType: 'excel',
      allowedExtensions: ['.xlsx'],
      criteria: [
        { id: 'headers', title: 'Column headers', points: 10, type: 'rule', ruleKey: 'excel.hasHeaders' },
        { id: 'rows', title: 'Data rows present', points: 10, type: 'rule', ruleKey: 'excel.hasDataRows' },
        { id: 'formulas', title: 'Uses formulas', points: 15, type: 'rule', ruleKey: 'excel.hasFormulas' },
        { id: 'analysis', title: 'Analysis & requirements', points: Math.max(25, maxScore - 35), type: 'ai' },
      ],
    };
  }

  if (submissionType === 'scratch') {
    return {
      submissionType: 'scratch',
      allowedExtensions: ['.sb3'],
      criteria: [
        { id: 'sprites', title: 'At least one sprite', points: 10, type: 'rule', ruleKey: 'scratch.minSprites' },
        { id: 'events', title: 'Event-driven scripts', points: 10, type: 'rule', ruleKey: 'scratch.hasEvents' },
        { id: 'motion', title: 'Motion blocks', points: 10, type: 'rule', ruleKey: 'scratch.hasMotion' },
        { id: 'logic', title: 'Loops or conditionals', points: 10, type: 'rule', ruleKey: 'scratch.hasLogic' },
        { id: 'creativity', title: 'Creativity & brief requirements', points: Math.max(20, maxScore - 40), type: 'ai' },
      ],
    };
  }

  if (submissionType === 'zip') {
    return {
      submissionType: 'zip',
      allowedExtensions: ['.zip'],
      criteria: [
        { id: 'html', title: 'HTML in project', points: 15, type: 'rule', ruleKey: 'zip.hasHtml' },
        { id: 'css', title: 'CSS in project', points: 10, type: 'rule', ruleKey: 'zip.hasCss' },
        { id: 'js', title: 'JavaScript in project', points: 10, type: 'rule', ruleKey: 'zip.hasJs' },
        { id: 'quality', title: 'Project quality & requirements', points: Math.max(25, maxScore - 35), type: 'ai' },
      ],
    };
  }

  if (submissionType === 'image') {
    return {
      submissionType: 'image',
      allowedExtensions: ['.png', '.jpg', '.jpeg', '.pdf'],
      criteria: [
        { id: 'requirements', title: 'Visible requirements met', points: Math.round(maxScore * 0.55), type: 'ai' },
        { id: 'quality', title: 'Quality, clarity & effort', points: Math.max(20, maxScore - Math.round(maxScore * 0.55)), type: 'ai' },
      ],
    };
  }

  return {
    submissionType: submissionType || 'mixed',
    criteria: [
      { id: 'completeness', title: 'Completeness & requirements', points: Math.round(maxScore * 0.5), type: 'ai' },
      { id: 'quality', title: 'Quality & clarity', points: Math.round(maxScore * 0.5), type: 'ai' },
    ],
  };
}

export function runRuleCriterion(
  ruleKey: string,
  evidence: SubmissionEvidence,
  criterion: { id: string; title: string; points: number },
): RuleCriterionResult {
  const fn = RULE_CATALOG[ruleKey];
  if (!fn) {
    return {
      id: criterion.id,
      title: criterion.title,
      score: 0,
      maxPoints: criterion.points,
      method: 'rule',
      passed: false,
      detail: `Unknown rule: ${ruleKey}`,
    };
  }
  const { passed, detail } = fn(evidence);
  return {
    id: criterion.id,
    title: criterion.title,
    score: passed ? criterion.points : 0,
    maxPoints: criterion.points,
    method: 'rule',
    passed,
    detail,
  };
}
