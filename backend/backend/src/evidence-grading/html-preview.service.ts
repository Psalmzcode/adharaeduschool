import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type CodeFile = { filename: string; language: string; content: string };

@Injectable()
export class HtmlPreviewService {
  private readonly logger = new Logger(HtmlPreviewService.name);

  constructor(private config: ConfigService) {}

  isEnabled(): boolean {
    return String(this.config.get('ENABLE_HTML_PREVIEW') || '').trim() === '1';
  }

  private pickMainHtml(files: CodeFile[]): string | null {
    const htmlFiles = files.filter((f) => /\.html?$/i.test(f.filename) || f.language === 'html');
    if (!htmlFiles.length) return null;
    const preferred = htmlFiles.find((f) => /index\.html?$/i.test(f.filename)) || htmlFiles[0];
    return preferred.content;
  }

  private relatedAsset(files: CodeFile[], ext: string): string {
    return files.find((f) => f.filename.toLowerCase().endsWith(ext))?.content || '';
  }

  /** Render extracted HTML/CSS/JS and return visible on-screen text (optional Puppeteer). */
  async captureVisibleText(files: CodeFile[]): Promise<string | null> {
    if (!this.isEnabled() || !files.length) return null;

    const html = this.pickMainHtml(files);
    if (!html) return null;

    const css = this.relatedAsset(files, '.css');
    const js = this.relatedAsset(files, '.js');

    const pageHtml = [
      '<!DOCTYPE html><html><head><meta charset="utf-8">',
      css ? `<style>${css}</style>` : '',
      '</head><body>',
      html.replace(/<script[\s\S]*?<\/script>/gi, ''),
      js ? `<script>${js}<\/script>` : '',
      '</body></html>',
    ].join('');

    try {
      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 900, height: 700 });
        await page.setContent(pageHtml, { waitUntil: 'load', timeout: 15000 });
        await new Promise((r) => setTimeout(r, 300));
        const visible = await page.evaluate(() => {
          const body = document.body;
          return body ? body.innerText.replace(/\s+/g, ' ').trim() : '';
        });
        return visible ? visible.slice(0, 4000) : null;
      } finally {
        await browser.close();
      }
    } catch (e: any) {
      this.logger.warn(`HTML preview skipped: ${e?.message || e}`);
      return null;
    }
  }
}
