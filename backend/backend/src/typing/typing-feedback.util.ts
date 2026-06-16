import { PROGRAMME_WPM_TARGET, TYPING_DRILLS, drillByKey } from './typing.constants';

export type TypingErrorProfile = {
  numberErrors: number;
  letterErrors: number;
  punctuationErrors: number;
  spaceErrors: number;
  otherErrors: number;
};

export type TypingFeedbackPayload = {
  headline: string;
  paragraphs: string[];
  suggestion: string;
  suggestedDrillKey: string | null;
  source: 'ai' | 'rule';
};

export function analyzeTypingErrorProfile(typed: string, source: string): TypingErrorProfile {
  const srcLen = Math.max(1, source.length);
  const profile: TypingErrorProfile = {
    numberErrors: 0,
    letterErrors: 0,
    punctuationErrors: 0,
    spaceErrors: 0,
    otherErrors: 0,
  };

  for (let i = 0; i < typed.length; i++) {
    if (typed[i] === source[i % srcLen]) continue;
    const expected = source[i % srcLen];
    if (/\d/.test(expected)) profile.numberErrors += 1;
    else if (expected === ' ') profile.spaceErrors += 1;
    else if (/[a-zA-Z]/.test(expected)) profile.letterErrors += 1;
    else if (/[^\w\s]/.test(expected)) profile.otherErrors += 1;
    else profile.otherErrors += 1;
  }

  return profile;
}

export function mergeErrorProfiles(profiles: TypingErrorProfile[]): TypingErrorProfile {
  return profiles.reduce(
    (acc, p) => ({
      numberErrors: acc.numberErrors + p.numberErrors,
      letterErrors: acc.letterErrors + p.letterErrors,
      punctuationErrors: acc.punctuationErrors + p.punctuationErrors,
      spaceErrors: acc.spaceErrors + p.spaceErrors,
      otherErrors: acc.otherErrors + p.otherErrors,
    }),
    { numberErrors: 0, letterErrors: 0, punctuationErrors: 0, spaceErrors: 0, otherErrors: 0 },
  );
}

export function parseErrorProfile(raw: unknown): TypingErrorProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const num = (k: keyof TypingErrorProfile) => Math.max(0, Math.floor(Number(o[k]) || 0));
  return {
    numberErrors: num('numberErrors'),
    letterErrors: num('letterErrors'),
    punctuationErrors: num('punctuationErrors'),
    spaceErrors: num('spaceErrors'),
    otherErrors: num('otherErrors'),
  };
}

export type TypingFeedbackContext = {
  firstName: string;
  programmeWpmTarget: number;
  practiceSessionsThisWeek: number;
  thisWeekBestWpm: number | null;
  lastWeekBestWpm: number | null;
  thisWeekAvgAccuracy: number | null;
  errorProfile: TypingErrorProfile;
  weakestDrillKey: string | null;
  weakestDrillAccuracy: number | null;
  neverTriedDrillKeys: string[];
  recentDrillKeys: string[];
};

function dominantErrorCategory(profile: TypingErrorProfile): keyof TypingErrorProfile | null {
  const entries = Object.entries(profile) as [keyof TypingErrorProfile, number][];
  const total = entries.reduce((s, [, n]) => s + n, 0);
  if (total === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][1] > 0 ? entries[0][0] : null;
}

function categoryLabel(key: keyof TypingErrorProfile): string {
  switch (key) {
    case 'numberErrors':
      return 'typing numbers';
    case 'punctuationErrors':
      return 'punctuation';
    case 'spaceErrors':
      return 'spacing';
    case 'letterErrors':
      return 'letter accuracy';
    default:
      return 'keyboard accuracy';
  }
}

function sanitizeDrillKey(key: string | null | undefined): string | null {
  if (!key) return null;
  return drillByKey(key) ? key : null;
}

