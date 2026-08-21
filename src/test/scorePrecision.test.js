import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatScore } from '../assets/javascript/formatScore.js';
import { tweakDeltaForRank } from '../assets/javascript/tieBreakTournament.js';

// Matt, 2026-08-21: "maintain scores to three decimal places or even four...
// the additional decimal places that we track but don't display would only
// really be there so that we could always sort in terms of score... The score
// is the rank. We just need more precision."
//
// The contract, in one place: scores are COMPUTED to four decimals
// (GetRating.js), DISPLAYED at two (formatScore.js), and tiebreak verdicts
// move the invisible fourth (tweakDeltaForRank). At 2dp the 0-10 range had
// 1,000 slots against a 1,379-film library — a tie-free ranking was
// impossible by pigeonhole, and each tournament nudge spent one of the same
// scarce visible slots. At 4dp there are 100,000.

describe('the 4dp/2dp precision contract', () => {
  // GetRating pulls in the store, so the rounding contract is asserted
  // against the source — the same honest approach the stylesheet tests take.
  it('computes scores to four decimals', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/assets/javascript/GetRating.js'), 'utf8',
    ).replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(source).toContain('return parseFloat((total / 10).toFixed(4));');
    // The old rounding must be gone, not merely joined.
    expect(source).not.toContain('.toFixed(2));');
  });

  it('displays every score at two decimals regardless of stored precision', () => {
    // toFixed ROUNDS the hidden decimals rather than truncating them - a
    // 7.815 shows as 7.82. That's the desired display behaviour; what must
    // never appear is a third decimal.
    expect(formatScore(7.8149)).toBe('7.81');
    expect(formatScore(7.815)).toBe('7.82');
    expect(formatScore(7.25)).toBe('7.25');
  });

  // The point of the whole change: films that display identically must still
  // sort as different films.
  it('lets two films share a displayed score and still have an order', () => {
    // Both inside the same 0.01 bucket - away from the rounding boundary.
    const a = 7.8129;
    const b = 7.8121;
    expect(formatScore(a)).toBe(formatScore(b));
    expect(a > b).toBe(true);
  });
});

describe('tiebreak nudges land on the invisible decimal', () => {
  // tweakValue flows through the Overall weight (2.0) and the /10, so the
  // score moves by a fifth of the delta: -0.0005 -> -0.0001, one slot on the
  // fourth decimal.
  it('moves the score by 0.0001 per rank', () => {
    expect(tweakDeltaForRank(1) * 2 / 10).toBeCloseTo(-0.0001, 8);
    expect(tweakDeltaForRank(17) * 2 / 10).toBeCloseTo(-0.0017, 8);
  });

  it('never moves a displayed score, even for the largest real group', () => {
    // The largest tie group measured in the live library was 18 films at
    // 7.25. Last place travels furthest; its displayed score must not budge.
    const lastPlaceScore = 7.25 + (tweakDeltaForRank(17) * 2) / 10;
    expect(formatScore(lastPlaceScore)).toBe('7.25');
  });

  it('still gives every rank in that group a distinct score', () => {
    const scores = Array.from({ length: 18 }, (_, rank) => 7.25 + (tweakDeltaForRank(rank) * 2) / 10);
    expect(new Set(scores.map((s) => s.toFixed(4))).size).toBe(18);
  });
});

describe('no template renders the raw total', () => {
  // At 2dp the raw value and the displayed value were the same string, so a
  // bare {{rating.calculatedTotal}} was harmless. At 4dp it prints 7.815 at
  // someone. Every one of these templates was patched to go through
  // formatScore; this stops one quietly coming back.
  const templates = [
    'src/components/DBGridLayoutSearchResult.vue',
    'src/components/MovieDetail.vue',
    'src/components/RateMovie.vue',
  ];

  it.each(templates)('%s formats calculatedTotal before showing it', (file) => {
    const source = readFileSync(join(process.cwd(), file), 'utf8');
    const template = source.slice(0, source.indexOf('<script'));
    expect(template).not.toMatch(/\{\{\s*rating\.calculatedTotal\s*\}\}/);
  });
});
