import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Home from '@/components/Home.vue'

// THE STANDING RULE (Matt, 2026-08-30): "anytime that I report a bug on not
// being able to find a specific movie, we need to write a test to ensure that
// we don't regress on any of these changes."
//
// This file is that roster. One describe block per report, encoding the
// LITERAL searches from the report as typed text (the way he actually
// searches — not pre-built chips), asserted through the DOM. When a new
// unfindable-movie report lands, add its block here; never delete an old one.
// Mechanism-level tests live next to their code (ShortsSearchRescue,
// searchFiltering); this file exists so the exact reported experience can
// never silently come back.

vi.mock('axios', () => ({
  default: {
    post: vi.fn(() => Promise.resolve({ data: {} })),
    get: vi.fn(() => Promise.resolve({ data: {} }))
  }
}))

// The three films from report -P0Jz3pTqFQuw, shaped like the real library
// entries (runtimes matter: two are shorts).
const vengeanceMostFowl = {
  movie: {
    id: 929204,
    title: 'Wallace & Gromit: Vengeance Most Fowl',
    release_date: '2024-12-18',
    runtime: 79,
    genres: [{ name: 'Animation' }],
    cast: [],
    crew: [{ name: 'Nick Park', job: 'Director' }],
    production_companies: [{ name: 'Aardman' }],
    flatKeywords: ['penguin', 'stop motion']
  },
  ratings: [{ calculatedTotal: 8.8, date: '2025-01-01' }],
  dbKey: 'movie-929204'
}

const loafAndDeath = {
  movie: {
    id: 14447,
    title: 'A Matter of Loaf and Death',
    release_date: '2008-12-26',
    runtime: 30,
    genres: [{ name: 'Animation' }],
    cast: [],
    crew: [{ name: 'Nick Park', job: 'Director' }],
    production_companies: [{ name: 'Aardman' }],
    flatKeywords: ['bakery', 'stop motion', 'short film']
  },
  ratings: [{ calculatedTotal: 8.1, date: '2026-08-20' }],
  dbKey: 'movie-14447'
}

const tripToTheMoon = {
  movie: {
    id: 775,
    title: 'A Trip to the Moon',
    release_date: '1902-06-15',
    runtime: 15,
    genres: [{ name: 'Science Fiction' }],
    cast: [],
    crew: [{ name: 'Georges Melies', job: 'Director' }],
    production_companies: [],
    flatKeywords: ['moon', 'short film', 'silent film']
  },
  ratings: [{ calculatedTotal: 8.5, date: '2026-05-01' }],
  dbKey: 'movie-775'
}

function mountHome ({ includeShorts = false } = {}) {
  const movies = [vengeanceMostFowl, loafAndDeath, tripToTheMoon]
  const mockStore = {
    state: {
      dbLoaded: true,
      databaseTopKey: 'test-user',
      currentLog: 'movieLog',
      DBSearchValue: '',
      DBSortValue: 'rating',
      academyAwardWinners: { bestPicture: [] },
      settings: { includeShorts, tags: { 'viewing-tags': {} } },
      filteredResults: [],
      homePageScrollPosition: 0,
      homePageSearchChips: [],
      homePageSearchValue: '',
      homePageNumberOfResults: 25,
      homePageNavigationIntent: null,
      homePageSortValue: null,
      homePageSortOrder: null,
      homePagePromoteGroup: null
    },
    getters: {
      allMediaAsArray: movies,
      allMoviesAsArray: movies,
      allMediaSortedByRating: [...movies].sort((a, b) => b.ratings[0].calculatedTotal - a.ratings[0].calculatedTotal)
    },
    commit: vi.fn(),
    dispatch: vi.fn()
  }

  return mount(Home, {
    global: {
      mocks: { $store: mockStore, $route: { query: {} }, $router: { push: vi.fn() } },
      stubs: {
        DBGridLayoutSearchResult: {
          template: '<div data-testid="db-grid-result">{{ result.movie.title }}</div>',
          props: ['result', 'keywordCounts', 'allCounts', 'index', 'resultsAreFiltered', 'sortValue', 'activeQuickLinkList']
        },
        NoResults: true,
        StickinessModal: true,
        TweakModal: true,
        InsetBrowserModal: true
      }
    }
  })
}

