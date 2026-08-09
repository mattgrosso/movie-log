import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TweakInline from '@/components/TweakInline.vue'

vi.mock('@/assets/javascript/GetRating.js', () => ({
  // Folds tweakValue in, same as the real GetRating.js, so a fixture's tie
  // can be tested as "resolved" by giving it a non-zero tweakValue.
  getRating: vi.fn((movie) => ({
    calculatedTotal: movie.ratings[0].calculatedTotal + (movie.ratings[0].tweakValue || 0)
  }))
}))

function movie (dbKey, title, calculatedTotal, tweakValue = 0) {
  return {
    dbKey,
    movie: { id: dbKey, title, poster_path: `/${dbKey}.jpg` },
    ratings: [{ calculatedTotal, date: '2024-01-01', tweakValue }]
  }
}

function mountTweak (movies, { tieBreakTournament = null } = {}) {
  const dispatch = vi.fn()
  const mockStore = {
    state: { currentLog: 'movieLog', settings: { tieBreakTournament } },
    getters: { allMoviesAsArray: movies },
    dispatch
  }

  const wrapper = mount(TweakInline, {
    global: { mocks: { $store: mockStore } },
    props: { allEntriesWithFlatKeywordsAdded: movies, showTweakModal: true }
  })

  return { wrapper, dispatch, mockStore }
}

// Finds the value most recently dispatched to a given settings/movieLog path.
function lastDispatchTo (dispatch, path) {
  const call = [...dispatch.mock.calls].reverse().find(([, entry]) => entry.path === path)
  return call ? call[1].value : undefined
}

