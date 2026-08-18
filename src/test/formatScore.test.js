import { describe, it, expect } from 'vitest';
import { formatScore, formatScoreGap, SCORE_DECIMALS } from '../assets/javascript/formatScore.js';

describe('formatScore', () => {
  it('always shows two decimals, padding a round number out', () => {
    expect(formatScore(8)).toBe('8.00');
    expect(formatScore(8.5)).toBe('8.50');
    expect(formatScore(10)).toBe('10.00');
  });

  it('keeps the second decimal that one-decimal rounding threw away', () => {
    // The actual point of the bug report: these two are different films and
    // used to render identically as "8.4".
    expect(formatScore(8.44)).toBe('8.44');
    expect(formatScore(8.35)).toBe('8.35');
    expect(formatScore(8.44)).not.toBe(formatScore(8.35));
  });

  it('rounds rather than truncates at the second decimal', () => {
    expect(formatScore(8.4372)).toBe('8.44');
    expect(formatScore(8.4319)).toBe('8.43');
  });

  it('takes the fallback for anything that is not a number', () => {
    expect(formatScore(null)).toBe('—');
    expect(formatScore(undefined)).toBe('—');
    expect(formatScore(NaN)).toBe('—');
    expect(formatScore('not a score')).toBe('—');
    expect(formatScore(null, 'unrated')).toBe('unrated');
  });

  it('formats zero rather than treating it as missing', () => {
    // 0 is a legal score; a falsiness guard would show the fallback instead.
    expect(formatScore(0)).toBe('0.00');
  });

  it('parses a numeric string, since some stored ratings are strings', () => {
    expect(formatScore('7.6')).toBe('7.60');
  });

  it('exports the precision so callers cannot drift from it', () => {
    expect(SCORE_DECIMALS).toBe(2);
  });
});

describe('formatScoreGap', () => {
  it('drops the sign, leaving the label to carry the direction', () => {
    expect(formatScoreGap(-1.5)).toBe('1.50');
    expect(formatScoreGap(1.5)).toBe('1.50');
  });

  it('keeps two decimals on a small gap, where it matters most', () => {
    // "0.1 apart" and "0.05 apart" are a meaningfully different claim.
    expect(formatScoreGap(0.05)).toBe('0.05');
  });

  it('takes the fallback for a missing gap', () => {
    expect(formatScoreGap(null)).toBe('—');
    expect(formatScoreGap(NaN)).toBe('—');
  });
});
