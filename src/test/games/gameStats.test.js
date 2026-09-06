import { describe, it, expect } from 'vitest';
import {
  personalRecord, recentTrend, formSeries, winStreaks, habits, movieFacts, headline,
  trendSentence, dayStreak, overallStats, localDayKey, timeOfDaySlot, TREND_MIN_ROUNDS, HABIT_MIN_ROUNDS
} from '@/assets/javascript/games/gameStats.js';

// Mid-month, mid-day local dates — see .claude/rules/games.md on UTC drift.
const NOW = new Date(2026, 8, 6, 15, 0, 0).getTime(); // Sun Sep 6 2026, 3pm
const daysAgo = (days, hour = 12) => new Date(2026, 8, 6 - days, hour, 0, 0).getTime();

describe('personalRecord', () => {
  it('streak games: highest streak, dated by the FIRST time it was reached', () => {
    const record = personalRecord('higher-lower', [
      { at: daysAgo(9), streak: 4 },
      { at: daysAgo(5), streak: 12 },
      { at: daysAgo(2), streak: 12 },
      { at: daysAgo(1), streak: 7 }
    ]);
    expect(record).toMatchObject({ value: 12, label: '12 in a row', at: daysAgo(5), index: 1, matched: 2 });
  });

  it('low-is-better games pick the minimum', () => {
    expect(personalRecord('wordle', [{ guesses: 5 }, { guesses: 2 }, { guesses: 4 }]).value).toBe(2);
    expect(personalRecord('connections', [{ mistakes: 0 }]).label).toBe('flawless');
  });

  it('wins-only games ignore lost rounds entirely', () => {
    const record = personalRecord('clue-budget', [
      { won: false, saved: 0 },
      { won: true, saved: 30 },
      { won: false, saved: 0 }
    ]);
    expect(record).toMatchObject({ value: 30, label: '$30 left' });
    expect(personalRecord('clue-budget', [{ won: false, saved: 0 }])).toBeNull();
  });

  it('cineplexity treats a sweep as the win', () => {
    expect(personalRecord('cineplexity', [{ swept: false, misses: 1 }, { swept: true, misses: 3 }]).value).toBe(3);
  });

  it('volume games (Stamp) and unknown keys have no record', () => {
    expect(personalRecord('stamp', [{ decided: 9 }])).toBeNull();
    expect(personalRecord('nope', [{ x: 1 }])).toBeNull();
  });
});

describe('recentTrend', () => {
  const streaks = (values) => values.map((streak, i) => ({ at: daysAgo(values.length - i), streak }));

  it('needs enough rounds on both sides, or it stays quiet', () => {
    expect(recentTrend('timeline', streaks(Array(TREND_MIN_ROUNDS - 1).fill(3)))).toBeNull();
    expect(recentTrend('timeline', streaks(Array(TREND_MIN_ROUNDS).fill(3)))).toMatchObject({ verdict: 'flat' });
  });

  it('"up" always means improving, whichever way the number moved', () => {
    // Streaks rising: up.
    const rising = streaks([1, 1, 1, 1, 1, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8]);
    expect(recentTrend('timeline', rising)).toMatchObject({ recent: 8, earlier: 1, verdict: 'up' });
    // Guesses falling: also up.
    const fewer = [6, 6, 6, 6, 6, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2].map((guesses) => ({ guesses }));
    expect(recentTrend('wordle', fewer)).toMatchObject({ recent: 2, earlier: 6, verdict: 'up' });
    // Guesses rising: down.
    const more = [2, 2, 2, 2, 2, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6].map((guesses) => ({ guesses }));
    expect(recentTrend('wordle', more).verdict).toBe('down');
  });

  it('reads as a sentence', () => {
    expect(trendSentence('wordle', { recent: 2, earlier: 6, verdict: 'up', window: 10 }))
      .toBe('Last 10: 2 on average, against 6 before that. Heating up.');
    expect(trendSentence('clue-budget', { recent: 20, earlier: 35.5, verdict: 'down', window: 10 }))
      .toBe('Last 10: $20 on average, against $35.5 before that. Off the pace.');
    expect(trendSentence('wordle', null)).toBeNull();
  });
});

