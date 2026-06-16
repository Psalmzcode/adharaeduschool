import { SubmissionEvidence } from '../types/submission-evidence.types';

function detectLanguage(filename: string, content: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.css')) return 'css';
  if (lower.endsWith('.js')) return 'javascript';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  if (/<html[\s>]/i.test(content)) return 'html';
  if (/function\s|const\s|let\s|=>/.test(content)) return 'javascript';
  if (/\{[\s\S]*:[\s\S]*;/.test(content)) return 'css';
  return 'text';
}

export function extractFromHtmlSources(sources: { filename: string; content: string }[]): SubmissionEvidence {
  const codeFiles = sources.map((s) => ({
    filename: s.filename,
    language: detectLanguage(s.filename, s.content),
    content: s.content,
  }));

  const htmlFiles = codeFiles.filter((f) => f.language === 'html');
  const cssFiles = codeFiles.filter((f) => f.language === 'css');
  const jsFiles = codeFiles.filter((f) => f.language === 'javascript');

  const htmlCombined = htmlFiles.map((f) => f.content).join('\n');
  const cssCombined = cssFiles.map((f) => f.content).join('\n');
  const jsCombined = jsFiles.map((f) => f.content).join('\n');

  const lineCount = codeFiles.reduce((n, f) => n + f.content.split('\n').length, 0);

  const structureHints: string[] = [];
  if (/<title[\s>]/i.test(htmlCombined)) structureHints.push('Has <title>');
  if (/<header[\s>]/i.test(htmlCombined)) structureHints.push('Has <header>');
  if (/<nav[\s>]/i.test(htmlCombined)) structureHints.push('Has <nav>');
  if (/<main[\s>]/i.test(htmlCombined)) structureHints.push('Has <main>');
  if (/<footer[\s>]/i.test(htmlCombined)) structureHints.push('Has <footer>');
  if (/<link[^>]+rel=["']stylesheet["']/i.test(htmlCombined) || cssCombined.length > 0) {
    structureHints.push('CSS linked or provided');
  }
  if (/display\s*:\s*(flex|grid)/i.test(cssCombined)) structureHints.push('Uses flexbox or grid');
  if (/addEventListener\s*\(|onclick\s*=|\.on\s*\(\s*['"]click/i.test(jsCombined)) {
    structureHints.push('JS event listener pattern found');
  }

  const extractedText = [
    structureHints.length ? `Structure summary: ${structureHints.join('; ')}` : '',
    htmlCombined ? `--- HTML ---\n${htmlCombined.slice(0, 12000)}` : '',
    cssCombined ? `--- CSS ---\n${cssCombined.slice(0, 8000)}` : '',
    jsCombined ? `--- JavaScript ---\n${jsCombined.slice(0, 8000)}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    extractedText: extractedText || undefined,
    codeFiles,
    metadata: {
      fileType: 'html',
      lineCount,
      wordCount: extractedText ? extractedText.split(/\s+/).filter(Boolean).length : 0,
    },
  };
}

export function extractFromPlainText(text: string, fileType = 'text'): SubmissionEvidence {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    return { metadata: { fileType, validationWarnings: ['No text content'] } };
  }

  if (/<html[\s>]/i.test(trimmed) || /<!DOCTYPE html/i.test(trimmed)) {
    return extractFromHtmlSources([{ filename: 'submission.html', content: trimmed }]);
  }

  if (trimmed.includes('--- CSS ---') || /\.css/i.test(trimmed)) {
    return extractFromHtmlSources([{ filename: 'submission.txt', content: trimmed }]);
  }

  return {
    extractedText: trimmed.slice(0, 20000),
    metadata: {
      fileType,
      wordCount: trimmed.split(/\s+/).filter(Boolean).length,
      lineCount: trimmed.split('\n').length,
    },
  };
}
