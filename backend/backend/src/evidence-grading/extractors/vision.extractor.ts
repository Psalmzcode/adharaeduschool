import { ConfigService } from '@nestjs/config';
import { geminiGenerateMultimodal } from '../../common/gemini-json.client';
import { SubmissionEvidence } from '../types/submission-evidence.types';

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf',
};

export function mimeTypeForExtension(ext: string): string | null {
  return MIME_BY_EXT[ext.toLowerCase()] || null;
}

export async function extractFromVisionBuffer(
  config: ConfigService,
  buffer: Buffer,
  mimeType: string,
  fileName: string,
  lessonObjective?: string,
): Promise<SubmissionEvidence> {
  const base64 = buffer.toString('base64');
  const isPdf = mimeType === 'application/pdf';
  const prompt = [
    'You are extracting factual evidence from a student ICT assignment submission for tutor review.',
    'Describe everything visible: readable text, UI elements, code snippets, tables, diagrams, labels, and signs of completeness.',
    'Do NOT assign a grade. Be specific and objective.',
    lessonObjective ? `Lesson objective: ${lessonObjective}` : '',
    isPdf ? 'This is a PDF document.' : 'This is an image/screenshot submission.',
  ]
    .filter(Boolean)
    .join('\n');

  const { text, modelUsed } = await geminiGenerateMultimodal(
    config,
    [
      { text: prompt },
      { inlineData: { mimeType, data: base64 } },
    ],
    { temperature: 0.2, maxOutputTokens: 2048 },
  );

  const description = String(text || '').trim();
  if (!description) {
    return {
      metadata: {
        fileType: isPdf ? 'pdf' : 'image',
        fileName,
        validationWarnings: ['Vision model returned no description'],
      },
    };
  }

  return {
    extractedText: description.slice(0, 20000),
    images: [
      {
        url: fileName,
        description: description.slice(0, 800),
      },
    ],
    metadata: {
      fileType: isPdf ? 'pdf' : 'image',
      fileName,
      wordCount: description.split(/\s+/).filter(Boolean).length,
      validationWarnings: [`Vision extraction via ${modelUsed}`],
    },
  };
}
