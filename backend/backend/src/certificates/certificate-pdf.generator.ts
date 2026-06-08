import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import {
  CertificateTrackArt,
  certificateGrade,
  formatCertDate,
} from './certificate-track-art';

(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || pdfFonts;

export interface CertificatePdfInput {
  studentName: string;
  regNumber: string;
  schoolName: string;
  trackLabel: string;
  averageScore: number;
  serialNumber: string;
  issueDate: Date;
  qrDataUrl: string;
  verifyUrl: string;
  art: CertificateTrackArt;
}

function pdfBuffer(docDefinition: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = (pdfMake as any).createPdf(docDefinition);
    doc.getBuffer((buf: Buffer) => resolve(buf), reject);
  });
}

function buildSidebarPdf(data: CertificatePdfInput): any {
  const grade = certificateGrade(data.averageScore);
  const issued = formatCertDate(data.issueDate);
  const year = String(data.issueDate.getFullYear());
  const { navy, accent, gold } = data.art;

  return {
    pageOrientation: 'landscape',
    pageSize: 'A4',
    pageMargins: [0, 0, 0, 0],
    defaultStyle: { font: 'Helvetica' },
    content: [
      {
        columns: [
          {
            width: 200,
            stack: [
              {
                canvas: [{ type: 'rect', x: 0, y: 0, w: 200, h: 595, color: navy }],
                margin: [0, 0, 0, -595],
              },
              { text: 'ADHARAEDU', fontSize: 11, bold: true, color: '#FFFFFF', alignment: 'center', margin: [16, 36, 16, 4], characterSpacing: 1.2 },
              { text: 'SCHOOLS', fontSize: 11, bold: true, color: '#FFFFFF', alignment: 'center', margin: [16, 0, 16, 8] },
              {
                canvas: [{ type: 'line', x1: 70, y1: 0, x2: 130, y2: 0, lineWidth: 1, lineColor: gold }],
                margin: [0, 4, 0, 8],
              },
              {
                text: 'Structured tech education for secondary schools · Nigeria',
                fontSize: 8,
                color: 'rgba(255,255,255,0.35)',
                alignment: 'center',
                margin: [18, 0, 18, 24],
              },
              { text: 'OFFICIAL SEAL', fontSize: 7, color: 'rgba(255,255,255,0.25)', alignment: 'center', margin: [16, 80, 16, 6], characterSpacing: 2 },
              {
                canvas: [
                  { type: 'ellipse', x: 100, y: 40, r1: 36, r2: 36, lineColor: 'rgba(201,150,58,0.4)', lineWidth: 1 },
                  { type: 'ellipse', x: 100, y: 40, r1: 28, r2: 28, lineColor: 'rgba(30,127,212,0.35)', lineWidth: 0.6 },
                ],
                margin: [0, 0, 0, 90],
              },
              { text: 'DATE ISSUED', fontSize: 7, color: 'rgba(255,255,255,0.22)', alignment: 'center', margin: [16, 0, 16, 2], characterSpacing: 2 },
              { text: issued, fontSize: 10, bold: true, color: 'rgba(255,255,255,0.55)', alignment: 'center', margin: [16, 0, 16, 14] },
              { text: 'PROGRAMME', fontSize: 7, color: 'rgba(255,255,255,0.22)', alignment: 'center', margin: [16, 0, 16, 2], characterSpacing: 2 },
              { text: `${data.trackLabel.split('—')[0].trim()} · ${year}`, fontSize: 9, bold: true, color: 'rgba(255,255,255,0.55)', alignment: 'center', margin: [16, 0, 16, 14] },
              { text: 'CREDENTIAL ID', fontSize: 7, color: 'rgba(255,255,255,0.22)', alignment: 'center', margin: [16, 0, 16, 2], characterSpacing: 2 },
              { text: data.serialNumber, fontSize: 8, bold: true, color: 'rgba(255,255,255,0.55)', alignment: 'center', margin: [16, 0, 16, 0] },
            ],
          },
          {
            width: 4,
            canvas: [{ type: 'rect', x: 0, y: 0, w: 4, h: 595, color: gold }],
          },
          {
            width: '*',
            stack: [
              {
                canvas: [{ type: 'rect', x: 0, y: 0, w: 637, h: 4, color: accent }],
                margin: [0, 0, 0, 0],
              },
              { text: 'OFFICIAL CREDENTIAL · ADHARAEDU', fontSize: 8, color: accent, bold: true, margin: [40, 28, 40, 4], characterSpacing: 2.5 },
              { text: 'Certificate of Completion', fontSize: 34, bold: true, color: navy, margin: [40, 0, 40, 6] },
              {
                canvas: [{ type: 'rect', x: 40, y: 0, w: 48, h: 3, color: gold }],
                margin: [0, 0, 0, 18],
              },
              { text: 'This is to certify that', fontSize: 12, color: '#8FA3B8', margin: [40, 0, 40, 6] },
              { text: data.studentName, fontSize: 38, bold: true, color: navy, margin: [40, 0, 40, 4] },
              { text: `REG. ${data.regNumber}`, fontSize: 9, color: '#8FA3B8', margin: [40, 0, 40, 18], characterSpacing: 1.5 },
              {
                table: {
                  widths: ['*'],
                  body: [[{
                    fillColor: '#F7F9FC',
                    border: [false, false, false, true],
                    borderColor: [accent, accent, accent, accent],
                    stack: [
                      { text: 'PROGRAMME COMPLETED', fontSize: 7, color: '#8FA3B8', margin: [14, 10, 14, 4], characterSpacing: 2 },
                      { text: data.trackLabel, fontSize: 14, bold: true, color: navy, margin: [14, 0, 14, 4] },
                      { text: data.schoolName, fontSize: 12, color: '#4A6070', margin: [14, 0, 14, 12] },
                    ],
                  }]],
                },
                layout: { hLineWidth: () => 0, vLineWidth: () => 0 },
                margin: [40, 0, 40, 16],
              },
              {
                columns: [
                  { width: 'auto', stack: [{ text: 'GRADE', fontSize: 7, color: '#8FA3B8', margin: [0, 0, 0, 2] }, { text: grade, fontSize: 14, bold: true, color: gold }] },
                  { width: 'auto', stack: [{ text: 'AVERAGE SCORE', fontSize: 7, color: '#8FA3B8', margin: [0, 0, 0, 2] }, { text: `${data.averageScore}%`, fontSize: 14, bold: true, color: navy }] },
                  { width: 'auto', stack: [{ text: 'YEAR', fontSize: 7, color: '#8FA3B8', margin: [0, 0, 0, 2] }, { text: year, fontSize: 14, bold: true, color: navy }] },
                ],
                columnGap: 24,
                margin: [40, 0, 40, 28],
              },
              {
                canvas: [{ type: 'line', x1: 40, y1: 0, x2: 597, y2: 0, lineWidth: 0.5, lineColor: '#DDE4EE' }],
                margin: [0, 0, 0, 16],
              },
              {
                columns: [
                  {
                    width: '*',
                    stack: [
                      { text: 'A. S. Chidera', fontSize: 22, italics: true, color: navy, margin: [40, 0, 0, 4] },
                      { canvas: [{ type: 'line', x1: 40, y1: 0, x2: 180, y2: 0, lineWidth: 0.5, lineColor: 'rgba(30,127,212,0.25)' }], margin: [0, 0, 0, 6] },
                      { text: 'ALI SAMUEL CHIDERA', fontSize: 8, bold: true, color: '#4A6070', margin: [40, 0, 0, 2], characterSpacing: 1 },
                      { text: 'Founder & Chief Learning Officer, AdharaEdu', fontSize: 10, italics: true, color: '#8FA3B8', margin: [40, 0, 0, 0] },
                    ],
                  },
                  {
                    width: 200,
                    stack: [
                      { text: 'SERIAL NUMBER', fontSize: 7, color: '#8FA3B8', alignment: 'right', characterSpacing: 2 },
                      { text: data.serialNumber, fontSize: 9, font: 'Courier', alignment: 'right', margin: [0, 2, 40, 6] },
                      { text: 'VERIFY AT', fontSize: 7, color: '#8FA3B8', alignment: 'right', characterSpacing: 2, margin: [0, 4, 40, 2] },
                      { text: data.verifyUrl.replace(/^https?:\/\//, ''), fontSize: 7, color: accent, alignment: 'right', margin: [0, 0, 40, 0] },
                      { image: data.qrDataUrl, width: 72, height: 72, alignment: 'right', margin: [0, 8, 40, 0] },
                    ],
                  },
                ],
              },
            ],
            margin: [0, 0, 0, 0],
          },
        ],
      },
    ],
  };
}

function buildClassicPdf(data: CertificatePdfInput): any {
  const grade = certificateGrade(data.averageScore);
  const issued = formatCertDate(data.issueDate);
  const { navy, accent, gold } = data.art;

  return {
    pageOrientation: 'landscape',
    pageSize: 'A4',
    pageMargins: [48, 40, 48, 40],
    defaultStyle: { font: 'Helvetica' },
    background: [
      {
        canvas: [
          { type: 'rect', x: 0, y: 0, w: 841, h: 595, color: '#FFFFFF' },
          { type: 'rect', x: 0, y: 0, w: 841, h: 7, color: navy },
          { type: 'line', x1: 0, y1: 7, x2: 841, y2: 7, lineWidth: 2, lineColor: gold },
          { type: 'rect', x: 0, y: 588, w: 841, h: 7, color: navy },
          { type: 'line', x1: 0, y1: 588, x2: 841, y2: 588, lineWidth: 2, lineColor: gold },
          { type: 'rect', x: 16, y: 16, w: 809, h: 563, lineColor: 'rgba(201,150,58,0.22)', lineWidth: 0.75 },
        ],
      },
    ],
    content: [
      {
        columns: [
          {
            width: 52,
            stack: [
              {
                canvas: [{ type: 'rect', x: 0, y: 0, w: 52, h: 52, color: navy, r: 8 }],
              },
            ],
          },
          {
            width: '*',
            stack: [
              { text: 'AdharaEdu Schools', fontSize: 16, bold: true, color: navy, margin: [12, 8, 0, 2] },
              { text: 'Structured tech education for secondary schools · Nigeria', fontSize: 9, color: '#94A3B8', margin: [12, 0, 0, 0] },
            ],
          },
        ],
        margin: [0, 8, 0, 12],
      },
      {
        canvas: [{ type: 'line', x1: 120, y1: 0, x2: 720, y2: 0, lineWidth: 0.75, lineColor: gold }],
        margin: [0, 0, 0, 10],
      },
      { text: 'OFFICIAL CREDENTIAL', fontSize: 8, bold: true, color: accent, alignment: 'center', characterSpacing: 3, margin: [0, 0, 0, 4] },
      { text: 'CERTIFICATE OF', fontSize: 9, color: gold, alignment: 'center', characterSpacing: 3, margin: [0, 0, 0, 2] },
      { text: 'COMPLETION', fontSize: 32, bold: true, color: navy, alignment: 'center', characterSpacing: 2, margin: [0, 0, 0, 14] },
      {
        canvas: [{ type: 'line', x1: 280, y1: 0, x2: 560, y2: 0, lineWidth: 0.75, lineColor: '#E2E8F0' }],
        margin: [0, 0, 0, 12],
      },
      { text: 'This is to certify that', fontSize: 14, italics: true, color: '#546070', alignment: 'center', margin: [0, 0, 0, 6] },
      { text: data.studentName, fontSize: 42, bold: true, color: navy, alignment: 'center', margin: [0, 0, 0, 4] },
      { text: `REG. ${data.regNumber}`, fontSize: 9, color: '#94A3B8', alignment: 'center', characterSpacing: 2, margin: [0, 0, 0, 12] },
      { text: 'has successfully completed the', fontSize: 13, color: '#546070', alignment: 'center', margin: [0, 0, 0, 4] },
      { text: data.trackLabel, fontSize: 15, bold: true, color: navy, alignment: 'center', margin: [0, 0, 0, 4] },
      { text: `programme at ${data.schoolName}`, fontSize: 13, color: '#546070', alignment: 'center', margin: [0, 0, 0, 16] },
      {
        columns: [
          {
            width: '*',
            table: {
              widths: ['*', '*', '*'],
              body: [[
                { text: `GRADE\n${grade}`, fontSize: 10, alignment: 'center', fillColor: '#F2F4F7', margin: [0, 10, 0, 10] },
                { text: `AVERAGE SCORE\n${data.averageScore}%`, fontSize: 10, alignment: 'center', fillColor: '#F2F4F7', margin: [0, 10, 0, 10] },
                { text: `ISSUED\n${issued}`, fontSize: 10, alignment: 'center', fillColor: '#F2F4F7', margin: [0, 10, 0, 10] },
              ]],
            },
            layout: 'noBorders',
          },
        ],
        margin: [80, 0, 80, 18],
      },
      {
        columns: [
          {
            width: 100,
            stack: [
              { text: 'VERIFY', fontSize: 7, color: '#94A3B8', alignment: 'center', margin: [0, 0, 0, 4] },
              { image: data.qrDataUrl, width: 82, height: 82, alignment: 'center' },
            ],
          },
          {
            width: '*',
            stack: [
              { text: 'A. S. Chidera', fontSize: 20, italics: true, color: navy, alignment: 'center', margin: [0, 20, 0, 4] },
              { canvas: [{ type: 'line', x1: 80, y1: 0, x2: 220, y2: 0, lineWidth: 0.5, lineColor: 'rgba(30,127,212,0.25)' }], margin: [0, 0, 0, 6] },
              { text: 'ALI SAMUEL CHIDERA', fontSize: 8, bold: true, color: '#546070', alignment: 'center' },
              { text: 'Founder & Chief Learning Officer · AdharaEdu', fontSize: 10, italics: true, color: '#94A3B8', alignment: 'center' },
            ],
          },
          {
            width: 220,
            stack: [
              { text: `Date issued: ${issued}`, fontSize: 8, color: '#94A3B8', alignment: 'right' },
              { text: data.serialNumber, fontSize: 9, font: 'Courier', bold: true, color: '#546070', alignment: 'right', margin: [0, 6, 0, 0] },
              { text: data.verifyUrl.replace(/^https?:\/\//, ''), fontSize: 7, color: accent, alignment: 'right', margin: [0, 6, 0, 0] },
            ],
          },
        ],
        columnGap: 12,
      },
    ],
  };
}

export async function generateCertificatePdf(data: CertificatePdfInput): Promise<Buffer> {
  const doc =
    data.art.template === 'SIDEBAR' ? buildSidebarPdf(data) : buildClassicPdf(data);
  return pdfBuffer(doc);
}
