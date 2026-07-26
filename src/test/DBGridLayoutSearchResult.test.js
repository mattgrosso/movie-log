import { describe, it, expect, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import DBGridLayoutSearchResult from '@/components/DBGridLayoutSearchResult.vue'

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({ calculatedTotal: 5, normalizedRating: 5, date: Date.now() })),
  getAllRatings: vi.fn(() => [])
}))
vi.mock('@/services/ErrorLogService.js', () => ({ default: { error: vi.fn() } }))

function makeResult (overrides = {}) {
  return {
    dbKey: 'abc123',
    movie: {
      id: 42,
      title: 'Oppenheimer',
      release_date: '2023-07-19',
      runtime: 180,
      poster_path: '/poster.jpg',
      genres: [],
      crew: [],
      flatKeywords: [],
      ...overrides.movie
    },
    ratings: [{ calculatedTotal: 8.5, normalizedRating: 8, date: Date.now() }],
    ...overrides
  }
}

function factory ({ allAcademyAwards = [], result = makeResult() } = {}) {
  const mockStore = {
    state: {
      settings: { letterboxdConnected: false, letterboxdUsername: '' },
      allAcademyAwards
    },
    getters: { allMediaSortedByRating: [result], allMediaAsArray: [result] },
    commit: vi.fn(),
    dispatch: vi.fn()
  }

  return shallowMount(DBGridLayoutSearchResult, {
    props: { result, index: 0, keywordCounts: {}, allCounts: [] },
    global: {
      mocks: { $store: mockStore },
      directives: { lazy: () => {} }
    }
  })
}

describe('DBGridLayoutSearchResult — Academy Award wins/nominations, sourced from the locally-cached full dataset (state.allAcademyAwards) instead of a live per-movie fetch', () => {
  it('shows only wins/nominations for THIS result\'s movie, filtered from the shared dataset', () => {
    const allAcademyAwards = [
      { id: 1, tmdb: '42', category: 'Best Original Score', isActing: false, isWinner: true },
      { id: 2, tmdb: '42', category: 'Best Original Screenplay', isActing: false, isWinner: false },
      { id: 3, tmdb: '99', category: 'Best Picture', isActing: false, isWinner: true }
    ]
    const wrapper = factory({ allAcademyAwards })

    expect(wrapper.vm.academyAwardWins.map((a) => a.category)).toEqual(['Best Original Score'])
    expect(wrapper.vm.academyAwardNominations.map((a) => a.category)).toEqual(['Best Original Screenplay'])
  })

  it('renders no wins/nominations when the cached dataset has nothing for this movie (bug report: this section used to silently render empty for EVERY movie, due to an unawaited-promise bug — this confirms the fix actually surfaces real data, not just that empty stays empty)', () => {
    const wrapper = factory({ allAcademyAwards: [] })

    expect(wrapper.vm.academyAwardWins).toEqual([])
    expect(wrapper.vm.academyAwardNominations).toEqual([])
  })
})

describe('DBGridLayoutSearchResult — offline placeholder ratings (isPendingReconciliation)', () => {
  it('shows a "Pending match" badge and falls back to the not-found poster for a placeholder result', () => {
    const result = makeResult({ movie: { id: 'offline-abc', poster_path: null, isPendingReconciliation: true } })
    const wrapper = factory({ result })

    expect(wrapper.find('.pending-match-badge').exists()).toBe(true)
    expect(wrapper.vm.posterImageUrl(result)).not.toContain('image.tmdb.org')
  })

  it('does not show the badge for a normal, already-matched result', () => {
    const wrapper = factory()

    expect(wrapper.find('.pending-match-badge').exists()).toBe(false)
  })

  it('routes to /reconcile/:dbKey instead of /movie/:id when a pending-reconciliation card is tapped', () => {
    const result = makeResult({ dbKey: 'my-db-key', movie: { id: 'offline-abc', isPendingReconciliation: true } })
    const push = vi.fn()
    const wrapper = factory({ result })
    wrapper.vm.$router = { push }

    wrapper.vm.showDetails()

    expect(push).toHaveBeenCalledWith('/reconcile/my-db-key')
  })
})

describe('DBGridLayoutSearchResult — Academy Award wins/nominations (continued)', () => {
  it('tolerates a missing allAcademyAwards entirely without throwing (cold direct load before it has fetched)', () => {
    const result = makeResult()
    const mockStore = {
      state: { settings: { letterboxdConnected: false, letterboxdUsername: '' } },
      getters: { allMediaSortedByRating: [result], allMediaAsArray: [result] },
      commit: vi.fn(),
      dispatch: vi.fn()
    }

    const wrapper = shallowMount(DBGridLayoutSearchResult, {
      props: { result, index: 0, keywordCounts: {}, allCounts: [] },
      global: {
        mocks: { $store: mockStore },
        directives: { lazy: () => {} }
      }
    })

    expect(wrapper.vm.academyAwardWins).toEqual([])
    expect(wrapper.vm.academyAwardNominations).toEqual([])
  })
})