// Typed, not chipped: searchValue is what the input binds, and typed text
// only becomes the implicit general filter when NO chips are active — the
// same path a thumb on a phone takes.
async function typeSearch (wrapper, text) {
  wrapper.vm.searchValue = text
  wrapper.vm.inputValue = text
  await wrapper.vm.$nextTick()
}

const renderedTitles = (wrapper) =>
  wrapper.findAll('[data-testid="db-grid-result"]').map((node) => node.text())

// ---------------------------------------------------------------------------
// Report -P0Jz3pTqFQuw (2026-08-30): "I've searched for a matter of loaf and
// death. I've searched for Wallace and Gromit and I only found one movie and
// I've searched for a trip to the moon which is the name of the movie. I've
// definitely rated the movie and yet it isn't showing up."
//
// Follow-up on the same report: "I went in and toggled the show shorts toggle
// thinking it might be that, but it still wasn't showing up." — the toggle
// couldn't help the Wallace & Gromit query, because '&' vs 'and' was a
// separate bug that ignored the setting entirely.
describe('report -P0Jz3pTqFQuw: the three searches, exactly as typed', () => {
  it('finds "a trip to the moon" with shorts hidden', async () => {
    const wrapper = mountHome({ includeShorts: false })
    await wrapper.vm.$nextTick()
    await typeSearch(wrapper, 'a trip to the moon')

    expect(renderedTitles(wrapper)).toContain('A Trip to the Moon')
  })

  it('finds "a matter of loaf and death" with shorts hidden', async () => {
    const wrapper = mountHome({ includeShorts: false })
    await wrapper.vm.$nextTick()
    await typeSearch(wrapper, 'a matter of loaf and death')

    expect(renderedTitles(wrapper)).toContain('A Matter of Loaf and Death')
  })

  it('finds "wallace and gromit" with shorts hidden — the & title', async () => {
    const wrapper = mountHome({ includeShorts: false })
    await wrapper.vm.$nextTick()
    await typeSearch(wrapper, 'wallace and gromit')

    expect(renderedTitles(wrapper)).toContain('Wallace & Gromit: Vengeance Most Fowl')
  })

  // The toggle scenario. Before the & fold, this rendered NOTHING — turning
  // shorts on fixed only the shorts half, so the toggle looked broken and got
  // toggled straight back off. If this test fails, that experience is back.
  it('finds "wallace and gromit" with shorts SHOWN — the toggle must help, not lie', async () => {
    const wrapper = mountHome({ includeShorts: true })
    await wrapper.vm.$nextTick()
    await typeSearch(wrapper, 'wallace and gromit')

    expect(renderedTitles(wrapper)).toContain('Wallace & Gromit: Vengeance Most Fowl')
  })

  // The other half of the toggle scenario: for the SHORTS the toggle was the
  // right lever all along, and it must keep working.
  it('finds "a trip to the moon" with shorts SHOWN', async () => {
    const wrapper = mountHome({ includeShorts: true })
    await wrapper.vm.$nextTick()
    await typeSearch(wrapper, 'a trip to the moon')

    expect(renderedTitles(wrapper)).toContain('A Trip to the Moon')
  })

  // Documents the "I only found one movie": a bare "gromit" reaches only the
  // one film with Gromit in its TITLE that isn't a hidden short. That is
  // correct behavior — the other G-films are shorts he asked to hide, and
  // "gromit" names none of their titles... except it does name them; they ARE
  // "Wallace & Gromit" films only by franchise, not by stored title. So one
  // result is the truthful answer for this library.
  it('a bare "gromit" shows the feature and leaves hidden shorts hidden', async () => {
    const wrapper = mountHome({ includeShorts: false })
    await wrapper.vm.$nextTick()
    await typeSearch(wrapper, 'gromit')

    const titles = renderedTitles(wrapper)
    expect(titles).toContain('Wallace & Gromit: Vengeance Most Fowl')
    expect(titles).not.toContain('A Matter of Loaf and Death')
  })
})
