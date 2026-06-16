import { JSZip } from './load-jszip';
import { SubmissionEvidence } from '../types/submission-evidence.types';
import { extractFromHtmlSources } from './html.extractor';

const TEXT_EXTENSIONS = new Set(['.html', '.htm', '.css', '.js', '.txt', '.md']);
const MAX_FILES = 40;
const MAX_FILE_CHARS = 12000;

function extOf(path: string): string {
  const lower = path.toLowerCase();
  const dot = lower.lastIndexOf('.');
  return dot === -1 ? '' : lower.slice(dot);
}

export async function extractFromZipBuffer(
  buffer: Buffer,
  fileName = 'project.zip',
  preferHtml = false,
): Promise<SubmissionEvidence> {
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files).filter((f) => !f.dir).slice(0, MAX_FILES);

  if (!entries.length) {
    return {
      metadata: {
        fileType: 'zip',
        fileName,
        validationWarnings: ['ZIP archive is empty'],
      },
    };
  }

  const fileNames = entries.map((e) => e.name);
  const codeSources: { filename: string; content: string }[] = [];

  for (const entry of entries) {
    const ext = extOf(entry.name);
    if (!TEXT_EXTENSIONS.has(ext)) continue;
    if (preferHtml && !['.html', '.htm', '.css', '.js'].includes(ext)) continue;
    try {
      const content = await entry.async('string');
      if (content.trim()) {
        codeSources.push({ filename: entry.name, content: content.slice(0, MAX_FILE_CHARS) });
      }
    } catch {
      // skip binary or unreadable entries
    }
  }

  if (codeSources.length) {
    const evidence = extractFromHtmlSources(codeSources);
    evidence.metadata.fileType = 'zip';
    evidence.metadata.fileName = fileName;
    evidence.extractedText = [
      `ZIP archive: ${fileNames.length} file(s)`,
      `Extracted code files: ${codeSources.map((f) => f.filename).join(', ')}`,
      evidence.extractedText || '',
    ]
      .filter(Boolean)
      .join('\n\n');
    return evidence;
  }

  return {
    extractedText: `ZIP archive contains ${fileNames.length} file(s): ${fileNames.slice(0, 15).join(', ')}`,
    metadata: {
      fileType: 'zip',
      fileName,
      validationWarnings: ['No readable HTML/CSS/JS/text files found in archive — tutor must review original ZIP'],
    },
  };
}
