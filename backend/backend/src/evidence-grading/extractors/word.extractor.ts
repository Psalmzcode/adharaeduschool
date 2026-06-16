import * as mammoth from 'mammoth';
import { SubmissionEvidence } from '../types/submission-evidence.types';

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function countHeadings(text: string): number {
  return (text.match(/^(#{1,6}\s|\d+\.\s|[A-Z][A-Za-z0-9\s]{2,40}:)/gm) || []).length;
}

export async function extractFromDocxBuffer(buffer: Buffer, fileName = 'document.docx'): Promise<SubmissionEvidence> {
  const result = await mammoth.extractRawText({ buffer });
  const rawText = String(result.value || '').trim();
  const warnings = (result.messages || [])
    .map((m) => m.message)
    .filter(Boolean);

  if (!rawText) {
    return {
      metadata: {
        fileType: 'docx',
        fileName,
        validationWarnings: warnings.length ? warnings : ['Document appears empty after extraction'],
      },
    };
  }

  const paragraphs = rawText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const wordCount = countWords(rawText);
  const headingHints = countHeadings(rawText);
  const structureHints: string[] = [];
  if (paragraphs.length >= 3) structureHints.push(`${paragraphs.length} paragraphs`);
  if (wordCount >= 200) structureHints.push(`${wordCount} words`);
  if (headingHints > 0) structureHints.push(`${headingHints} heading-like lines`);

  const extractedText = [
    structureHints.length ? `Document summary: ${structureHints.join('; ')}` : '',
    rawText.slice(0, 20000),
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    extractedText,
    metadata: {
      fileType: 'docx',
      fileName,
      wordCount,
      lineCount: rawText.split('\n').length,
      validationWarnings: warnings.length ? warnings : undefined,
    },
  };
}
