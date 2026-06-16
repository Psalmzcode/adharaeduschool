import {
  analyzeTypingErrorProfile,
  buildRuleBasedTypingFeedback,
  mergeErrorProfiles,
} from './typing-feedback.util';

describe('typing-feedback.util', () => {
  it('counts number errors separately from letters', () => {
    const profile = analyzeTypingErrorProfile('abc123', 'abc456');
    expect(profile.numberErrors).toBe(3);
    expect(profile.letterErrors).toBe(0);
  });

  it('builds improvement headline when WPM rises', () => {
    const fb = buildRuleBasedTypingFeedback({
      firstName: 'Ada',
      programmeWpmTarget: 25,
      practiceSessionsThisWeek: 4,
      thisWeekBestWpm: 20,
      lastWeekBestWpm: 15,
      thisWeekAvgAccuracy: 88,
      errorProfile: mergeErrorProfiles([]),
      weakestDrillKey: null,
      weakestDrillAccuracy: null,
      neverTriedDrillKeys: [],
      recentDrillKeys: ['words'],
    });
    expect(fb.headline).toBe('Great improvement!');
    expect(fb.paragraphs.join(' ')).toContain('15 WPM');
    expect(fb.paragraphs.join(' ')).toContain('20 WPM');
  });

  it('suggests number row when number errors dominate', () => {
    const fb = buildRuleBasedTypingFeedback({
      firstName: 'Ada',
      programmeWpmTarget: 25,
      practiceSessionsThisWeek: 2,
      thisWeekBestWpm: 18,
      lastWeekBestWpm: 16,
      thisWeekAvgAccuracy: 85,
      errorProfile: { numberErrors: 8, letterErrors: 2, punctuationErrors: 0, spaceErrors: 1, otherErrors: 0 },
      weakestDrillKey: 'words',
      weakestDrillAccuracy: 80,
      neverTriedDrillKeys: [],
      recentDrillKeys: ['words'],
    });
    expect(fb.suggestedDrillKey).toBe('number_row');
    expect(fb.paragraphs.join(' ')).toMatch(/numbers/i);
  });
});
