import { describe, it, expect } from 'vitest'
import { buildSocialProfile, compareWithFriend, filmClubSummary, socialSettingsWithDefaults, countNewFriendUpdates, friendsLoveUnseen } from '@/assets/javascript/social.js'

const NOW = Date.UTC(2026, 7, 15)

function entry (id, title, rating, { at = NOW - id * 1000, year = 2000, criteria = {}, medium = null, extraViewings = [] } = {}) {
  return {
    dbKey: `k${id}`,
    movie: { id, title, poster_path: `/${id}.jpg`, release_date: `${year}-06-15` },
    ratings: [
      ...extraViewings,
      { date: at, calculatedTotal: rating, direction: 9, ...(medium ? { medium } : {}), ...criteria }
    ]
  }
}
const ratingOf = (e) => ({ calculatedTotal: e.ratings[0].calculatedTotal })

describe('socialSettingsWithDefaults', () => {
  it('defaults everything ON with a name derived from the email', () => {
    const settings = socialSettingsWithDefaults(undefined, 'mattgrosso@gmail.com')
    expect(settings.enabled).toBe(true)
    expect(settings.shareRatings).toBe(true)
    expect(settings.shareCriteria).toBe(true)
    expect(settings.displayName).toBe('mattgrosso')
  })

  it('only an explicit false opts a tier out', () => {
    const settings = socialSettingsWithDefaults({ shareCriteria: false, displayName: 'Matt' }, 'mattgrosso@gmail.com')
    expect(settings.enabled).toBe(true)
    expect(settings.shareRatings).toBe(true)
    expect(settings.shareCriteria).toBe(false)
    expect(settings.displayName).toBe('Matt')
  })

  it('master opt-out sticks', () => {
    expect(socialSettingsWithDefaults({ enabled: false }, 'x@y.com').enabled).toBe(false)
  })
})

describe('buildSocialProfile', () => {
  const library = [
    entry(1, 'Best', 9.5, { year: 1980 }),
    entry(2, 'Mid', 7, { year: 1995 }),
    entry(3, 'Newest High', 9.9, { year: 2020 })
  ]

  it('publishes shelf, recent, counts, and the crown — composite scores only', () => {
    const profile = buildSocialProfile(library, ratingOf, { name: 'Matt', shareRatings: true, now: NOW })

    expect(profile.name).toBe('Matt')
    expect(profile.counts.titles).toBe(3)
    expect(profile.topShelf[0].t).toBe('Newest High')
    expect(profile.crown.t).toBe('Newest High') // 1980's 9.5 dethroned by 2020's 9.9
    expect(profile.ratings[1].r).toBe(9.5)
    // Privacy: NO criterion breakdown ever leaves the account.
    expect(JSON.stringify(profile)).not.toContain('direction')
  })

  it('omits the ratings map entirely unless sharing is on', () => {
    const profile = buildSocialProfile(library, ratingOf, { name: 'Matt', shareRatings: false })
    expect(profile.ratings).toBeUndefined()
    expect(profile.topShelf.length).toBeGreaterThan(0) // shelf still published
  })

  it('publishes the criteria array only behind its own opt-in', () => {
    const lib = [entry(1, 'Best', 9.5, { criteria: { love: 10, overall: 9, stickiness: 4, story: 9, imagery: 8, performance: 7, soundtrack: 6 } })]
    const withOptIn = buildSocialProfile(lib, ratingOf, { name: 'Matt', shareRatings: true, shareCriteria: true })
    // CRITERIA order: love, overall, stickiness, story, direction, imagery, performance, soundtrack
    expect(withOptIn.ratings[1].c).toEqual([10, 9, 4, 9, 9, 8, 7, 6])
    // shareRatings alone still means composite only
    const withoutOptIn = buildSocialProfile(lib, ratingOf, { name: 'Matt', shareRatings: true })
    expect(withoutOptIn.ratings[1].c).toBeUndefined()
  })
})

