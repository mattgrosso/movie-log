import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import PersonalAwardsModal from '@/components/PersonalAwardsModal.vue'

// Feedback: "make the banner image whatever the best picture selection is.
// And if it isn't that... the highest rated movie from the year."
// yearBannerUrl drives the global header banner via setBannerUrl, reactively
// — crowning Best Picture swaps the banner live.

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((entry) => ({ calculatedTotal: entry?.ratings?.[0]?.calculatedTotal ?? 0 })),
  getAllRatings: vi.fn(() => [])
}))
vi.mock('@/services/ErrorLogService.js', () => ({ default: { error: vi.fn() } }))

function movieEntry (id, title, year, rating, backdrop, customBackdrop) {
  const entry = {
    movie: {
      id,
      title,
      release_date: `${year}-06-15`,
      backdrop_path: backdrop,
      poster_path: `/${id}.jpg`,
      crew: [],
      cast: [],
      flatKeywords: []
    },
    ratings: [{ calculatedTotal: rating, date: 1700000000000 }]
  }
  if (customBackdrop) entry.customBackdropPath = customBackdrop
  return entry
}

function factory ({ entries, personalAwards = {} }) {
  const store = reactive({
    state: {
      settings: { personalAwards },
      settingsLoaded: true,
      databaseTopKey: 'mattgrosso-gmail-com',
      weights: []
    },
    dispatch: vi.fn(),
    commit: vi.fn()
  })

  const wrapper = mount(PersonalAwardsModal, {
    props: {
      allEntriesWithFlatKeywordsAdded: entries,
      autoOpen: true,
      pageMode: true,
      selectedYear: 2015
    },
    global: {
      mocks: { $store: store },
      stubs: { Modal: true, Teleport: true }
    }
  })
  return { wrapper, store }
}

const bannerCommits = (store) =>
  store.commit.mock.calls.filter((c) => c[0] === 'setBannerUrl').map((c) => c[1])

describe('awards page banner follows the year', () => {
  const library = [
    movieEntry(1, 'Middling', 2015, 6, '/middling.jpg'),
    movieEntry(2, 'The Favorite', 2015, 9.4, '/favorite.jpg'),
    movieEntry(3, 'Wrong Year Higher', 2016, 9.9, '/wrong-year.jpg')
  ]

  it('uses the Best Picture winner backdrop when one is crowned', async () => {
    const { store } = factory({
      entries: library,
      personalAwards: {
        2015: {
          categories: {
            bestPicture: { nominees: [{ type: 'movie', movieId: 1 }], winner: { type: 'movie', movieId: 1 } }
          }
        }
      }
    })
    await nextTick()

    const urls = bannerCommits(store)
    expect(urls[urls.length - 1]).toBe('https://image.tmdb.org/t/p/w500/middling.jpg')
  })

  it('falls back to the year top-rated movie before Best Picture is decided', async () => {
    const { store } = factory({ entries: library, personalAwards: {} })
    await nextTick()

    const urls = bannerCommits(store)
    expect(urls[urls.length - 1]).toBe('https://image.tmdb.org/t/p/w500/favorite.jpg')
  })

  it('swaps the banner live when Best Picture is crowned', async () => {
    const { wrapper, store } = factory({ entries: library, personalAwards: {} })

    wrapper.vm.awardsData = {
      bestPicture: { nominees: [library[0]], winner: library[0], noNominees: false }
    }
    await nextTick()

    const urls = bannerCommits(store)
    expect(urls[urls.length - 1]).toBe('https://image.tmdb.org/t/p/w500/middling.jpg')
  })

  it('honours a custom backdrop on the winning entry', async () => {
    const withCustom = [movieEntry(7, 'Customized', 2015, 8, '/std.jpg', '/custom.jpg')]
    const { store } = factory({
      entries: withCustom,
      personalAwards: {
        2015: { categories: { bestPicture: { nominees: [{ type: 'movie', movieId: 7 }], winner: { type: 'movie', movieId: 7 } } } }
      }
    })
    await nextTick()

    const urls = bannerCommits(store)
    expect(urls[urls.length - 1]).toBe('https://image.tmdb.org/t/p/w500/custom.jpg')
  })
})
