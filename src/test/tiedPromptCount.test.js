// Report -P-FN61DdMmTJ0J9XJWy: "The new ties dialogue always says there
// are two movies tied where in fact, they are often more than two. We
// should update that language to say how many movies are gonna be in the
// tournament that we're about to open."
import { describe, it, expect } from 'vitest';
import { tiedContestantCount, countWord, createRoundRobinTournament } from '../assets/javascript/tieBreakTournament.js';

describe('tiedContestantCount', () => {
  it('counts the tied group when no tournament has been opened yet', () => {
    expect(tiedContestantCount(null, ['a', 'b', 'c', 'd'])).toBe(4);
  });

  it('prefers a live tournament\'s frozen contestant list', () => {
    // Membership is frozen at creation, so the tournament — not today's
    // tied group — is what the prompt is about once one exists.
    const tournament = createRoundRobinTournament(['a', 'b', 'c']);
    expect(tiedContestantCount(tournament, ['a', 'b'])).toBe(3);
  });

  it('is zero, not NaN, when there is nothing tied at all', () => {
    expect(tiedContestantCount(null, [])).toBe(0);
    expect(tiedContestantCount(undefined, undefined)).toBe(0);
  });
});

describe('countWord', () => {
  it('writes small numbers out, capitalised for the start of a sentence', () => {
    expect(countWord(2)).toBe('Two');
    expect(countWord(3)).toBe('Three');
    expect(countWord(10)).toBe('Ten');
  });

  it('switches to digits past ten, where words get unwieldy', () => {
    expect(countWord(11)).toBe('11');
    expect(countWord(33)).toBe('33');
  });

  it('returns nothing for a value it cannot describe', () => {
    expect(countWord(null)).toBe('');
    expect(countWord('lots')).toBe('');
    expect(countWord(-1)).toBe('');
  });

  it('produces the sentence the prompt actually shows', () => {
    const sentence = (count) => `${countWord(count)} films are sitting on the same score.`;
    expect(sentence(2)).toBe('Two films are sitting on the same score.');
    expect(sentence(5)).toBe('Five films are sitting on the same score.');
    expect(sentence(33)).toBe('33 films are sitting on the same score.');
  });
});
