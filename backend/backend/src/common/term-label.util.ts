import { BadRequestException } from '@nestjs/common';

export function buildTermLabel(academicYearLabel: string, termOrdinal: number): string {
  const year = String(academicYearLabel || '').trim();
  const ord = Math.floor(Number(termOrdinal));
  if (!year) throw new BadRequestException('Academic year label is required');
  if (![1, 2, 3].includes(ord)) throw new BadRequestException('Term must be 1, 2, or 3');
  return `${year} Term ${ord}`;
}

export function parseTermOrdinalFromLabel(label?: string | null): number | null {
  const m = String(label || '').match(/term\s*(\d)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return [1, 2, 3].includes(n) ? n : null;
}
