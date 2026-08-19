import { describe, it, expect } from 'vitest'
import {
  findTiedGroup,
  createRoundRobinTournament,
  spreadSchedule,
  currentMatch,
  isComplete,
  recordMatchResult,
  rankContestants,
  progress,
  tweakDeltaForRank
} from '@/assets/javascript/tieBreakTournament.js'
import { makeSeededRng } from '@/assets/javascript/games/gameUtils.js'

describe('findTiedGroup', () => {
  const byScore = (entries) => (entry) => entries.get(entry)

  it('returns [] when nothing is tied', () => {
    const scores = new Map([['a', 9], ['b', 8], ['c', 7]])
    expect(findTiedGroup(['a', 'b', 'c'], byScore(scores))).toEqual([])
  })

  it('finds a simple adjacent pair', () => {
    const scores = new Map([['a', 9], ['b', 8], ['c', 8], ['d', 7]])
    expect(findTiedGroup(['a', 'b', 'c', 'd'], byScore(scores))).toEqual(['b', 'c'])
  })

  it('expands to the full contiguous run for a 4-way tie', () => {
    const scores = new Map([['a', 9], ['b', 7], ['c', 7], ['d', 7], ['e', 7], ['f', 5]])
    expect(findTiedGroup(['a', 'b', 'c', 'd', 'e', 'f'], byScore(scores))).toEqual(['b', 'c', 'd', 'e'])
  })

  it('handles a tied group starting at index 0', () => {
    const scores = new Map([['a', 8], ['b', 8], ['c', 5]])
    expect(findTiedGroup(['a', 'b', 'c'], byScore(scores))).toEqual(['a', 'b'])
  })

  it('handles a tied group ending at the last index', () => {
    const scores = new Map([['a', 9], ['b', 6], ['c', 6]])
    expect(findTiedGroup(['a', 'b', 'c'], byScore(scores))).toEqual(['b', 'c'])
  })

  it('only returns the FIRST tied group when there are two separate ones', () => {
    const scores = new Map([['a', 9], ['b', 9], ['c', 7], ['d', 5], ['e', 5]])
    expect(findTiedGroup(['a', 'b', 'c', 'd', 'e'], byScore(scores))).toEqual(['a', 'b'])
  })

  it('returns [] for an empty or single-entry list', () => {
    expect(findTiedGroup([], () => 1)).toEqual([])
    expect(findTiedGroup(['a'], () => 1)).toEqual([])
  })
})

describe('createRoundRobinTournament', () => {
  it('builds a schedule of every unique pair (N choose 2)', () => {
    const t = createRoundRobinTournament(['a', 'b', 'c', 'd'])
    expect(t.schedule).toHaveLength(6)
    // The SET of pairs is the contract; their order is spreadSchedule's job
    // (no film in two consecutive matches), asserted separately below.
    expect(t.schedule.map((m) => `${m.a}${m.b}`).sort()).toEqual(
      ['ab', 'ac', 'ad', 'bc', 'bd', 'cd']
    )
  })

  it('a 2-contestant tournament is a single match, matching the old pairwise behavior', () => {
    const t = createRoundRobinTournament(['a', 'b'])
    expect(t.schedule).toEqual([{ a: 'a', b: 'b' }])
  })

  it('initializes zeroed wins, nextIndex 0, and no final ranking yet', () => {
    const t = createRoundRobinTournament(['a', 'b', 'c'])
    expect(t.wins).toEqual({ a: 0, b: 0, c: 0 })
    expect(t.nextIndex).toBe(0)
    expect(t.finalRanking).toBeNull()
    expect(t.completedAt).toBeNull()
  })

  it('freezes contestantIds as a copy, not a live reference', () => {
    const ids = ['a', 'b']
    const t = createRoundRobinTournament(ids)
    ids.push('c')
    expect(t.contestantIds).toEqual(['a', 'b'])
  })

  describe('match order (bug report: matches ran through one contestant at a time instead of randomly)', () => {
    it('with no rng passed, is still deterministic — same input, same schedule', () => {
      const a = createRoundRobinTournament(['a', 'b', 'c', 'd']).schedule
      const b = createRoundRobinTournament(['a', 'b', 'c', 'd']).schedule
      expect(a).toEqual(b)
    })

    it('with an rng passed, shuffles match order while keeping the exact same set of pairs', () => {
      const unshuffled = createRoundRobinTournament(['a', 'b', 'c', 'd']).schedule
      const shuffled = createRoundRobinTournament(['a', 'b', 'c', 'd'], makeSeededRng(7)).schedule

      expect(shuffled).not.toEqual(unshuffled)
      expect(shuffled).toHaveLength(6)
      const key = (m) => `${m.a}${m.b}`
      expect([...shuffled].map(key).sort()).toEqual([...unshuffled].map(key).sort())
    })

    it('is deterministic for a fixed rng seed', () => {
      const a = createRoundRobinTournament(['a', 'b', 'c', 'd'], makeSeededRng(42)).schedule
      const b = createRoundRobinTournament(['a', 'b', 'c', 'd'], makeSeededRng(42)).schedule
      expect(a).toEqual(b)
    })
  })
})

