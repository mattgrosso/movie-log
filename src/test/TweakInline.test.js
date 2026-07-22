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

      // Winner (rank 0) untouched, loser (rank 1) gets the -0.1 penalty —
      // matching the old single-pair tiebreak's behavior exactly for N=2.
      const loserUpdate = lastDispatchTo(dispatch, 'movieLog/b')
      expect(loserUpdate.ratings[0].tweakValue).toBeCloseTo(-0.1)
      expect(lastDispatchTo(dispatch, 'movieLog/a')).toBeUndefined()

      // No "Tournament Complete!" standings screen/Done tap for a 2-way tie
      // — per bug report feedback, it should just apply and move on.
      expect(wrapper.text()).not.toContain('Tournament Complete!')
      expect(dispatch).toHaveBeenCalledWith('setDBValue', { path: 'settings/tieBreakTournament', value: null })
    })

    it('moves straight on to the next matchup (no re-tap of the notice needed) when another tied group already exists', async () => {
      // In this fixture, dispatch is a spy only — the underlying movies array
      // never actually changes score — so after the fast-path clears the
      // tournament, the SAME pair still reads as tied and a fresh tournament
      // is started for it right away, demonstrating the "move onto the next
      // one" behavior without requiring the notice to be re-tapped.
      const { wrapper, dispatch } = mountTweak([movie('a', 'A', 8), movie('b', 'B', 8)])
      await wrapper.find('.tweak-container').trigger('click')
      await wrapper.findAll('.poster-container')[0].trigger('click')

      expect(wrapper.text()).not.toContain('Tournament Complete!')
      expect(wrapper.text()).not.toContain('You have a tie to deal with')
      expect(wrapper.findAll('.poster-container')).toHaveLength(2)

      // Chaining straight into another tied group's match is not a stopping
      // point — the daily-quota clock must NOT reset here (that would hide
      // the very matchup just shown).
      expect(dispatch).not.toHaveBeenCalledWith('setDBValue', { path: 'settings/lastTweak', value: expect.any(Number) })
    })

    it('stamps the daily-quota clock once a 2-way tie resolves and there is genuinely nothing left to chain into', async () => {
      const { wrapper, dispatch } = mountTweak([movie('a', 'A', 8), movie('b', 'B', 8)])
      // Force the "nothing left" branch deterministically rather than relying
      // on the fixture's tie disappearing (it can't, in this static mock —
      // see the sibling test above).
      vi.spyOn(wrapper.vm, 'ensureTournamentStarted').mockReturnValue(false)

      await wrapper.find('.tweak-container').trigger('click')
      await wrapper.findAll('.poster-container')[0].trigger('click')

      expect(dispatch).toHaveBeenCalledWith('setDBValue', { path: 'settings/lastTweak', value: expect.any(Number) })
    })

    it('does not offer "Save for later" for a single-match (2-way) tie', async () => {
      const { wrapper } = mountTweak([movie('a', 'A', 8), movie('b', 'B', 8)])
      await wrapper.find('.tweak-container').trigger('click')
      expect(wrapper.find('.save-for-later-btn').exists()).toBe(false)
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
      expect(dispatch).not.toHaveBeenCalledWith('setDBValue', { path: 'settings/lastTweak', value: expect.any(Number) })

      // The 6th (final) match completes the tournament but still doesn't
      // stamp the clock — that only happens once the results are acknowledged.
      await wrapper.findAll('.poster-container')[0].trigger('click')
      expect(wrapper.text()).toContain('Tournament Complete!')
      expect(dispatch).not.toHaveBeenCalledWith('setDBValue', { path: 'settings/lastTweak', value: expect.any(Number) })

      dispatch.mockClear()
      await wrapper.find('.btn').trigger('click') // "Done"
      expect(dispatch).toHaveBeenCalledWith('setDBValue', { path: 'settings/lastTweak', value: expect.any(Number) })
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
      expect(dispatch).toHaveBeenCalledWith('setDBValue', { path: 'settings/lastTweak', value: expect.any(Number) })
      // ...but does NOT clear the tournament — progress is preserved.
      expect(dispatch).not.toHaveBeenCalledWith('setDBValue', { path: 'settings/tieBreakTournament', value: null })

      // Reopening resumes the SAME tournament, one match further along.
      await wrapper.find('.tweak-container').trigger('click')
      expect(wrapper.text()).toContain('match 2 of 6')
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

      expect(dispatch).not.toHaveBeenCalledWith('setDBValue', expect.objectContaining({ path: 'settings/tieBreakTournament' }))

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
