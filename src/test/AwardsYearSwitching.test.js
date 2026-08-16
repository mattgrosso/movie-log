import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import PersonalAwardsModal from '@/components/PersonalAwardsModal.vue'

// The year strip on /awards changes ?year=, which changes the selectedYear
// prop on an ALREADY-MOUNTED modal — same route, so nothing remounts and
// openModal() never runs again. Without a watcher the strip is inert: the
// pill highlights, the URL changes, and the page keeps showing the old year.
// (Matt, 2026-08-16: "it would also be nice if at the top there was a quick
// way to switch to other years.")

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

function libraryFor (years) {
  return years.flatMap((year) =>
    Array.from({ length: 10 }, (_, i) => movieEntry(`${year}-${i}`, `Film ${year}-${i}`, year))
  )
}

const SAVED = {
  1997: {
    categories: {
      bestPicture: { nominees: [{ type: 'movie', movieId: '1997-0' }], winner: { type: 'movie', movieId: '1997-0' } }
    }
  },
  2001: {
    categories: {
      bestPicture: {
        nominees: [{ type: 'movie', movieId: '2001-0' }, { type: 'movie', movieId: '2001-1' }],
        winner: { type: 'movie', movieId: '2001-1' }
      }
    }
  }
}

function factory ({ selectedYear = 1997 } = {}) {
  const store = reactive({
    state: {
      settings: { personalAwards: SAVED },
      settingsLoaded: true,
      databaseTopKey: 'mattgrosso-gmail-com',
      weights: []
    },
    dispatch: vi.fn(),
    commit: vi.fn()
  })

  const wrapper = mount(PersonalAwardsModal, {
    props: {
      allEntriesWithFlatKeywordsAdded: libraryFor([1997, 2001]),
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

describe('PersonalAwardsModal — switching years without remounting', () => {
  it('loads the newly selected year and its saved awards', async () => {
    const { wrapper } = factory({ selectedYear: 1997 })
    expect(wrapper.vm.currentYear).toBe(1997)
    expect(wrapper.vm.awardsData.bestPicture.nominees).toHaveLength(1)

    await wrapper.setProps({ selectedYear: 2001 })
    await nextTick()

    expect(wrapper.vm.currentYear).toBe(2001)
    expect(wrapper.vm.awardsData.bestPicture.nominees).toHaveLength(2)
  })

  it('drops the open category and cached options, which belonged to the old year', async () => {
    const { wrapper } = factory({ selectedYear: 1997 })
    wrapper.vm.selectedCategory = 'bestPicture'
    wrapper.vm.optionsCache = { '1997-bestPicture': [{ movieId: '1997-0' }] }

    await wrapper.setProps({ selectedYear: 2001 })
    await nextTick()

    expect(wrapper.vm.selectedCategory).toBeNull()
    expect(wrapper.vm.optionsCache).toEqual({})
  })

  it('tells the page which year it is showing, so the strip can highlight it', async () => {
    const { wrapper } = factory({ selectedYear: 1997 })
    // The watcher is pre-flush, so the mount-time year arrives a tick later.
    await nextTick()
    expect(wrapper.emitted('yearChanged').at(-1)).toEqual([1997])

    await wrapper.setProps({ selectedYear: 2001 })
    await nextTick()

    expect(wrapper.emitted('yearChanged').at(-1)).toEqual([2001])
  })

  // The rule this whole flow has broken before: the modal must never close
  // by itself. Only "Complete Awards" ends a year.
  it('stays open across a year change', async () => {
    const { wrapper } = factory({ selectedYear: 1997 })

    await wrapper.setProps({ selectedYear: 2001 })
    await nextTick()

    expect(wrapper.vm.showModal).toBe(true)
    expect(wrapper.emitted('closed')).toBeUndefined()
  })

  it('ignores a null year rather than blanking the page', async () => {
    const { wrapper } = factory({ selectedYear: 1997 })

    await wrapper.setProps({ selectedYear: null })
    await nextTick()

    expect(wrapper.vm.currentYear).toBe(1997)
  })
})