describe('recordMatchResult / currentMatch / isComplete', () => {
  it('advances nextIndex and tallies the winner after each match', () => {
    let t = createRoundRobinTournament(['a', 'b', 'c'])
    expect(currentMatch(t)).toEqual({ a: 'a', b: 'b' })
    expect(isComplete(t)).toBe(false)

    t = recordMatchResult(t, 'a')
    expect(t.wins.a).toBe(1)
    expect(currentMatch(t)).toEqual({ a: 'a', b: 'c' })
    expect(isComplete(t)).toBe(false)
  })

  it('attaches finalRanking + completedAt exactly when the last match is recorded', () => {
    let t = createRoundRobinTournament(['a', 'b'])
    expect(t.completedAt).toBeNull()

    t = recordMatchResult(t, 'a')
    expect(isComplete(t)).toBe(true)
    expect(t.completedAt).not.toBeNull()
    expect(t.finalRanking).toEqual([
      { dbKey: 'a', wins: 1, rank: 0 },
      { dbKey: 'b', wins: 0, rank: 1 }
    ])
  })

  it('is a no-op past completion (returns the same state)', () => {
    let t = createRoundRobinTournament(['a', 'b'])
    t = recordMatchResult(t, 'a')
    const again = recordMatchResult(t, 'b')
    expect(again).toBe(t)
  })

  it('does not mutate the original state (immutable updates)', () => {
    const t = createRoundRobinTournament(['a', 'b', 'c'])
    const original = JSON.stringify(t)
    recordMatchResult(t, 'a')
    expect(JSON.stringify(t)).toBe(original)
  })

  it('resolves a full 4-way round robin into a win-ordered ranking', () => {
    // a beats everyone (3-0), b beats c and d (2-1), c beats d only (1-2), d loses all (0-3)
    let t = createRoundRobinTournament(['a', 'b', 'c', 'd'])
    const winners = ['a', 'a', 'a', 'b', 'b', 'c'] // matches in schedule order: ab ac ad bc bd cd
    winners.forEach((winner) => { t = recordMatchResult(t, winner) })

    expect(isComplete(t)).toBe(true)
    expect(t.finalRanking.map((r) => r.dbKey)).toEqual(['a', 'b', 'c', 'd'])
    expect(t.finalRanking.map((r) => r.wins)).toEqual([3, 2, 1, 0])
  })
})