describe('formSeries', () => {
  it('the tallest bar is the best round, even when lower is better', () => {
    const series = formSeries('wordle', [{ guesses: 6 }, { guesses: 2 }, { guesses: 4 }]);
    expect(series.map((bar) => bar.height)).toEqual([0.15, 1, 0.575]);
    expect(series.map((bar) => bar.best)).toEqual([false, true, false]);
  });

  it('lost rounds draw empty in win/loss games', () => {
    const series = formSeries('poster-zoom', [{ won: false, zoomOuts: 5 }, { won: true, zoomOuts: 3 }]);
    expect(series[0]).toMatchObject({ won: false, height: 0, best: false });
    expect(series[1]).toMatchObject({ won: true, height: 1, best: true });
  });

  it('a single value fills the bar; no scoring rounds gives nothing', () => {
    expect(formSeries('timeline', [{ streak: 3 }])[0].height).toBe(1);
    expect(formSeries('clue-budget', [{ won: false, saved: 0 }])).toEqual([]);
    expect(formSeries('stamp', [{ decided: 4 }])).toEqual([]);
  });
});

describe('winStreaks', () => {
  it('counts the current run and the best run of wins', () => {
    const streaks = winStreaks('trivia', [
      { won: true }, { won: true }, { won: false }, { won: true }, { won: true }, { won: true }, { won: false }, { won: false }
    ]);
    expect(streaks).toEqual({ current: 2, currentIsWins: false, best: 3, wins: 5, losses: 3 });
  });

  it('is null for games with no loss state', () => {
    expect(winStreaks('wordle', [{ guesses: 3 }])).toBeNull();
    expect(winStreaks('trivia', [])).toBeNull();
  });
});

describe('habits', () => {
  it('names the favourite weekday and time of day once there are enough rounds', () => {
    // Four Sunday evenings and one Tuesday morning.
    const records = [
      { at: new Date(2026, 7, 16, 19).getTime() }, // Sun
      { at: new Date(2026, 7, 23, 20).getTime() }, // Sun
      { at: new Date(2026, 7, 30, 18).getTime() }, // Sun
      { at: new Date(2026, 8, 1, 8).getTime() }, // Tue
      { at: new Date(2026, 8, 6, 19).getTime() } // Sun
    ];
    const result = habits(records, NOW);
    expect(result).toMatchObject({ rounds: 5, daysPlayed: 5, weekday: 'Sunday', slot: 'evenings' });
    expect(result.first).toBe(records[0].at);
    expect(result.latest).toBe(records[4].at);
  });

  it('refuses to guess a favourite from too few rounds or no clear plurality', () => {
    const few = Array.from({ length: HABIT_MIN_ROUNDS - 1 }, (_, i) => ({ at: daysAgo(i, 19) }));
    expect(habits(few, NOW).weekday).toBeNull();
    // Seven rounds on seven different weekdays: nothing wins.
    const spread = Array.from({ length: 7 }, (_, i) => ({ at: daysAgo(i, 12) }));
    expect(habits(spread, NOW).weekday).toBeNull();
  });

  it('ignores records without a usable timestamp', () => {
    expect(habits([{ streak: 3 }, { at: 'x' }], NOW)).toBeNull();
    expect(habits([{ at: daysAgo(1) }, { at: null }], NOW).rounds).toBe(1);
  });

  it('buckets the clock into four slots', () => {
    expect(timeOfDaySlot(7)).toBe('mornings');
    expect(timeOfDaySlot(13)).toBe('afternoons');
    expect(timeOfDaySlot(19)).toBe('evenings');
    expect(timeOfDaySlot(23)).toBe('late nights');
    expect(timeOfDaySlot(2)).toBe('late nights');
  });
});

describe('movieFacts', () => {
  const library = {
    a: { dbKey: 'a', movie: { id: 1, title: 'Alien' } },
    b: { dbKey: 'b', movie: { id: 2, title: 'Brazil' } }
  };
  const resolve = (key) => library[key] || null;

  it('collects the movies that beat you, most often first, and the ones you nailed fastest', () => {
    const facts = movieFacts('trivia', [
      { won: false, facts: 5, movie: 'a', at: 1 },
      { won: true, facts: 2, movie: 'b', at: 2 },
      { won: false, facts: 5, movie: 'a', at: 3 },
      { won: false, facts: 5, movie: 'b', at: 4 },
      { won: true, facts: 4, movie: 'a', at: 5 }
    ], resolve);
    expect(facts.stumped.map((s) => [s.entry.movie.title, s.count])).toEqual([['Alien', 2], ['Brazil', 1]]);
    expect(facts.nailed.map((n) => [n.entry.movie.title, n.label])).toEqual([['Brazil', '2 facts'], ['Alien', '4 facts']]);
  });

  it('drops rounds whose movie has left the library, and rounds with no movie at all', () => {
    const facts = movieFacts('clue-budget', [
      { won: false, saved: 0, movie: 'gone' },
      { won: true, saved: 40 },
      { won: true, saved: 10, movie: 'a' }
    ], resolve);
    expect(facts.stumped).toEqual([]);
    expect(facts.nailed.map((n) => n.label)).toEqual(['$10 left']);
  });

  it('solve games only ever nail (they record on solve)', () => {
    const facts = movieFacts('wordle', [{ guesses: 3, movie: 'a' }], resolve);
    expect(facts.stumped).toEqual([]);
    expect(facts.nailed[0].label).toBe('3 guesses');
  });
});