describe('TweakInline', () => {
  describe('no ties present', () => {
    it('renders nothing', () => {
      const { wrapper } = mountTweak([movie('a', 'A', 9), movie('b', 'B', 7)])
      expect(wrapper.find('.tweak-inline').exists()).toBe(false)
    })
  })

  describe('a fresh 2-way tie', () => {
    it('auto-starts and persists a tournament on mount', () => {
      const { dispatch } = mountTweak([movie('a', 'A', 8), movie('b', 'B', 8)])
      const tournament = lastDispatchTo(dispatch, 'settings/tieBreakTournament')
      expect(tournament.contestantIds.sort()).toEqual(['a', 'b'])
      expect(tournament.schedule).toEqual([{ a: 'a', b: 'b' }])
    })

    it('shows the notice first, then the matchup after tapping it, with no contestant-count/progress narration for a single match', async () => {
      const { wrapper } = mountTweak([movie('a', 'A', 8), movie('b', 'B', 8)])
      expect(wrapper.text()).toContain('You have a tie to deal with')

      await wrapper.find('.tweak-container').trigger('click')
      expect(wrapper.findAll('.poster-container')).toHaveLength(2)
      // A 2-way tie is exactly one match — not really a "tournament", so no
      // "N contestants · match X of Y" ceremony (per bug report feedback).
      expect(wrapper.text()).not.toContain('contestants')
      expect(wrapper.text()).not.toContain('match 1 of 1')
    })

    it('picking a winner (the only match) applies the result and skips straight past the results screen — no "Done" tap needed', async () => {
      const { wrapper, dispatch } = mountTweak([movie('a', 'A', 8), movie('b', 'B', 8)])
      await wrapper.find('.tweak-container').trigger('click')

      await wrapper.findAll('.poster-container')[0].trigger('click')

      // Winner (rank 0) untouched, loser (rank 1) gets the -0.05 penalty —
      // matching the old single-pair tiebreak's behavior exactly for N=2.
      const loserUpdate = lastDispatchTo(dispatch, 'movieLog/b')
      expect(loserUpdate.ratings[0].tweakValue).toBeCloseTo(-0.05)
      expect(lastDispatchTo(dispatch, 'movieLog/a')).toBeUndefined()

      // No "Tournament Complete!" standings screen/Done tap for a 2-way tie
      // — per bug report feedback, it should just apply and move on.
      expect(wrapper.text()).not.toContain('Tournament Complete!')
      expect(dispatch).toHaveBeenCalledWith('writeDurably', { path: 'settings/tieBreakTournament', value: null })
    })

    it('always closes and stamps the daily-quota clock once a 2-way tie resolves, even when another tied group exists (bug report: "it didn\'t actually close... that should count as my tiebreak for this time")', async () => {
      // In this fixture, dispatch is a spy only — the underlying movies array
      // never actually changes score — so after the fast-path clears the
      // tournament, the SAME pair still reads as tied. Previously this used
      // to auto-start a fresh tournament for it and show the next match
      // immediately, with no visual break - confusing, and it meant the
      // daily-quota clock never got a chance to reset. Now it always closes
      // here, regardless of whether another tied group exists; the next
      // scan (whenever the quota next allows) picks it up fresh.
      const { wrapper, dispatch } = mountTweak([movie('a', 'A', 8), movie('b', 'B', 8)])
      await wrapper.find('.tweak-container').trigger('click')
      await wrapper.findAll('.poster-container')[0].trigger('click')

      expect(wrapper.text()).not.toContain('Tournament Complete!')
      expect(wrapper.vm.showTweakInline).toBe(false)
      expect(dispatch).toHaveBeenCalledWith('writeDurably', { path: 'settings/lastTweak', value: expect.any(Number) })
    })

    it('does not offer "Save for later" for a single-match (2-way) tie', async () => {
      const { wrapper } = mountTweak([movie('a', 'A', 8), movie('b', 'B', 8)])
      await wrapper.find('.tweak-container').trigger('click')
      expect(wrapper.find('.save-for-later-btn').exists()).toBe(false)
    })
  })

  describe('selection checkmark (bug report: "I do want an indication that I have clicked on one")', () => {
    it('sets selectedDbKey to the tapped poster synchronously, driving the checkmark badge before the save resolves', () => {
      const { wrapper } = mountTweak([movie('a', 'A', 8), movie('b', 'B', 8)])
      wrapper.vm.showTweakInline = true
      const winner = wrapper.vm.firstResult
      wrapper.vm.chooseWinner(winner) // deliberately not awaited
      expect(wrapper.vm.selectedDbKey).toBe(winner.dbKey)
    })

    it('clears selectedDbKey once the winner has been fully processed', async () => {
      const { wrapper } = mountTweak([movie('a', 'A', 8), movie('b', 'B', 8)])
      wrapper.vm.showTweakInline = true
      await wrapper.vm.chooseWinner(wrapper.vm.firstResult)
      expect(wrapper.vm.selectedDbKey).toBeNull()
    })

    it('renders the checkmark only on the poster matching selectedDbKey', async () => {
      const { wrapper } = mountTweak([movie('a', 'A', 7), movie('b', 'B', 7), movie('c', 'C', 7), movie('d', 'D', 7)])
      await wrapper.find('.tweak-container').trigger('click')
      wrapper.vm.selectedDbKey = wrapper.vm.firstResult.dbKey
      await wrapper.vm.$nextTick()

      const posters = wrapper.findAll('.poster-container')
      expect(posters[0].find('.selected-checkmark').exists()).toBe(true)
      expect(posters[1].find('.selected-checkmark').exists()).toBe(false)
    })
  })

  describe('poster prefetching (bug report: "swaps out one of the posters, but not the other one... pre-cache the next setup")', () => {
    let originalImage
    let createdImages

    beforeEach(() => {
      originalImage = global.Image
      createdImages = []
      global.Image = vi.fn(function FakeImage () {
        createdImages.push(this)
      })
    })

    afterEach(() => {
      global.Image = originalImage
    })

    it('warms the browser image cache for every contestant as soon as a tournament is created', () => {
      mountTweak([movie('a', 'A', 8), movie('b', 'B', 8)])
      const srcs = createdImages.map((img) => img.src)
      expect(srcs).toContain('https://image.tmdb.org/t/p/w500/a.jpg')
      expect(srcs).toContain('https://image.tmdb.org/t/p/w500/b.jpg')
    })

    it('also warms the cache on mount when resuming an already-persisted tournament (e.g. after a page reload)', () => {
      const movies = [movie('a', 'A', 8), movie('b', 'B', 8), movie('c', 'C', 8)]
      const mockStore = {
        state: {
          currentLog: 'movieLog',
          settings: { tieBreakTournament: { contestantIds: ['a', 'b', 'c'], schedule: [], results: [] } }
        },
        getters: { allMoviesAsArray: movies },
        dispatch: vi.fn()
      }
      mount(TweakInline, {
        global: { mocks: { $store: mockStore } },
        props: { allEntriesWithFlatKeywordsAdded: movies, showTweakModal: true }
      })

      const srcs = createdImages.map((img) => img.src)
      expect(srcs).toContain('https://image.tmdb.org/t/p/w500/a.jpg')
      expect(srcs).toContain('https://image.tmdb.org/t/p/w500/b.jpg')
      expect(srcs).toContain('https://image.tmdb.org/t/p/w500/c.jpg')
    })
  })

  describe('a 4-way tie', () => {
    function fourWayMovies () {
      return [movie('a', 'A', 7), movie('b', 'B', 7), movie('c', 'C', 7), movie('d', 'D', 7)]
    }

    it('schedules all 6 round-robin matches and shows progress', async () => {
      const { wrapper } = mountTweak(fourWayMovies())
      await wrapper.find('.tweak-container').trigger('click')
      expect(wrapper.text()).toContain('4 contestants')
      expect(wrapper.text()).toContain('match 1 of 6')
    })

    it('walks through all 6 matches then shows a full final ranking with score adjustments applied once', async () => {
      const { wrapper, dispatch } = mountTweak(fourWayMovies())
      await wrapper.find('.tweak-container').trigger('click')

      // 'a' wins every match it's in; among the rest, whoever is posed first wins.
      for (let i = 0; i < 6; i++) {
        expect(wrapper.text()).not.toContain('Tournament Complete!')
        await wrapper.findAll('.poster-container')[0].trigger('click')
      }

      expect(wrapper.text()).toContain('Tournament Complete!')
      expect(wrapper.findAll('.tournament-results li')).toHaveLength(4)

      // No movie should receive more than one score-adjustment dispatch —
      // the whole standing is applied once, in a single batch, at the end.
      const movieDispatches = dispatch.mock.calls.filter(([, entry]) => entry.path.startsWith('movieLog/'))
      const paths = movieDispatches.map(([, entry]) => entry.path)
      expect(new Set(paths).size).toBe(paths.length)
    })

    it('does NOT reset the daily-quota clock between matches — the whole tournament runs in one sitting by default', async () => {
      const { wrapper, dispatch } = mountTweak(fourWayMovies())
      await wrapper.find('.tweak-container').trigger('click')

      for (let i = 0; i < 5; i++) {
        await wrapper.findAll('.poster-container')[0].trigger('click')
      }
      // 5 of 6 matches done — tournament still in progress.
      expect(wrapper.text()).not.toContain('Tournament Complete!')
      expect(dispatch).not.toHaveBeenCalledWith('writeDurably', { path: 'settings/lastTweak', value: expect.any(Number) })

      // The 6th (final) match completes the tournament but still doesn't
      // stamp the clock — that only happens once the results are acknowledged.
      await wrapper.findAll('.poster-container')[0].trigger('click')
      expect(wrapper.text()).toContain('Tournament Complete!')
      expect(dispatch).not.toHaveBeenCalledWith('writeDurably', { path: 'settings/lastTweak', value: expect.any(Number) })

      dispatch.mockClear()
      await wrapper.find('.btn').trigger('click') // "Done"
      expect(dispatch).toHaveBeenCalledWith('writeDurably', { path: 'settings/lastTweak', value: expect.any(Number) })
    })

    it('offers "Save for later" mid-tournament — tapping it pauses without losing progress', async () => {
      const { wrapper, dispatch } = mountTweak(fourWayMovies())
      await wrapper.find('.tweak-container').trigger('click')
      await wrapper.findAll('.poster-container')[0].trigger('click') // 1 of 6 matches done

      const saveBtn = wrapper.find('.save-for-later-btn')
      expect(saveBtn.exists()).toBe(true)
      await saveBtn.trigger('click')

      // Collapses back to the notice, resets the quota clock...
      expect(wrapper.find('.tweak-container').text()).toContain('You have a tie to deal with')
      expect(dispatch).toHaveBeenCalledWith('writeDurably', { path: 'settings/lastTweak', value: expect.any(Number) })
      // ...but does NOT clear the tournament — progress is preserved.
      expect(dispatch).not.toHaveBeenCalledWith('writeDurably', { path: 'settings/tieBreakTournament', value: null })

      // Reopening resumes the SAME tournament, one match further along.
      await wrapper.find('.tweak-container').trigger('click')
      expect(wrapper.text()).toContain('match 2 of 6')
    })

    // Bug report: a large tournament's final match "seemed frozen for 5-6
    // seconds" with no indication anything was happening. Two fixes: (1)
    // allMoviesRanked no longer does an O(n) getRating() call PER COMPARISON
    // across the whole library (see the sortResultsFast switch), and (2) the
    // spinner now genuinely tracks the score-adjustment writes instead of
    // flipping back to false the instant they're merely kicked off.
    it('keeps "submitting" true (and Done disabled) until every final-score write actually resolves', async () => {
      const dispatch = vi.fn()
      let resolveLastWrite
      dispatch.mockImplementation((action, entry) => {
        if (entry.path === 'movieLog/d') {
          return new Promise((resolve) => { resolveLastWrite = resolve })
        }
        return Promise.resolve()
      })
      const movies = fourWayMovies()
      const mockStore = {
        state: { currentLog: 'movieLog', settings: { tieBreakTournament: null } },
        getters: { allMoviesAsArray: movies },
        dispatch
      }
      const wrapper = mount(TweakInline, {
        global: { mocks: { $store: mockStore } },
        props: { allEntriesWithFlatKeywordsAdded: movies, showTweakModal: true }
      })

      await wrapper.find('.tweak-container').trigger('click')
      for (let i = 0; i < 6; i++) {
        await wrapper.findAll('.poster-container')[0].trigger('click')
      }

      // The results screen renders immediately (finalRanking is local/sync)...
      expect(wrapper.text()).toContain('Tournament Complete!')
      // ...but the save is still in flight (movieLog/d's write hasn't resolved).
      expect(wrapper.text()).toContain('Saving final scores')
      expect(wrapper.find('.tournament-results').exists()).toBe(true)
      const doneBtn = wrapper.find('.btn')
      expect(doneBtn.attributes('disabled')).toBeDefined()

      resolveLastWrite()
      await vi.waitFor(() => expect(wrapper.text()).not.toContain('Saving final scores'))
      expect(wrapper.find('.btn').attributes('disabled')).toBeUndefined()
    })
  })

  describe('an already-running tournament (freeze-out)', () => {
    it('does not start a new tournament, and ignores a movie that newly ties with the frozen group', () => {
      const existingTournament = {
        contestantIds: ['a', 'b'],
        schedule: [{ a: 'a', b: 'b' }],
        nextIndex: 0,
        wins: { a: 0, b: 0 },
        startedAt: Date.now(),
        finalRanking: null,
        completedAt: null
      }

      // 'c' now also has the same score as a/b, but the tournament already
      // in progress must not be touched or have 'c' merged into it.
      const movies = [movie('a', 'A', 8), movie('b', 'B', 8), movie('c', 'C', 8)]
      const { wrapper, dispatch } = mountTweak(movies, { tieBreakTournament: existingTournament })

      expect(dispatch).not.toHaveBeenCalledWith('writeDurably', expect.objectContaining({ path: 'settings/tieBreakTournament' }))

      const notice = wrapper.find('.tweak-container')
      expect(notice.exists()).toBe(true)
    })
  })

  // Regression test for a real bug report: with "force tiebreak to show" on
  // in settings, the showTweakModal PROP is pinned true and never toggles.
  // The original trigger was a watcher on showTweakModal *changing*, so it
  // fired once on mount and never again — after finishing one tournament,
  // the "you have another tie" notice would render but tapping it crashed/
  // went blank because no tournament existed for it to display.
  describe('showTweakModal pinned true throughout (forced-mode simulation)', () => {
    it('auto-starts the next tournament after Done, without showTweakModal ever toggling', async () => {
      // A 3-way tie, deliberately NOT 2-way — a 2-way tie now skips the
      // results screen/Done button entirely (see above), which would no
      // longer exercise the thing this regression test is actually about:
      // acknowledgeResults's watcher-independent restart after a Done tap.
      const movies = [movie('a', 'A', 8), movie('b', 'B', 8), movie('c', 'C', 8)]
      const { wrapper, dispatch } = mountTweak(movies) // showTweakModal: true, fixed prop, never changes

      await wrapper.find('.tweak-container').trigger('click')
      for (let i = 0; i < 3; i++) {
        await wrapper.findAll('.poster-container')[0].trigger('click')
      }
      expect(wrapper.text()).toContain('Tournament Complete!')

      dispatch.mockClear()
      await wrapper.find('.btn').trigger('click') // "Done"

      // A fresh tournament must exist immediately — not "eventually", and
      // not left null waiting for a prop change that will never come.
      const restarted = [...dispatch.mock.calls].reverse().find(([, e]) => e.path === 'settings/tieBreakTournament')
      expect(restarted[1].value).not.toBeNull()

      // Tapping the notice must show an actual, playable matchup — not a
      // blank/crashed panel.
      await wrapper.find('.tweak-container').trigger('click')
      expect(wrapper.findAll('.poster-container')).toHaveLength(2)
      expect(wrapper.text()).not.toContain('Tournament Complete!')
    })
  })
})
