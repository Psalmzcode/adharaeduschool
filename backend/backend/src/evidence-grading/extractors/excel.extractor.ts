import * as XLSX from 'xlsx';
import { SubmissionEvidence } from '../types/submission-evidence.types';

const MAX_ROWS_PER_SHEET = 50;
const MAX_COLS = 20;

function cellRef(col: number, row: number): string {
  return XLSX.utils.encode_cell({ c: col, r: row });
}

export function extractFromXlsxBuffer(buffer: Buffer, fileName = 'workbook.xlsx'): SubmissionEvidence {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellFormula: true, cellDates: true });
  const sheetNames = workbook.SheetNames || [];

  if (!sheetNames.length) {
    return {
      metadata: {
        fileType: 'xlsx',
        fileName,
        validationWarnings: ['Workbook has no sheets'],
      },
    };
  }

  const tables: NonNullable<SubmissionEvidence['tables']> = [];
  const summaryParts: string[] = [];

  for (const sheetName of sheetNames.slice(0, 6)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    const rowCount = range.e.r - range.s.r + 1;
    const colCount = range.e.c - range.s.c + 1;

    const rows: unknown[][] = [];
    const formulas: { cell: string; formula: string }[] = [];
    const headers: string[] = [];

    for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + MAX_ROWS_PER_SHEET); r++) {
      const row: unknown[] = [];
      for (let c = range.s.c; c <= Math.min(range.e.c, range.s.c + MAX_COLS - 1); c++) {
        const ref = cellRef(c, r);
        const cell = sheet[ref];
        if (!cell) {
          row.push('');
          continue;
        }
        if (cell.f) {
          formulas.push({ cell: ref, formula: String(cell.f) });
        }
        row.push(cell.w ?? cell.v ?? '');
      }
      rows.push(row);
      if (r === range.s.r) {
        headers.push(...row.map((v) => String(v ?? '').trim()));
      }
    }

    tables.push({
      sheetName,
      headers,
      rows: rows.slice(1),
      formulas: formulas.slice(0, 40),
    });

    summaryParts.push(
      `Sheet "${sheetName}": ${rowCount} rows × ${colCount} cols` +
        (formulas.length ? `, ${formulas.length} formula(s)` : ''),
    );
  }

  const extractedText = [
    `Spreadsheet summary: ${sheetNames.length} sheet(s)`,
    summaryParts.join('\n'),
    ...tables.map((t) => {
      const preview = [t.headers.join('\t'), ...t.rows.slice(0, 12).map((r) => r.map((v) => String(v ?? '')).join('\t'))].join('\n');
      return `--- ${t.sheetName} ---\n${preview}`;
    }),
    tables.some((t) => t.formulas.length)
      ? `Formulas:\n${tables.flatMap((t) => t.formulas.map((f) => `${t.sheetName}!${f.cell}: ${f.formula}`)).slice(0, 30).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 20000);

  return {
    extractedText,
    tables,
    metadata: {
      fileType: 'xlsx',
      fileName,
      sheets: sheetNames.length,
    },
  };
}