describe('headline', () => {
  it('streak games lead with the best run', () => {
    expect(headline('tagline', [{ at: daysAgo(3), streak: 9 }], NOW)).toBe('Your best run is 9 in a row, set on Sep 3.');
    expect(headline('tagline', [{ at: daysAgo(3), streak: 9 }, { at: daysAgo(1), streak: 9 }], NOW))
      .toBe("Your best run is 9 in a row — you've hit it 2 times.");
  });

  it('solve games count puzzles and the best solve', () => {
    expect(headline('wordle', [{ at: daysAgo(2), guesses: 3 }, { at: daysAgo(1), guesses: 5 }], NOW))
      .toBe('2 puzzles solved. Best: 3 guesses on Sep 4.');
    expect(headline('connections', [{ mistakes: 0 }, { mistakes: 0 }], NOW)).toBe('2 puzzles solved, every one in flawless.');
  });

  it('win/loss games report the tally, and stay honest before the first win', () => {
    expect(headline('clue-budget', [{ won: false, saved: 0 }, { won: false, saved: 0 }], NOW))
      .toBe('2 rounds played, still hunting the first win.');
    expect(headline('clue-budget', [{ won: true, saved: 40, at: daysAgo(1) }], NOW)).toBe('Unbeaten in 1 round. Best: $40 left on Sep 5.');
    expect(headline('poster-zoom', [{ won: true, zoomOuts: 2, at: daysAgo(1) }, { won: false, zoomOuts: 6 }], NOW))
      .toBe('Won 1 of 2. Best: 2 zoom-outs on Sep 5.');
  });

  it('stamp talks about posters, and nothing talks when there is nothing', () => {
    expect(headline('stamp', [{ decided: 10, changes: 2 }, { decided: 5, changes: 0 }], NOW))
      .toBe("You've judged 15 posters and changed your mind on 2 of them.");
    expect(headline('stamp', [{ decided: 3, changes: 0 }], NOW)).toBe("You've judged 3 posters and stood by every one.");
    expect(headline('stamp', [], NOW)).toBeNull();
    expect(headline('wordle', [], NOW)).toBeNull();
  });
});

describe('dayStreak and overallStats', () => {
  it('counts consecutive days back from today, or from yesterday if today is untouched', () => {
    const key = (days) => localDayKey(daysAgo(days));
    expect(dayStreak([key(0), key(1), key(2), key(4)], NOW)).toBe(3);
    expect(dayStreak([key(1), key(2)], NOW)).toBe(2);
    expect(dayStreak([key(2), key(3)], NOW)).toBe(0);
    expect(dayStreak([], NOW)).toBe(0);
  });

  it('adds up the whole scoreboard', () => {
    const stats = overallStats({
      plays: { wordle: 7, trivia: 3 },
      history: {
        wordle: [{ at: daysAgo(0), guesses: 3 }, { at: daysAgo(0), guesses: 4 }, { at: daysAgo(1), guesses: 2 }],
        trivia: [{ at: daysAgo(1), won: true, facts: 2 }]
      },
      wins: { wordle: new Date(NOW).toDateString(), trivia: 'Tue Aug 04 2026' }
    }, { wordle: 'Reel Wordle', trivia: 'Trivia' }, NOW);

    expect(stats).toMatchObject({
      rounds: 4,
      sessions: 10,
      gamesPlayed: 2,
      daysPlayed: 2,
      streak: 2,
      favourite: { key: 'wordle', name: 'Reel Wordle', sessions: 7 },
      wonToday: 1,
      first: daysAgo(1),
      latest: daysAgo(0)
    });
    // Two rounds today vs two yesterday: the first day seen wins the tie, but
    // whichever it is, it carries 2 rounds and a readable label.
    expect(stats.busiest.rounds).toBe(2);
    expect(stats.busiest.label).toMatch(/Sep [56]/);
  });

  it('is null with nothing recorded at all', () => {
    expect(overallStats({}, {}, NOW)).toBeNull();
    expect(overallStats({ plays: {}, history: {} }, {}, NOW)).toBeNull();
  });
});