export function buildRuleBasedTypingFeedback(ctx: TypingFeedbackContext): TypingFeedbackPayload {
  const paragraphs: string[] = [];
  let headline = 'Keep practising!';
  let suggestion = 'Try a short practice drill, then check your accuracy before pushing for speed.';
  let suggestedDrillKey: string | null = 'home_row';

  const thisWpm = ctx.thisWeekBestWpm;
  const lastWpm = ctx.lastWeekBestWpm;

  if (thisWpm != null && lastWpm != null && thisWpm > lastWpm) {
    headline = 'Great improvement!';
    paragraphs.push(`You increased from ${lastWpm} WPM to ${thisWpm} WPM this week.`);
  } else if (thisWpm != null && lastWpm != null && thisWpm === lastWpm) {
    paragraphs.push(`You held steady at ${thisWpm} WPM this week — push for a new personal best.`);
  } else if (thisWpm != null) {
    paragraphs.push(`Your best speed this week is ${thisWpm} WPM.`);
    if (thisWpm < ctx.programmeWpmTarget) {
      paragraphs.push(`The programme target is ${ctx.programmeWpmTarget} WPM with strong accuracy.`);
    }
  } else {
    paragraphs.push('Complete a practice session to start tracking your weekly progress.');
  }

  if (ctx.thisWeekAvgAccuracy != null && ctx.thisWeekAvgAccuracy < 90) {
    paragraphs.push(`Average accuracy this week is ${Math.round(ctx.thisWeekAvgAccuracy)}% — slow down slightly to reduce mistakes.`);
  }

  const dominant = dominantErrorCategory(ctx.errorProfile);
  if (dominant === 'numberErrors' || ctx.neverTriedDrillKeys.includes('number_row')) {
    if (dominant === 'numberErrors') {
      paragraphs.push('Your biggest challenge is accuracy when typing numbers.');
    } else if (!ctx.recentDrillKeys.includes('number_row')) {
      paragraphs.push('You have not practised the number row yet this week.');
    }
    suggestion = 'Spend another 5 minutes practicing the number row.';
    suggestedDrillKey = 'number_row';
  } else if (dominant === 'punctuationErrors') {
    paragraphs.push('Your biggest challenge is punctuation — commas and full stops need careful fingers.');
    suggestion = 'Practice the sentences drill and pause briefly at each punctuation mark.';
    suggestedDrillKey = 'sentences';
  } else if (ctx.weakestDrillKey && ctx.weakestDrillAccuracy != null && ctx.weakestDrillAccuracy < 92) {
    const drill = drillByKey(ctx.weakestDrillKey);
    paragraphs.push(
      `${drill?.title || ctx.weakestDrillKey} is your weakest drill at ${Math.round(ctx.weakestDrillAccuracy)}% accuracy.`,
    );
    suggestion = `Repeat the ${drill?.title || 'practice'} drill for five minutes before your next timed test.`;
    suggestedDrillKey = ctx.weakestDrillKey;
  } else if (ctx.practiceSessionsThisWeek < 3) {
    suggestion = 'Aim for at least three short practice sessions this week to build muscle memory.';
    suggestedDrillKey = ctx.neverTriedDrillKeys[0] || 'words';
  } else {
    headline = thisWpm != null && thisWpm >= ctx.programmeWpmTarget ? 'Strong progress!' : headline;
    suggestion = 'Mix home-row practice with the official 3-minute test when you feel ready.';
    suggestedDrillKey = 'sentences';
  }

  return {
    headline,
    paragraphs,
    suggestion,
    suggestedDrillKey: sanitizeDrillKey(suggestedDrillKey),
    source: 'rule',
  };
}

export function buildTypingFeedbackGeminiPrompt(ctx: TypingFeedbackContext): string {
  const drillList = TYPING_DRILLS.map((d) => d.key).join(', ');
  return `You are a supportive typing coach for Nigerian secondary school students on AdharaEdu Track 1.

Write brief, encouraging coaching feedback in JSON only:
{
  "headline": "short positive title",
  "paragraphs": ["1-2 sentences each", "max 2 items"],
  "suggestion": "one concrete next step",
  "suggestedDrillKey": "one of: ${drillList}"
}

Rules:
- Use the student's first name once if natural.
- Mention WPM change only if both this week and last week WPM are provided.
- If number errors dominate, mention number-row practice.
- Keep total under 80 words. Plain English. No markdown.

Student context (JSON):
${JSON.stringify({
  firstName: ctx.firstName,
  programmeWpmTarget: ctx.programmeWpmTarget,
  practiceSessionsThisWeek: ctx.practiceSessionsThisWeek,
  thisWeekBestWpm: ctx.thisWeekBestWpm,
  lastWeekBestWpm: ctx.lastWeekBestWpm,
  thisWeekAvgAccuracy: ctx.thisWeekAvgAccuracy,
  errorProfile: ctx.errorProfile,
  weakestDrillKey: ctx.weakestDrillKey,
  weakestDrillAccuracy: ctx.weakestDrillAccuracy,
  neverTriedDrillKeys: ctx.neverTriedDrillKeys,
})}`;
}

export function parseTypingFeedbackJson(raw: string): TypingFeedbackPayload | null {
  try {
    const o = JSON.parse(raw);
    const headline = String(o?.headline || '').trim();
    const paragraphs = Array.isArray(o?.paragraphs)
      ? o.paragraphs.map((p: unknown) => String(p || '').trim()).filter(Boolean).slice(0, 3)
      : [];
    const suggestion = String(o?.suggestion || '').trim();
    const suggestedDrillKey = sanitizeDrillKey(String(o?.suggestedDrillKey || '').trim());
    if (!headline || !suggestion) return null;
    return { headline, paragraphs, suggestion, suggestedDrillKey, source: 'ai' };
  } catch {
    return null;
  }
}
