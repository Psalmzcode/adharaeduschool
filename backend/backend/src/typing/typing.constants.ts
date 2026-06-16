import { ModuleStackVariant, TrackLevel } from '@prisma/client';

export const FORMAL_TEST_DURATION_SEC = 180;
export const MIN_FORMAL_CHARS = 150;
export const MIN_FORMAL_ACCURACY = 90;
export const PROGRAMME_WPM_TARGET = 25;
/** Track 1 module where touch typing is first taught (Mouse, Keyboard & Windows). */
export const TRACK1_TYPING_MODULE_NUMBER = 2;

export type TypingDrillDef = {
  key: string;
  title: string;
  description: string;
  text: string;
  kind: 'practice' | 'formal_test';
};

export const TYPING_DRILLS: TypingDrillDef[] = [
  {
    key: 'home_row',
    title: 'Home row',
    description: 'Practice asdf jkl; — no timer, focus on accuracy.',
    kind: 'practice',
    text: 'asdf jkl; asdf jkl; fad fad fad fad jkl; jkl; a sad lad asks a dad; flask asks a lad; a lad falls; salad falls; jaf jaf jaf; laks laks laks;',
  },
  {
    key: 'words',
    title: 'Home row words',
    description: 'Short words using home-row keys only.',
    kind: 'practice',
    text: 'a sad lad asks a dad for a flask salad falls fast lad asks dad jaf laks fad fad jkl jkl asdf asdf;',
  },
  {
    key: 'sentences',
    title: 'Drill sentences',
    description: 'Full sentences — build speed while keeping accuracy high.',
    kind: 'practice',
    text:
      'The quick brown fox jumps over the lazy dog. Crown Heights students learn touch typing every week. ' +
      'Practice makes progress when you use the home row keys. Adhara Edu helps schools teach digital skills in the lab.',
  },
  {
    key: 'number_row',
    title: 'Number row',
    description: 'Practice digits 1–0 and simple number patterns — focus on accuracy.',
    kind: 'practice',
    text:
      '1 2 3 4 5 6 7 8 9 0 12 34 56 78 90 2026 15 20 25 90 100 123 456 7890 ' +
      'Room 12 Lab 3 Week 4 Score 88 Percent 95 Student 7 Class 2B 19 20 21 22 23 24 25;',
  },
  {
    key: 'formal',
    title: 'Official 3-minute test',
    description: 'Timed assessment — type as much as you can in 3 minutes with good accuracy.',
    kind: 'formal_test',
    text:
      'Technology education begins with confident keyboard skills. Students at Crown Heights Secondary School practice touch typing ' +
      'to reach the programme target of twenty-five words per minute with at least ninety percent accuracy. ' +
      'The home row keys are a s d f and j k l semicolon. Keep your fingers curved and return to home row after every key. ' +
      'File Explorer helps you organise school projects in folders. Microsoft Word and Excel will be easier when you type without looking at the keyboard. ' +
      'Safe shutdown saves your work and protects the computer lab equipment. Shortcuts like copy paste undo and save time during assignments. ' +
      'Every lesson builds toward the module practical and the computer based test at the end of the module. ' +
      'Keep breathing stay calm and focus on accuracy before speed during this official three minute typing test.',
  },
];

export function drillByKey(key: string): TypingDrillDef | undefined {
  return TYPING_DRILLS.find((d) => d.key === key);
}

export type TypingMetricsInput = {
  typed: string;
  source: string;
  elapsedSec: number;
};

export type TypingMetrics = {
  wpm: number;
  accuracy: number;
  correctChars: number;
  errorCount: number;
  durationSec: number;
  isValidScore: boolean;
};

/** Standard WPM from correct characters; accuracy from char-by-char comparison. */
export function computeTypingMetrics(input: TypingMetricsInput, kind: 'practice' | 'formal_test'): TypingMetrics {
  const typed = input.typed;
  const source = input.source;
  const durationSec = Math.max(1, Math.round(input.elapsedSec));

  let correctChars = 0;
  let errorCount = 0;
  const len = typed.length;
  const srcLen = Math.max(1, source.length);
  for (let i = 0; i < len; i++) {
    if (typed[i] === source[i % srcLen]) correctChars += 1;
    else errorCount += 1;
  }

  const accuracy = len > 0 ? Math.round((correctChars / len) * 1000) / 10 : 0;
  const minutes = durationSec / 60;
  const wpm = Math.round(correctChars / 5 / minutes);

  let isValidScore = true;
  if (kind === 'formal_test') {
    isValidScore = correctChars >= MIN_FORMAL_CHARS && accuracy >= MIN_FORMAL_ACCURACY;
  }

  return {
    wpm,
    accuracy,
    correctChars,
    errorCount,
    durationSec,
    isValidScore,
  };
}

/** Canonical Track 1 module row that anchors typing attempts (Module 2). */
export function isTrack1TypingAnchorModule(
  module: { number?: number; title?: string; track?: string } | null | undefined,
): boolean {
  if (!module) return false;
  if (String(module.track || '') !== TrackLevel.TRACK_1) return false;
  return Number(module.number) === TRACK1_TYPING_MODULE_NUMBER;
}

/** @deprecated Use isTrack1TypingAnchorModule — Module 2 is not typing-only. */
export function isTypingModule(
  module: { number?: number; title?: string; track?: string } | null | undefined,
): boolean {
  return isTrack1TypingAnchorModule(module);
}

export function moduleProgressUnlocksTypingLab(status: string | null | undefined): boolean {
  if (!status) return false;
  return status !== 'LOCKED';
}
