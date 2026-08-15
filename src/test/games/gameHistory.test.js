import { describe, it, expect } from 'vitest';
import { appendRound, summarizeGame, formatRound, HISTORY_CAP } from '@/assets/javascript/games/gameHistory.js';

describe('appendRound', () => {
  it('appends to the end and preserves order', () => {
    const history = appendRound([{ at: 1 }], { at: 2, streak: 5 });
    expect(history.map((r) => r.at)).toEqual([1, 2]);
  });

  it('caps at the newest HISTORY_CAP records', () => {
    const long = Array.from({ length: HISTORY_CAP }, (_, i) => ({ at: i }));
    const history = appendRound(long, { at: 999 });
    expect(history).toHaveLength(HISTORY_CAP);
    expect(history[0].at).toBe(1); // oldest dropped
    expect(history[history.length - 1].at).toBe(999);
  });

  it('tolerates missing or object-shaped existing history', () => {
    expect(appendRound(undefined, { at: 1 })).toHaveLength(1);
    expect(appendRound({ 0: { at: 1 } }, { at: 2 })).toHaveLength(2);
  });
});

describe('summarizeGame', () => {
  it('streak games report runs, best and average', () => {
    const records = [{ streak: 4 }, { streak: 10 }, { streak: 1 }];
    const lines = summarizeGame('higher-lower', records);
    expect(lines).toContainEqual({ label: 'Runs', value: 3 });
    expect(lines).toContainEqual({ label: 'Best streak', value: 10 });
    expect(lines).toContainEqual({ label: 'Average streak', value: 5 });
  });

  it('clue budget reports win rate and savings from wins only', () => {
    const records = [
      { won: true, saved: 40 },
      { won: true, saved: 20 },
      { won: false, saved: 0 },
      { won: false, saved: 0 }
    ];
    const lines = summarizeGame('clue-budget', records);
    expect(lines).toContainEqual({ label: 'Win rate', value: '50%' });
    expect(lines).toContainEqual({ label: 'Best savings', value: '$40' });
    expect(lines).toContainEqual({ label: 'Average savings (wins)', value: '$30' });
  });

  it('wordle reports fewest guesses as best (the clue/score concept is gone)', () => {
    const lines = summarizeGame('wordle', [{ guesses: 7 }, { guesses: 2 }]);
    expect(lines).toContainEqual({ label: 'Best (fewest guesses)', value: 2 });
    expect(lines.map((line) => line.label)).not.toContain('Best score');
  });

  it('six degrees counts optimal-length chains', () => {
    const lines = summarizeGame('six-degrees', [
      { steps: 3, optimal: 3 },
      { steps: 5, optimal: 3 },
      { steps: 2, optimal: 2 }
    ]);
    expect(lines).toContainEqual({ label: 'Optimal-length chains', value: 2 });
    expect(lines).toContainEqual({ label: 'Best (fewest steps)', value: 2 });
  });

  it('an unknown game key still reports a rounds count rather than hiding history', () => {
    expect(summarizeGame('future-game', [{ at: 1 }])).toEqual([{ label: 'Rounds', value: 1 }]);
  });

  it('returns nothing for an empty history, and drops null stats', () => {
    expect(summarizeGame('higher-lower', [])).toEqual([]);
    // Records without the expected numeric field: best/average are dropped,
    // never rendered as null.
    const lines = summarizeGame('higher-lower', [{ at: 1 }]);
    expect(lines).toEqual([{ label: 'Runs', value: 1 }]);
  });
});

describe('formatRound', () => {
  it('formats each game\'s primary metric as a short chip label', () => {
    expect(formatRound('higher-lower', { streak: 12 })).toBe('streak 12');
    expect(formatRound('wordle', { guesses: 1 })).toBe('1 guess');
    expect(formatRound('connections', { mistakes: 0 })).toBe('flawless');
    expect(formatRound('clue-budget', { won: true, saved: 35 })).toBe('won · $35 left');
    expect(formatRound('clue-budget', { won: false })).toBe('broke');
    expect(formatRound('poster-zoom', { won: false })).toBe('gave up');
    expect(formatRound('stamp', { changes: 1 })).toBe('1 change');
  });

  it('falls back gracefully for unknown games and empty records', () => {
    expect(formatRound('future-game', { at: 1 })).toBe('played');
    expect(formatRound('trivia', null)).toBe('missed');
  });
});