describe('compareWithFriend', () => {
  const myLibrary = [
    entry(1, 'Agreed Love', 9),
    entry(2, 'Fight Movie', 9),
    entry(3, 'Mine Only', 8)
  ]
  const friend = {
    name: 'Natalie',
    ratings: {
      1: { r: 8.8, t: 'Agreed Love', p: '/1.jpg' },
      2: { r: 4, t: 'Fight Movie', p: '/2.jpg' },
      9: { r: 9.2, t: 'Theirs Only Gem', p: '/9.jpg' }
    }
  }

  it('finds the overlap, gaps, shared loves, and their unseen gems', () => {
    const cmp = compareWithFriend(myLibrary, ratingOf, friend, { globalAvg: 6 })

    expect(cmp.sharedCount).toBe(2)
    expect(cmp.biggestDisagreements[0].entry.movie.title).toBe('Fight Movie')
    expect(cmp.biggestDisagreements[0].gap).toBe(5)
    expect(cmp.sharedLoves[0].entry.movie.title).toBe('Agreed Love')
    expect(cmp.theyLoveUnseen[0].t).toBe('Theirs Only Gem')
    expect(cmp.myLogScore).not.toBeNull()
    expect(cmp.alignment).toBeLessThan(10)
  })

  it('degrades gracefully with no overlap', () => {
    const cmp = compareWithFriend([entry(50, 'Lonely', 7)], ratingOf, friend, { globalAvg: 6 })
    expect(cmp.sharedCount).toBe(0)
    expect(cmp.theyLoveUnseen.length).toBeGreaterThan(0)
  })

  it('surfaces per-criterion tendencies when the friend shares their breakdown', () => {
    const lib = [
      entry(1, 'A', 9, { criteria: { love: 9, overall: 8, stickiness: 4, story: 8, imagery: 6, performance: 7, soundtrack: 5 } }),
      entry(2, 'B', 8, { criteria: { love: 8, overall: 8, stickiness: 3, story: 7, imagery: 5, performance: 7, soundtrack: 5 } })
    ]
    const sharing = {
      name: 'Natalie',
      ratings: {
        // c order: love, overall, stickiness, story, direction, imagery, performance, soundtrack
        1: { r: 8, t: 'A', p: '/1.jpg', c: [7, 8, 4, 8, 9, 7, 7, 5] },
        2: { r: 8, t: 'B', p: '/2.jpg', c: [6, 8, 3, 7, 9, 6, 7, 5] }
      }
    }
    const cmp = compareWithFriend(lib, ratingOf, sharing, { globalAvg: 6 })
    expect(cmp.criterionGaps).not.toBeNull()
    // I rate Love higher by 2 on both movies; that should lead the list.
    expect(cmp.criterionGaps[0].criterion).toBe('love')
    expect(cmp.criterionGaps[0].gap).toBe(2)
    expect(cmp.criterionGaps[0].count).toBe(2)
    // Imagery: I'm lower by 1 on both — negative gap.
    const imagery = cmp.criterionGaps.find((g) => g.criterion === 'imagery')
    expect(imagery.gap).toBe(-1)
  })

  it('criterionGaps is null when the friend shares composites only', () => {
    const cmp = compareWithFriend(myLibrary, ratingOf, friend, { globalAvg: 6 })
    expect(cmp.criterionGaps).toBeNull()
  })
})

describe('countNewFriendUpdates', () => {
  const profiles = {
    'natalie-key': { name: 'Natalie', recent: [{ id: 1, at: 1000 }, { id: 2, at: 3000 }] },
    'seth-key': { name: 'Seth', recent: [{ id: 3, at: 2000 }] }
  }

  it('counts only ratings newer than lastSeen, across all friends', () => {
    expect(countNewFriendUpdates(profiles, 1500)).toBe(2) // at 3000 and 2000
    expect(countNewFriendUpdates(profiles, 0)).toBe(3)
    expect(countNewFriendUpdates(profiles, 5000)).toBe(0)
  })

  it('tolerates empty and malformed profiles', () => {
    expect(countNewFriendUpdates({}, 0)).toBe(0)
    expect(countNewFriendUpdates({ x: null, y: { recent: null } }, 0)).toBe(0)
    expect(countNewFriendUpdates(undefined, undefined)).toBe(0)
  })
})

