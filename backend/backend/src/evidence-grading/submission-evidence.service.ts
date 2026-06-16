import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EvidenceFetchInput,
  ExtractionStatus,
  SubmissionEvidence,
} from './types/submission-evidence.types';
import { extractFromHtmlSources, extractFromPlainText } from './extractors/html.extractor';
import { extractFromDocxBuffer } from './extractors/word.extractor';
import { extractFromXlsxBuffer } from './extractors/excel.extractor';
import { extractFromSb3Buffer } from './extractors/scratch.extractor';
import { extractFromZipBuffer } from './extractors/zip.extractor';
import { extractFromVisionBuffer, mimeTypeForExtension } from './extractors/vision.extractor';
import { UploadValidationService } from './validation/upload-validation.service';
import { HtmlPreviewService } from './html-preview.service';

const MAX_BYTES = 12 * 1024 * 1024;

@Injectable()
export class SubmissionEvidenceService {
  constructor(
    private uploadValidation: UploadValidationService,
    private config: ConfigService,
    private htmlPreview: HtmlPreviewService,
  ) {}

  private async fetchBuffer(url: string, maxSizeMB = 10): Promise<{ buffer: Buffer; fileName: string }> {
    await this.uploadValidation.validateFetchSize(url, maxSizeMB);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not fetch file (${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > Math.max(maxSizeMB, 1) * 1024 * 1024) {
      throw new Error(`File exceeds ${maxSizeMB}MB after download`);
    }
    if (buf.length > MAX_BYTES) throw new Error('File too large to extract');
    const pathname = (() => {
      try {
        return new URL(url).pathname.split('/').pop() || 'file';
      } catch {
        return 'file';
      }
    })();
    return { buffer: buf, fileName: pathname };
  }

  private async fetchText(url: string, maxSizeMB = 10): Promise<{ text: string; fileName: string }> {
    const { buffer, fileName } = await this.fetchBuffer(url, maxSizeMB);
    return { text: buffer.toString('utf8'), fileName };
  }

  private extensionFromName(fileName: string): string {
    const lower = String(fileName || '').toLowerCase();
    const dot = lower.lastIndexOf('.');
    return dot === -1 ? '' : lower.slice(dot);
  }

  private async enrichZipWithRenderedPreview(evidence: SubmissionEvidence): Promise<SubmissionEvidence> {
    if (!this.htmlPreview.isEnabled() || !evidence.codeFiles?.length) return evidence;
    const rendered = await this.htmlPreview.captureVisibleText(evidence.codeFiles);
    if (!rendered) return evidence;
    return {
      ...evidence,
      extractedText: [evidence.extractedText, `--- Rendered page text ---\n${rendered}`].filter(Boolean).join('\n\n'),
    };
  }

  /** Process an in-memory file buffer (tests, seed helpers). */
  async extractFromBuffer(
    buffer: Buffer,
    fileName: string,
    submissionType = 'mixed',
    opts?: { lessonObjective?: string; inlineText?: string },
  ): Promise<{ evidence: SubmissionEvidence; status: ExtractionStatus; error?: string }> {
    const ext = this.extensionFromName(fileName);
    const inlineText = String(opts?.inlineText || '').trim();
    const type = String(submissionType || 'mixed').toLowerCase();

    try {
      if (ext === '.docx' || type === 'word') {
        const evidence = await extractFromDocxBuffer(buffer, fileName);
        const status: ExtractionStatus = evidence.extractedText?.trim() ? 'ok' : 'failed';
        return { evidence, status };
      }
      if (ext === '.xlsx' || type === 'excel') {
        const evidence = extractFromXlsxBuffer(buffer, fileName);
        const status: ExtractionStatus =
          evidence.extractedText?.trim() || (evidence.tables?.length ?? 0) > 0 ? 'ok' : 'failed';
        return { evidence, status };
      }
      if (ext === '.sb3' || type === 'scratch') {
        const evidence = await extractFromSb3Buffer(buffer, fileName);
        return { evidence, status: evidence.scratchData ? 'ok' : 'failed' };
      }
      if (ext === '.zip' || type === 'zip') {
        let evidence = await extractFromZipBuffer(buffer, fileName, type === 'html');
        evidence = await this.enrichZipWithRenderedPreview(evidence);
        const hasCode = (evidence.codeFiles?.length ?? 0) > 0 || Boolean(evidence.extractedText?.trim());
        return { evidence, status: hasCode ? 'ok' : 'partial' };
      }
      const visionMime = mimeTypeForExtension(ext) || (type === 'image' ? 'image/png' : null);
      if (visionMime && (['.png', '.jpg', '.jpeg', '.pdf'].includes(ext) || type === 'image')) {
        const evidence = await extractFromVisionBuffer(this.config, buffer, visionMime, fileName, opts?.lessonObjective);
        return { evidence, status: evidence.extractedText?.trim() ? 'ok' : 'failed' };
      }
      const text = buffer.toString('utf8');
      if (['.html', '.htm', '.css', '.js'].includes(ext) || type === 'html') {
        return { evidence: extractFromHtmlSources([{ filename: fileName, content: text }]), status: 'ok' };
      }
      if (inlineText || ['.txt', '.md'].includes(ext) || type === 'text') {
        return { evidence: extractFromPlainText(inlineText || text, type === 'html' ? 'html' : 'text'), status: 'ok' };
      }
      return {
        evidence: { metadata: { fileType: ext.replace('.', '') || 'unknown', fileName } },
        status: 'failed',
        error: `Unsupported buffer type: ${ext || fileName}`,
      };
    } catch (e: any) {
      return {
        evidence: { metadata: { fileType: 'error', fileName, validationWarnings: [e?.message || 'extract failed'] } },
        status: 'failed',
        error: e?.message,
      };
    }
  }

  async extract(input: EvidenceFetchInput): Promise<{ evidence: SubmissionEvidence; status: ExtractionStatus; error?: string }> {
    const warnings: string[] = [];
    const url = String(input.evidenceUrl || input.fileUrl || '').trim();
    const inlineText = String(input.evidenceText || input.textBody || '').trim();
    const submissionType = String(input.submissionType || 'mixed').toLowerCase();
    const maxSizeMB = input.maxSizeMB ?? 10;

    try {
      if (url) {
        const validation = this.uploadValidation.validateUrl({
          url,
          allowedExtensions: input.allowedExtensions,
          submissionType,
        });
        if (!validation.ok) {
          const msg = (validation as { ok: false; message: string }).message;
          return {
            evidence: { metadata: { fileType: 'unknown', sourceUrl: url, validationWarnings: [msg] } },
            status: 'failed',
            error: msg,
          };
        }

        const ext = validation.extension;
        const { buffer, fileName } = await this.fetchBuffer(url, maxSizeMB);

        if (ext === '.docx' || submissionType === 'word') {
          const evidence = await extractFromDocxBuffer(buffer, fileName || 'document.docx');
          evidence.metadata.sourceUrl = url;
          if (inlineText) {
            evidence.extractedText = [evidence.extractedText, `--- Student note ---\n${inlineText}`].filter(Boolean).join('\n\n');
          }
          const status: ExtractionStatus = evidence.extractedText?.trim() ? 'ok' : 'failed';
          return { evidence, status, error: status === 'failed' ? 'Could not extract text from Word document' : undefined };
        }

        if (ext === '.xlsx' || submissionType === 'excel') {
          const evidence = extractFromXlsxBuffer(buffer, fileName || 'workbook.xlsx');
          evidence.metadata.sourceUrl = url;
          if (inlineText) {
            evidence.extractedText = [evidence.extractedText, `--- Student note ---\n${inlineText}`].filter(Boolean).join('\n\n');
          }
          const status: ExtractionStatus =
            (evidence.extractedText?.trim() || (evidence.tables?.length ?? 0) > 0) ? 'ok' : 'failed';
          return { evidence, status, error: status === 'failed' ? 'Could not extract data from Excel workbook' : undefined };
        }

        if (ext === '.sb3' || submissionType === 'scratch') {
          const evidence = await extractFromSb3Buffer(buffer, fileName || 'project.sb3');
          evidence.metadata.sourceUrl = url;
          if (inlineText) {
            evidence.extractedText = [evidence.extractedText, `--- Student note ---\n${inlineText}`].filter(Boolean).join('\n\n');
          }
          const status: ExtractionStatus = evidence.scratchData ? 'ok' : 'failed';
          return { evidence, status, error: status === 'failed' ? 'Could not parse Scratch project' : undefined };
        }

        if (ext === '.zip' || submissionType === 'zip') {
          let evidence = await extractFromZipBuffer(buffer, fileName || 'project.zip', submissionType === 'html');
          evidence.metadata.sourceUrl = url;
          evidence = await this.enrichZipWithRenderedPreview(evidence);
          if (inlineText) {
            evidence.extractedText = [evidence.extractedText, `--- Student note ---\n${inlineText}`].filter(Boolean).join('\n\n');
          }
          const hasCode = (evidence.codeFiles?.length ?? 0) > 0 || Boolean(evidence.extractedText?.trim());
          const status: ExtractionStatus = hasCode ? 'ok' : 'partial';
          return {
            evidence,
            status,
            error: status === 'partial' ? 'ZIP did not contain readable code files — review original archive' : undefined,
          };
        }

        const visionMime = mimeTypeForExtension(ext) || (submissionType === 'image' ? 'image/jpeg' : null);
        if (
          visionMime &&
          (['.png', '.jpg', '.jpeg', '.pdf'].includes(ext) || submissionType === 'image')
        ) {
          const evidence = await extractFromVisionBuffer(
            this.config,
            buffer,
            visionMime,
            fileName || `file${ext}`,
            input.lessonObjective || undefined,
          );
          evidence.metadata.sourceUrl = url;
          if (inlineText) {
            evidence.extractedText = [evidence.extractedText, `--- Student note ---\n${inlineText}`].filter(Boolean).join('\n\n');
          }
          const status: ExtractionStatus = evidence.extractedText?.trim() ? 'ok' : 'failed';
          return {
            evidence,
            status,
            error: status === 'failed' ? 'Could not describe image/PDF submission' : undefined,
          };
        }

        const { text } = { text: buffer.toString('utf8') };

        if (['.html', '.htm', '.css', '.js'].includes(ext) || submissionType === 'html') {
          const evidence = extractFromHtmlSources([{ filename: fileName || `file${ext}`, content: text }]);
          evidence.metadata.sourceUrl = url;
          evidence.metadata.fileName = fileName;
          if (inlineText) {
            evidence.extractedText = [evidence.extractedText, `--- Student note ---\n${inlineText}`].filter(Boolean).join('\n\n');
          }
          return { evidence, status: 'ok' };
        }

        if (['.txt', '.md'].includes(ext) || submissionType === 'text') {
          const evidence = extractFromPlainText(text, ext.replace('.', '') || 'text');
          evidence.metadata.sourceUrl = url;
          evidence.metadata.fileName = fileName;
          return { evidence, status: 'ok' };
        }

        // Unsupported binary types in v1 — partial with URL only
        warnings.push(`Extractor for ${ext || 'this file type'} is not implemented yet — tutor must review the original file.`);
        const partial: SubmissionEvidence = {
          extractedText: inlineText || undefined,
          metadata: {
            fileType: ext.replace('.', '') || 'unknown',
            sourceUrl: url,
            fileName,
            validationWarnings: warnings,
          },
        };
        return { evidence: partial, status: inlineText ? 'partial' : 'failed', error: warnings[0] };
      }

      if (inlineText) {
        const evidence = extractFromPlainText(inlineText, submissionType === 'html' ? 'html' : 'text');
        return { evidence, status: 'ok' };
      }

      return {
        evidence: { metadata: { fileType: 'none', validationWarnings: ['No file or text evidence provided'] } },
        status: 'failed',
        error: 'No evidence to extract',
      };
    } catch (e: any) {
      const message = e?.message || 'Evidence extraction failed';
      return {
        evidence: {
          extractedText: inlineText || undefined,
          metadata: {
            fileType: 'error',
            sourceUrl: url || undefined,
            validationWarnings: [message],
          },
        },
        status: inlineText ? 'partial' : 'failed',
        error: message,
      };
    }
  }

  hasVisibleEvidence(evidence: SubmissionEvidence | null | undefined): boolean {
    if (!evidence) return false;
    return Boolean(
      evidence.extractedText?.trim() ||
        (evidence.codeFiles?.length ?? 0) > 0 ||
        (evidence.tables?.length ?? 0) > 0 ||
        evidence.scratchData,
    );
  }

  /** Seed placeholder labels like "[SEED] ZIP demo — …" are not gradeable content. */
  isSeedLabelOnly(text?: string | null): boolean {
    const t = String(text || '').trim();
    if (!t.startsWith('[SEED]')) return false;
    return t.length < 220 && !t.includes('\n\n');
  }

  /** True when cached extraction has substantive content for the submission type. */
  isRichExtractedEvidence(
    evidence: SubmissionEvidence | null | undefined,
    submissionType?: string | null,
  ): boolean {
    if (!evidence || !this.hasVisibleEvidence(evidence)) return false;

    const text = evidence.extractedText?.trim() || '';
    const onlySeedLabel =
      this.isSeedLabelOnly(text) &&
      !(evidence.codeFiles?.length ?? 0) &&
      !(evidence.tables?.length ?? 0) &&
      !evidence.scratchData;
    if (onlySeedLabel) return false;

    const type = String(submissionType || '').toLowerCase();
    switch (type) {
      case 'zip':
      case 'html':
        return (evidence.codeFiles?.length ?? 0) > 0;
      case 'excel':
        return (evidence.tables?.length ?? 0) > 0;
      case 'scratch':
        return Boolean(evidence.scratchData);
      case 'word':
      case 'text':
        return text.length >= 80;
      case 'image':
        return text.length >= 40 || (evidence.images?.length ?? 0) > 0;
      default:
        return true;
    }
  }
}
