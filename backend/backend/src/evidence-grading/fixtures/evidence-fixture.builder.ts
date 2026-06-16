import { JSZip } from '../extractors/load-jszip';
import * as XLSX from 'xlsx';

/** Shared minimal buffers for extractor tests and prisma seed demos. */
export const EvidenceFixtureBuilder = {
  async docx(): Promise<Buffer> {
    const essay = [
      'Introduction to Digital Citizenship',
      '',
      'Digital citizenship means using technology responsibly, safely, and respectfully.',
      'Students should protect personal information and cite sources when researching online.',
      '',
      'Section 1: Online Safety',
      'Always use strong passwords and avoid sharing login details with classmates.',
      'Report cyberbullying to a trusted teacher or school administrator immediately.',
      '',
      'Section 2: Research Skills',
      'Evaluate websites for credibility before using them in assignments.',
      'Combine multiple sources and write summaries in your own words.',
      '',
      'Conclusion',
      'Practising good digital citizenship prepares learners for university, work, and community life.',
      'This document exceeds two hundred words so automated word-count rules can pass in demo seeds.',
    ].join('\n');

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${essay
      .split('\n')
      .map((line) =>
        line
          ? `<w:p><w:r><w:t>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</w:t></w:r></w:p>`
          : '<w:p/>',
      )
      .join('')}
  </w:body>
</w:document>`;

    const zip = new JSZip();
    zip.file(
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    );
    zip.folder('_rels')?.file(
      '.rels',
      `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    );
    zip.folder('word')?.file('document.xml', documentXml);
    return zip.generateAsync({ type: 'nodebuffer' });
  },

  xlsx(): Buffer {
    const rows = [
      ['Item', 'Qty', 'Unit Price', 'Total'],
      ['Notebook', 12, 250, { f: 'B2*C2' }],
      ['Pen pack', 5, 120, { f: 'B3*C3' }],
      ['USB drive', 3, 1800, { f: 'B4*C4' }],
      ['Subtotal', '', '', { f: 'SUM(D2:D4)' }],
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Inventory');
    return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  },

  async sb3(): Promise<Buffer> {
    const project = {
      targets: [
        { isStage: true, name: 'Stage', blocks: {}, sounds: [], variables: {} },
        {
          isStage: false,
          name: 'Cat',
          blocks: {
            evt1: {
              opcode: 'event_whenflagclicked',
              next: 'move1',
              parent: null,
              topLevel: true,
              inputs: {},
              fields: {},
            },
            move1: {
              opcode: 'motion_movesteps',
              next: 'loop1',
              parent: 'evt1',
              topLevel: false,
              inputs: { STEPS: [1, [4, '20']] },
              fields: {},
            },
            loop1: {
              opcode: 'control_repeat',
              next: null,
              parent: 'move1',
              topLevel: false,
              inputs: { TIMES: [1, [6, '3']] },
              fields: {},
            },
          },
          sounds: [{ name: 'pop' }],
          variables: {},
        },
      ],
      meta: { semver: '3.0.0', vm: '0.2.0', agent: 'AdharaEdu seed' },
    };
    const zip = new JSZip();
    zip.file('project.json', JSON.stringify(project));
    return zip.generateAsync({ type: 'nodebuffer' });
  },

  png(): Buffer {
    // 1×1 teal PNG
    return Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
  },

  async zipWebProject(): Promise<Buffer> {
    const zip = new JSZip();
    zip.file(
      'index.html',
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Adhara Club Budget</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header><h1>SS3 Club Budget</h1></header>
  <nav><a href="#items">Items</a></nav>
  <main id="items">
    <p>Total spend: <strong id="total">₦0</strong></p>
    <button id="calc">Calculate</button>
  </main>
  <footer><small>Crown Heights SS3A</small></footer>
  <script src="app.js"></script>
</body>
</html>`,
    );
    zip.file(
      'styles.css',
      `body { margin: 0; font-family: sans-serif; display: flex; flex-direction: column; min-height: 100vh; }
main { flex: 1; padding: 24px; }
nav { background: #0B2048; color: white; padding: 12px; }`,
    );
    zip.file(
      'app.js',
      `document.getElementById('calc').addEventListener('click', function () {
  document.getElementById('total').textContent = '₦4,860';
  this.textContent = 'Recalculated';
});`,
    );
    return zip.generateAsync({ type: 'nodebuffer' });
  },

  longPlainText(): string {
    return [
      'Reflection: My ICT Project',
      'I learned how to structure HTML with semantic tags and link external CSS.',
      'The flex layout helped align the header, navigation, and footer across screen sizes.',
      'JavaScript event listeners made the call-to-action button interactive for users.',
      'Next time I will add form validation and improve colour contrast for accessibility.',
      ' '.repeat(40),
    ].join('\n\n');
  },
};