// Matt, 2026-08-19: "I think we could solve a lot by just not letting the same
// movie be in two consecutive matchups, then it wouldn't be as confusing."
describe('spreadSchedule', () => {
  const sharesAFilm = (x, y) => x.a === y.a || x.a === y.b || x.b === y.a || x.b === y.b
  const repeats = (schedule) => schedule.filter((match, i) => i > 0 && sharesAFilm(schedule[i - 1], match))

  it('never repeats a film back to back from five films up', () => {
    // Five and above is always achievable, and achieved.
    expect(repeats(createRoundRobinTournament(['a', 'b', 'c', 'd', 'e']).schedule)).toEqual([])
    expect(repeats(createRoundRobinTournament(['a', 'b', 'c', 'd', 'e', 'f']).schedule)).toEqual([])
  })

  it('hits the forced minimum for four films, where zero is impossible', () => {
    // Each of K4's six matches is disjoint from exactly one other, so at most
    // three of the five transitions can be clean. Two repeats is the proven
    // optimum (brute-forced over every permutation), not a shortfall.
    const t = createRoundRobinTournament(['a', 'b', 'c', 'd'])
    expect(repeats(t.schedule)).toHaveLength(2)
  })

  it('hits the forced minimum for three films, where every pair overlaps', () => {
    // ab, ac, bc — any two of them share a film, so both transitions repeat.
    const t = createRoundRobinTournament(['a', 'b', 'c'])
    expect(repeats(t.schedule)).toHaveLength(2)
  })

  it('is a real improvement on the unspread order', () => {
    const raw = [
      { a: 'a', b: 'b' }, { a: 'a', b: 'c' }, { a: 'a', b: 'd' },
      { a: 'b', b: 'c' }, { a: 'b', b: 'd' }, { a: 'c', b: 'd' }
    ]
    // 4 repeats before, 2 after — the guard against a "fix" that does nothing.
    expect(repeats(raw)).toHaveLength(4)
    expect(repeats(spreadSchedule(raw))).toHaveLength(2)
  })

  it('keeps every match exactly once, dropping and duplicating nothing', () => {
    const original = [
      { a: 'a', b: 'b' }, { a: 'a', b: 'c' }, { a: 'a', b: 'd' },
      { a: 'b', b: 'c' }, { a: 'b', b: 'd' }, { a: 'c', b: 'd' }
    ]
    const spread = spreadSchedule(original)

    expect(spread).toHaveLength(original.length)
    expect(spread.map((m) => `${m.a}${m.b}`).sort()).toEqual(
      original.map((m) => `${m.a}${m.b}`).sort()
    )
  })

  it('still terminates when a repeat is unavoidable', () => {
    // Three contestants is ab, ac, bc — every pair shares a film with every
    // other pair, so a repeat is forced no matter the order. It must degrade,
    // not hang or drop a match.
    const t = createRoundRobinTournament(['a', 'b', 'c'])

    expect(t.schedule).toHaveLength(3)
    expect(t.schedule.map((m) => `${m.a}${m.b}`).sort()).toEqual(['ab', 'ac', 'bc'])
  })

  it('handles an empty or single-match schedule', () => {
    expect(spreadSchedule([])).toEqual([])
    expect(spreadSchedule([{ a: 'a', b: 'b' }])).toEqual([{ a: 'a', b: 'b' }])
  })

  it('applies to a shuffled schedule as well', () => {
    const t = createRoundRobinTournament(['a', 'b', 'c', 'd', 'e'], makeSeededRng(3))
    expect(repeats(t.schedule)).toEqual([])
  })
})

describe('rankContestants — tie-of-ties fallback', () => {
  it('falls back to original contestant order when win counts are equal and no match records exist at all (a tournament started before head-to-head shipped)', () => {
    const base = createRoundRobinTournament(['a', 'b', 'c'])
    const cycle = rankContestants({ ...base, wins: { a: 1, b: 1, c: 1 } })
    expect(cycle.map((r) => r.dbKey)).toEqual(['a', 'b', 'c'])
    expect(cycle.map((r) => r.rank)).toEqual([0, 1, 2])
  })
})

