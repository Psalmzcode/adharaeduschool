import { BadRequestException, Injectable } from '@nestjs/common';

const DEFAULT_ALLOWED = ['.html', '.htm', '.css', '.js', '.txt', '.md', '.docx', '.xlsx', '.png', '.jpg', '.jpeg', '.pdf', '.zip', '.sb3'];

@Injectable()
export class UploadValidationService {
  extensionFromUrl(url: string): string {
    try {
      const path = new URL(url).pathname.toLowerCase();
      const dot = path.lastIndexOf('.');
      if (dot === -1) return '';
      return path.slice(dot);
    } catch {
      const lower = String(url || '').toLowerCase();
      const dot = lower.lastIndexOf('.');
      return dot === -1 ? '' : lower.slice(dot).split('?')[0];
    }
  }

  validateUrl(opts: {
    url?: string | null;
    allowedExtensions?: string[] | null;
    maxSizeMB?: number | null;
    submissionType?: string | null;
  }): { ok: true; extension: string } | { ok: false; message: string } {
    const url = String(opts.url || '').trim();
    if (!url) return { ok: true, extension: '' };

    const ext = this.extensionFromUrl(url);
    const allowed = (opts.allowedExtensions?.length ? opts.allowedExtensions : DEFAULT_ALLOWED).map((e) =>
      e.startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`,
    );

    if (ext && !allowed.includes(ext)) {
      return {
        ok: false,
        message: `File type not accepted (${ext || 'unknown'}). Allowed: ${allowed.join(', ')}`,
      };
    }

    if (ext === '.doc') {
      return { ok: false, message: 'Legacy .doc files are not supported — save as .docx and resubmit.' };
    }

    return { ok: true, extension: ext };
  }

  async validateFetchSize(url: string, maxSizeMB = 10): Promise<void> {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      const len = res.headers.get('content-length');
      if (len) {
        const mb = Number(len) / (1024 * 1024);
        if (mb > maxSizeMB) {
          throw new BadRequestException(`File exceeds ${maxSizeMB}MB limit (${mb.toFixed(1)}MB).`);
        }
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      // HEAD may fail on some CDNs — continue; size checked after download
    }
  }

  assertValidOrThrow(opts: Parameters<UploadValidationService['validateUrl']>[0]) {
    const result = this.validateUrl(opts);
    if (!result.ok) throw new BadRequestException((result as { ok: false; message: string }).message);
    return result;
  }
}
