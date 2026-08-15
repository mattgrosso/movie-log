import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import PersonalAwardsModal from '@/components/PersonalAwardsModal.vue'

// Regression guard for the cold-boot blank-awards bug (live-reproduced after
// tapping the update banner's Refresh while on /awards): the modal auto-opens
// at mount, before the library/settings have loaded, so openModal() snapshots
// currentYear = null and initializeAwardsData() reads empty settings — and
// nothing ever re-ran either. The page sat year-less with 0 nominees in every
// category even after the store finished loading (1,372 movies, 47 award
// years). These tests feed data in AFTER mount and assert the page heals.

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({ calculatedTotal: 7 })),
  getAllRatings: vi.fn(() => [])
}))
vi.mock('@/services/ErrorLogService.js', () => ({ default: { error: vi.fn() } }))

function movieEntry (id, title, year) {
  return {
    movie: {
      id,
      title,
      release_date: `${year}-06-15`,
      poster_path: `/${id}.jpg`,
      crew: [],
      cast: [],
      flatKeywords: []
    },
    ratings: [{ calculatedTotal: 7, date: 1700000000000 }]
  }
}

const SAVED_2015 = {
  2015: {
    categories: {
      bestPicture: {
        nominees: [{ movieId: 101 }],
        winner: { movieId: 101 },
        noNominees: false
      }
    },
    completed: true
  }
}

function factory ({ entries = [], settings = {}, settingsLoaded = false, selectedYear = null } = {}) {
  const store = reactive({
    state: {
      settings,
      settingsLoaded,
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
      selectedYear
    },
    global: {
      mocks: { $store: store },
      stubs: { Modal: true, Teleport: true }
    }
  })
  return { wrapper, store }
}

describe('PersonalAwardsModal — cold-boot recovery', () => {
  it('adopts a year once the library arrives after mount (no year in the URL)', async () => {
    const { wrapper } = factory({ entries: [] })

    // The broken state this guards against: opened with nothing loaded.
    expect(wrapper.vm.showModal).toBe(true)
    expect(wrapper.vm.currentYear).toBeNull()

    // Library lands late — a year needs >= 10 rated films to be eligible.
    const library = Array.from({ length: 10 }, (_, i) => movieEntry(100 + i, `Film ${i}`, 2015))
    await wrapper.setProps({ allEntriesWithFlatKeywordsAdded: library })
    await nextTick()

    expect(wrapper.vm.currentYear).toBe(2015)
  })

  it('re-reads saved awards once settings arrive after mount (year known from URL)', async () => {
    const { wrapper, store } = factory({
      entries: [movieEntry(101, 'Sicario', 2015)],
      selectedYear: 2015
    })

    // Mount-time init ran against empty settings: blank slate.
    expect(wrapper.vm.currentYear).toBe(2015)
    expect(Object.keys(wrapper.vm.awardsData)).toHaveLength(0)

    // Settings land late (the exact order seen in the live repro).
    store.state.settings = { personalAwards: SAVED_2015 }
    store.state.settingsLoaded = true
    await nextTick()

    expect(wrapper.vm.awardsData.bestPicture).toBeTruthy()
    expect(wrapper.vm.awardsData.bestPicture.nominees.length).toBe(1)
  })

  it('never clobbers edits already made this session when settings arrive', async () => {
    const { wrapper, store } = factory({
      entries: [movieEntry(101, 'Sicario', 2015)],
      selectedYear: 2015
    })

    const userPick = { nominees: [{ movieId: 999 }], winner: null, noNominees: false }
    wrapper.vm.awardsData = { bestDirector: userPick }

    store.state.settings = { personalAwards: SAVED_2015 }
    store.state.settingsLoaded = true
    await nextTick()

    // The in-session edit survives; the late snapshot does not overwrite it.
    expect(wrapper.vm.awardsData.bestDirector).toEqual(userPick)
    expect(wrapper.vm.awardsData.bestPicture).toBeUndefined()
  })

  it("moves on from a completed daily pick: yesterday-morning's sticky year must not banner after completion", async () => {
    // Bug: Home passed the persisted dailyAwardsYear through :selectedYear,
    // the picker's unconditional explicit-intent branch. After Matt completed
    // 1981 mid-morning, the banner kept offering 1981 (finished, no new
    // movies to list) instead of the genuinely incomplete year.
    const lib1981 = Array.from({ length: 10 }, (_, i) => movieEntry(200 + i, `Old ${i}`, 1981))
    const lib2023 = Array.from({ length: 10 }, (_, i) => movieEntry(300 + i, `New ${i}`, 2023))
    const { wrapper } = factory({
      entries: [...lib1981, ...lib2023],
      settings: {
        dailyAwardsYear: 1981,
        dailyAwardsYearDate: new Date().toDateString(),
        personalAwards: {
          1981: {
            completed: true,
            lastUpdated: Date.now(),
            availableMovieIds: lib1981.map((e) => e.movie.id),
            categories: { bestPicture: { nominees: [{ movieId: 201 }], winner: { movieId: 201 } } }
          }
        }
      },
      settingsLoaded: true
    })
    await nextTick()

    expect(wrapper.vm.firstEligibleYear).toBe(2023)
  })
})