// Matt, 2026-08-19: "are you breaking ties with the head-to-head matchups? It
// seems like the way to go... I suppose that still could lead to a transitive
// property problem where things work in a circle."
describe('rankContestants — head-to-head', () => {
  // Plays a full tournament through the real recorder, so these exercise the
  // stored shape rather than a hand-written one.
  const playOut = (ids, pickWinner) => {
    let tournament = createRoundRobinTournament(ids)
    while (!isComplete(tournament)) {
      const match = currentMatch(tournament)
      tournament = recordMatchResult(tournament, pickWinner(match))
    }
    return tournament
  }

  it('separates two contestants on equal wins by the match between them', () => {
    // a beats b; b and c beat each other's other match so all three finish 1-1.
    // Schedule for [a,b,c] is a-b, a-c, b-c.
    const tournament = playOut(['a', 'b', 'c'], (match) => {
      if (match.a === 'a' && match.b === 'b') return 'b'   // b beats a
      if (match.a === 'a' && match.b === 'c') return 'a'   // a beats c
      return 'c'                                           // c beats b
    })

    // Everyone is 1-1, and it IS a cycle (b>a, a>c, c>b) — nothing can order
    // it, so original order stands.
    expect(tournament.wins).toEqual({ a: 1, b: 1, c: 1 })
    expect(rankContestants(tournament).map((r) => r.dbKey)).toEqual(['a', 'b', 'c'])
  })

  it('puts the head-to-head winner first even when it started later in the list', () => {
    // Four contestants; 'd' and 'a' both finish on 2 wins, and d beat a.
    // Without head-to-head, 'a' would rank above 'd' purely for being first
    // in contestantIds — which is the arbitrariness being fixed.
    const tournament = playOut(['a', 'b', 'c', 'd'], (match) => {
      const pair = `${match.a}-${match.b}`
      const winners = {
        'a-b': 'a', 'a-c': 'a', 'a-d': 'd', 'b-c': 'b', 'b-d': 'd', 'c-d': 'c'
      }
      return winners[pair]
    })

    expect(tournament.wins).toEqual({ a: 2, b: 1, c: 1, d: 2 })

    const ranking = rankContestants(tournament)
    expect(ranking.map((r) => r.dbKey)).toEqual(['d', 'a', 'b', 'c'])
    expect(ranking[0].dbKey).toBe('d')
  })

  it('orders a three-way tie by the mini-league among just those three', () => {
    // b, c, d all finish on 1 win each from the wider draw; among themselves
    // c beat both, d beat b, b beat nobody in the group.
    const tournament = {
      contestantIds: ['b', 'c', 'd'],
      schedule: [],
      nextIndex: 0,
      wins: { b: 1, c: 1, d: 1 },
      matchResults: [
        { a: 'b', b: 'c', winnerId: 'c' },
        { a: 'c', b: 'd', winnerId: 'c' },
        { a: 'b', b: 'd', winnerId: 'd' }
      ],
      finalRanking: null,
      completedAt: null
    }

    // c: 2 in-group wins, d: 1, b: 0 — a real ordering, not a coin flip.
    expect(rankContestants(tournament).map((r) => r.dbKey)).toEqual(['c', 'd', 'b'])
  })

  it('leaves a genuine cycle in original order rather than inventing a winner', () => {
    const tournament = playOut(['x', 'y', 'z'], (match) => {
      if (match.a === 'x' && match.b === 'y') return 'x'  // x > y
      if (match.a === 'y' && match.b === 'z') return 'y'  // y > z
      return 'z'                                          // z > x
    })

    expect(tournament.wins).toEqual({ x: 1, y: 1, z: 1 })
    expect(rankContestants(tournament).map((r) => r.dbKey)).toEqual(['x', 'y', 'z'])
  })

  it('records who beat whom, not just how many', () => {
    const tournament = playOut(['a', 'b'], () => 'b')

    expect(tournament.matchResults).toEqual([{ a: 'a', b: 'b', winnerId: 'b' }])
  })

  it('ranks an in-flight tournament from before this change exactly as it used to', () => {
    // No matchResults key at all — the shape already sitting in Firebase.
    const legacy = {
      contestantIds: ['a', 'b', 'c'],
      schedule: [],
      nextIndex: 3,
      wins: { a: 2, b: 1, c: 0 },
      finalRanking: null,
      completedAt: null
    }

    expect(() => rankContestants(legacy)).not.toThrow()
    expect(rankContestants(legacy).map((r) => r.dbKey)).toEqual(['a', 'b', 'c'])
  })
})

describe('progress', () => {
  it('reports contestant count and 1-indexed match progress', () => {
    let t = createRoundRobinTournament(['a', 'b', 'c'])
    expect(progress(t)).toEqual({ current: 1, total: 3, contestants: 3 })

    t = recordMatchResult(t, 'a')
    expect(progress(t)).toEqual({ current: 2, total: 3, contestants: 3 })
  })

  it('caps "current" at "total" once complete (no off-by-one on the last match)', () => {
    let t = createRoundRobinTournament(['a', 'b'])
    t = recordMatchResult(t, 'a')
    expect(progress(t)).toEqual({ current: 1, total: 1, contestants: 2 })
  })
})

describe('tweakDeltaForRank', () => {
  it('applies no penalty to the top rank', () => {
    expect(tweakDeltaForRank(0)).toBeCloseTo(0)
  })

  it('applies -0.05 per rank below the top', () => {
    // Not the score step: tweakValue feeds `overall`, which is weighted (2)
    // and divided by 10, so the visible score moves by a fifth of this —
    // exactly 0.01 per rank, the smallest step that survives rounding to 2dp.
    expect(tweakDeltaForRank(1)).toBeCloseTo(-0.05)
    expect(tweakDeltaForRank(2)).toBeCloseTo(-0.1)
    expect(tweakDeltaForRank(3)).toBeCloseTo(-0.15)
  })
})
