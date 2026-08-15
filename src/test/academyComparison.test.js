import { describe, it, expect } from 'vitest';
import { compareWithAcademy, categoryScorecard, overallAgreement, biggestDisagreements } from '@/assets/javascript/academyComparison.js';

const personalWin = (year, categoryKey, expanded) => ({ year, categoryKey, expanded });
const movieExp = (id, title) => ({ movie: { id, title } });
const personExp = (name, movieId, movieTitle) => ({ name, movieId, movie: { id: movieId, title: movieTitle } });

const academy = (year, category, tmdb, { winner = false, title = `AA ${tmdb}`, names = [], img = null } = {}) =>
  ({ year, category, tmdb: String(tmdb), isWinner: winner, title, img, names: names.map((name) => ({ name })) });

describe('compareWithAcademy', () => {
  it('agrees when your winner also won the Academy category (matched by tmdb id)', () => {
    const contests = compareWithAcademy(
      [personalWin(1997, 'bestPicture', movieExp(597, 'Titanic'))],
      [academy(1997, 'Best Picture', 597, { winner: true, title: 'Titanic' }),
        academy(1997, 'Best Picture', 2567, { title: 'As Good as It Gets' })]
    );
    expect(contests).toEqual([expect.objectContaining({ outcome: 'agreed', year: 1997 })]);
  });

  it("'lost': your pick was Academy-nominated but beaten — the real winner is named", () => {
    const contests = compareWithAcademy(
      [personalWin(1997, 'bestPicture', movieExp(2567, 'As Good as It Gets'))],
      [academy(1997, 'Best Picture', 597, { winner: true, title: 'Titanic', img: '/titanic.jpg' }),
        academy(1997, 'Best Picture', 2567, { title: 'As Good as It Gets' })]
    );
    expect(contests[0].outcome).toBe('lost');
    expect(contests[0].academyLabel).toBe('Titanic');
    // Poster plumbing for the versus cards.
    expect(contests[0].academyPosterPath).toBe('/titanic.jpg');
  });

  it("'snubbed': the Academy never nominated your pick at all", () => {
    const contests = compareWithAcademy(
      [personalWin(1997, 'bestPicture', movieExp(999, 'Your Obscure Favorite'))],
      [academy(1997, 'Best Picture', 597, { winner: true, title: 'Titanic' })]
    );
    expect(contests[0].outcome).toBe('snubbed');
    expect(contests[0].yoursLabel).toBe('Your Obscure Favorite');
  });

  it('person categories match on the person name, labeled with their film', () => {
    const contests = compareWithAcademy(
      [personalWin(1997, 'bestActress', personExp('Helen Hunt', 2567, 'As Good as It Gets'))],
      [academy(1997, 'Best Actress', 2567, { winner: true, title: 'As Good as It Gets', names: ['Helen Hunt'] })]
    );
    expect(contests[0].outcome).toBe('agreed');
  });

  it('a personal category spanning two Academy categories agrees if EITHER matches (Screenplay)', () => {
    const contests = compareWithAcademy(
      [personalWin(1997, 'bestScreenplay', movieExp(2567, 'As Good as It Gets'))],
      [academy(1997, 'Best Original Screenplay', 100, { winner: true, title: 'Good Will Hunting' }),
        academy(1997, 'Best Adapted Screenplay', 2567, { winner: true, title: 'As Good as It Gets' })]
    );
    expect(contests[0].outcome).toBe('agreed');
  });

  it('skips years the Academy had no such category, rather than counting them as disagreement', () => {
    const contests = compareWithAcademy(
      [personalWin(1981, 'bestAnimatedFeature', movieExp(1, 'The Fox and the Hound'))],
      [academy(1997, 'Best Picture', 597, { winner: true })]
    );
    expect(contests).toEqual([]);
  });

  it("tolerates the raw API's string isWinner flags", () => {
    const contests = compareWithAcademy(
      [personalWin(1997, 'bestPicture', movieExp(597, 'Titanic'))],
      [{ year: 1997, category: 'Best Picture', tmdb: '597', isWinner: '1', title: 'Titanic', names: [] }]
    );
    expect(contests[0].outcome).toBe('agreed');
  });
});

describe('categoryScorecard + overallAgreement', () => {
  const contests = [
    { year: 1995, categoryKey: 'bestPicture', outcome: 'agreed' },
    { year: 1996, categoryKey: 'bestPicture', outcome: 'lost' },
    { year: 1997, categoryKey: 'bestPicture', outcome: 'snubbed' },
    { year: 1995, categoryKey: 'bestEditing', outcome: 'agreed' },
    { year: 1996, categoryKey: 'bestEditing', outcome: 'agreed' },
    { year: 1997, categoryKey: 'bestEditing', outcome: 'agreed' },
    { year: 1997, categoryKey: 'bestScore', outcome: 'lost' } // only 1 contest: below minContests
  ];

  it('ranks categories most-contrarian first and applies the minimum-contest floor', () => {
    const scorecard = categoryScorecard(contests);
    expect(scorecard.map((row) => row.categoryKey)).toEqual(['bestPicture', 'bestEditing']);
    expect(scorecard[0].rate).toBeCloseTo(1 / 3);
    expect(scorecard[1].rate).toBe(1);
  });

  it('computes the overall agreement rate', () => {
    const overall = overallAgreement(contests);
    expect(overall.contests).toBe(7);
    expect(overall.agreements).toBe(4);
    expect(overall.rate).toBeCloseTo(4 / 7);
  });
});

describe('biggestDisagreements', () => {
  it('keeps only real disagreements with a named Academy winner, newest first, lost before snubbed', () => {
    const contests = [
      { year: 1995, categoryKey: 'a', outcome: 'agreed', academyLabel: 'X' },
      { year: 1996, categoryKey: 'b', outcome: 'snubbed', academyLabel: 'Y' },
      { year: 1997, categoryKey: 'c', outcome: 'snubbed', academyLabel: 'Z' },
      { year: 1997, categoryKey: 'd', outcome: 'lost', academyLabel: 'W' },
      { year: 1998, categoryKey: 'e', outcome: 'lost', academyLabel: null }
    ];
    const rows = biggestDisagreements(contests);
    expect(rows.map((row) => row.categoryKey)).toEqual(['d', 'c', 'b']);
  });
});