describe('filmClubSummary', () => {
  const myLibrary = [entry(1, 'Consensus', 9), entry(2, 'Divisive', 9)]
  const friends = {
    'natalie-key': {
      name: 'Natalie',
      recent: [{ id: 7, t: 'Nat Recent', p: '/7.jpg', r: 8, at: NOW - 100 }],
      ratings: { 1: { r: 8.5, t: 'Consensus', p: '/1.jpg' }, 2: { r: 3, t: 'Divisive', p: '/2.jpg' } }
    },
    'seth-key': {
      name: 'Seth',
      recent: [{ id: 8, t: 'Seth Recent', p: '/8.jpg', r: 6, at: NOW - 50 }],
      ratings: { 1: { r: 9.2, t: 'Consensus', p: '/1.jpg' } }
    }
  }

  it('merges the feed newest-first and surfaces consensus and divides', () => {
    const summary = filmClubSummary(myLibrary, ratingOf, friends)

    expect(summary.friendCount).toBe(2)
    expect(summary.feed[0].t).toBe('Seth Recent')
    expect(summary.feed[0].friendName).toBe('Seth')
    expect(summary.clubFavorites[0].t).toBe('Consensus')
    expect(summary.clubFavorites[0].scores.length).toBe(3)
    expect(summary.biggestDivides[0].t).toBe('Divisive')
    expect(summary.biggestDivides[0].spread).toBe(6)
  })

  it('null with no friends', () => {
    expect(filmClubSummary(myLibrary, ratingOf, {})).toBeNull()
  })
})


describe('friendsLoveUnseen', () => {
  const myLibrary = [entry(1, 'Seen It', 7)]
  const friends = {
    nat: {
      name: 'Natalie',
      ratings: {
        1: { r: 9, t: 'Seen It', p: '/1.jpg' },        // I've rated it — excluded
        2: { r: 9, t: 'Both Love', p: '/2.jpg' },
        3: { r: 8.5, t: 'Nat Only', p: '/3.jpg' },
        4: { r: 6, t: 'Lukewarm', p: '/4.jpg' }        // below the love floor
      }
    },
    seth: {
      name: 'Seth',
      ratings: {
        2: { r: 8.2, t: 'Both Love', p: '/2.jpg' },
        5: { r: 9.9, t: 'Seth Only', p: '/5.jpg' }
      }
    },
    shelfOnly: { name: 'Quiet One' }                    // shares no ratings map
  }

  it('ranks agreement above raw score', () => {
    const rows = friendsLoveUnseen(myLibrary, ratingOf, friends)
    expect(rows[0].title).toBe('Both Love')             // 2 fans beats Seth's lone 9.9
    expect(rows[0].fanCount).toBe(2)
    expect(rows[0].average).toBe(8.6)
    expect(rows[0].fans[0].name).toBe('Natalie')        // best score first
  })

  it('excludes what I have already rated and what nobody loved', () => {
    const titles = friendsLoveUnseen(myLibrary, ratingOf, friends).map((r) => r.title)
    expect(titles).not.toContain('Seen It')
    expect(titles).not.toContain('Lukewarm')
    expect(titles).toEqual(expect.arrayContaining(['Nat Only', 'Seth Only']))
  })

  it('is empty with no friends, and ignores friends who share no scores', () => {
    expect(friendsLoveUnseen(myLibrary, ratingOf, {})).toEqual([])
    expect(friendsLoveUnseen(myLibrary, ratingOf, { shelfOnly: friends.shelfOnly })).toEqual([])
  })
})

describe('published viewings (where and when)', () => {
  it('carries every viewing newest-first with its medium', () => {
    const library = [entry(1, 'Rewatched', 9, {
      at: NOW,
      medium: 'Theater',
      extraViewings: [{ date: NOW - 100000, calculatedTotal: 8, medium: 'Bluray' }]
    })]
    const profile = buildSocialProfile(library, ratingOf, { name: 'Matt', shareRatings: true })

    expect(profile.ratings[1].v).toEqual([
      { at: NOW, m: 'Theater' },
      { at: NOW - 100000, m: 'Bluray' }
    ])
    // The recent shelf shows the medium of the latest viewing.
    expect(profile.recent[0].m).toBe('Theater')
  })

  it('omits the medium key when a viewing has none, rather than writing null', () => {
    const profile = buildSocialProfile([entry(1, 'No Medium', 7)], ratingOf, { name: 'Matt', shareRatings: true })
    expect(profile.ratings[1].v).toEqual([{ at: NOW - 1000 }])
    expect(profile.recent[0].m).toBeUndefined()
  })

  it('skips viewings with unusable dates', () => {
    const library = [{
      dbKey: 'k1',
      movie: { id: 1, title: 'Undated', poster_path: '/1.jpg', release_date: '2000-06-15' },
      ratings: [{ calculatedTotal: 7 }]
    }]
    const profile = buildSocialProfile(library, ratingOf, { name: 'Matt', shareRatings: true })
    expect(profile.ratings[1].v).toBeUndefined()
  })
})
