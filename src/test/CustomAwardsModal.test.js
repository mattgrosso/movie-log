import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import PersonalAwardsModal from '@/components/PersonalAwardsModal.vue'
import { PERSONAL_AWARD_CATEGORIES } from '@/assets/javascript/personalAwardsCategories.js'

// Feature request, 2026-08-20: "It would be cool if for any given personal
// awards here, I could add custom awards. So if I wanted to, I can name an
// award whatever I want and then assign it. So I can basically hand out
// honorary awards."

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

const library = Array.from({ length: 10 }, (_, i) => movieEntry(`1997-${i}`, `Film ${i}`, 1997))

// Renders its slots, so the detail pane is actually in the DOM.
const MODAL_STUB = {
  name: 'Modal',
  template: '<div class="modal-stub"><slot name="header"/><slot name="body"/><slot name="footer"/></div>'
}

function factory ({ saved = {} } = {}) {
  const store = reactive({
    state: {
      settings: { personalAwards: saved },
      settingsLoaded: true,
      databaseTopKey: 'mattgrosso-gmail-com',
      weights: []
    },
    dispatch: vi.fn(() => Promise.resolve()),
    commit: vi.fn()
  })

  const wrapper = mount(PersonalAwardsModal, {
    props: {
      allEntriesWithFlatKeywordsAdded: library,
      autoOpen: true,
      pageMode: true,
      selectedYear: 1997
    },
    global: { mocks: { $store: store }, stubs: { Modal: MODAL_STUB, Teleport: true } }
  })
  return { wrapper, store }
}

// The value most recently written to the year's awards record.
const lastSaved = (store) => {
  const call = [...store.dispatch.mock.calls].reverse()
    .find(([action, payload]) => action === 'writeDurably' && payload?.path?.includes('personalAwards/1997'))
  return call ? call[1].value : null
}

describe('inventing an award', () => {
  it('offers the form only once you ask for it', async () => {
    const { wrapper } = factory()

    expect(wrapper.find('.custom-award-form').exists()).toBe(false)
    await wrapper.find('.custom-award-open').trigger('click')

    expect(wrapper.find('.custom-award-input').exists()).toBe(true)
  })

  it('adds the award to the category list, after the standard thirteen', async () => {
    const { wrapper } = factory()

    wrapper.vm.customAwardName = 'Best Needle Drop'
    await wrapper.vm.addCustomAward()
    await flushPromises()

    const names = wrapper.vm.categories.map((c) => c.name)
    expect(names).toHaveLength(PERSONAL_AWARD_CATEGORIES.length + 1)
    expect(names.at(-1)).toBe('Best Needle Drop')
  })

  it('persists it before drilling in, so a reload cannot lose it', async () => {
    const { wrapper, store } = factory()

    wrapper.vm.customAwardName = 'Best Needle Drop'
    await wrapper.vm.addCustomAward()
    await flushPromises()

    expect(lastSaved(store).customCategories['custom-best-needle-drop'])
      .toMatchObject({ name: 'Best Needle Drop' })
    // And it opens the award, which is the point of adding one.
    expect(wrapper.vm.selectedCategory).toBe('custom-best-needle-drop')
  })

  it('lets you assign it like any other category', async () => {
    const { wrapper, store } = factory()

    wrapper.vm.customAwardName = 'Best Needle Drop'
    await wrapper.vm.addCustomAward()
    await flushPromises()

    // Same machinery the standard categories use — nominate, then crown.
    const winner = library[0]
    wrapper.vm.awardsData['custom-best-needle-drop'] = { nominees: [winner], winner, noNominees: false }
    await wrapper.vm.saveCurrentState()
    await flushPromises()

    const saved = lastSaved(store).categories['custom-best-needle-drop']
    expect(saved.winner).toBeTruthy()
    expect(saved.nominees).toHaveLength(1)
  })

  it('counts as a completed category once it has a winner', async () => {
    const { wrapper } = factory()
    wrapper.vm.customAwardName = 'Honorary'
    await wrapper.vm.addCustomAward()
    await flushPromises()

    expect(wrapper.vm.categories.at(-1).completed).toBeFalsy()

    wrapper.vm.awardsData['custom-honorary'] = { nominees: [library[0]], winner: library[0] }
    await nextTick()

    expect(wrapper.vm.categories.at(-1).completed).toBeTruthy()
  })

  // Custom awards are movie-type and carry no genre filter, so every per-key
  // helper has to answer for a key it has never seen.
  it('is never disabled, and sorts by rating like Best Picture', async () => {
    const { wrapper } = factory()
    wrapper.vm.customAwardName = 'Honorary'
    await wrapper.vm.addCustomAward()
    await flushPromises()

    const custom = wrapper.vm.categories.at(-1)
    expect(custom.disabled).toBe(false)
    expect(custom.disabledReason).toBeNull()
    expect(wrapper.vm.getCategorySortKey('custom-honorary')).toBe('rating')
  })
})

describe('refusing a bad award name', () => {
  it('rejects a name that slugs to nothing rather than storing a bare prefix', async () => {
    const { wrapper, store } = factory()

    wrapper.vm.customAwardName = '!!!'
    await wrapper.vm.addCustomAward()

    expect(wrapper.vm.customAwardError).toBeTruthy()
    expect(lastSaved(store)).toBeNull()
  })

  // Same name, same key — which is what lets a repeated award aggregate
  // across years, and what would silently overwrite one within a year.
  it('refuses a duplicate rather than quietly replacing the first', async () => {
    const { wrapper } = factory()
    wrapper.vm.customAwardName = 'Best Needle Drop'
    await wrapper.vm.addCustomAward()
    await flushPromises()

    wrapper.vm.customAwardName = 'best needle drop'
    await wrapper.vm.addCustomAward()

    expect(wrapper.vm.customAwardError).toContain('already have an award')
    expect(Object.keys(wrapper.vm.customCategories)).toHaveLength(1)
  })

  it('refuses a name that is already a standard category', async () => {
    const { wrapper } = factory()

    wrapper.vm.customAwardName = 'Best Picture'
    await wrapper.vm.addCustomAward()

    expect(wrapper.vm.customAwardError).toContain('already one of the categories')
    expect(wrapper.vm.customCategories).toEqual({})
  })
})

describe('removing an invented award', () => {
  const saved = {
    1997: {
      categories: { 'custom-honorary': { nominees: [], winner: null, noNominees: false } },
      customCategories: { 'custom-honorary': { name: 'Honorary', createdAt: 1 } }
    }
  }

  it('offers removal only from inside a custom award', async () => {
    const { wrapper } = factory({ saved })

    wrapper.vm.selectedCategory = 'bestPicture'
    await nextTick()
    expect(wrapper.find('.panel-remove').exists()).toBe(false)

    wrapper.vm.selectedCategory = 'custom-honorary'
    await nextTick()
    expect(wrapper.find('.panel-remove').exists()).toBe(true)
  })

  it('takes its nominees and winner with it, rather than orphaning them', async () => {
    const { wrapper, store } = factory({ saved })
    wrapper.vm.selectedCategory = 'custom-honorary'
    wrapper.vm.awardsData['custom-honorary'] = { nominees: [library[0]], winner: library[0] }
    await nextTick()

    await wrapper.vm.removeCustomAward()
    await flushPromises()

    const written = lastSaved(store)
    // Orphaned nominees under a key nothing lists any more would keep the
    // award alive in the Trophy Case and in the winner's award history.
    expect(written.categories['custom-honorary']).toBeUndefined()
    expect(written.customCategories).toBeUndefined()
    expect(wrapper.vm.selectedCategory).toBeNull()
  })

  it('leaves a standard category alone even if asked', async () => {
    const { wrapper } = factory({ saved })
    wrapper.vm.selectedCategory = 'bestPicture'
    wrapper.vm.awardsData.bestPicture = { nominees: [library[0]], winner: library[0] }

    await wrapper.vm.removeCustomAward()

    expect(wrapper.vm.awardsData.bestPicture).toBeTruthy()
  })
})

describe('an invented award across sessions', () => {
  it('comes back on load, even with nothing assigned to it yet', () => {
    const { wrapper } = factory({
      saved: { 1997: { customCategories: { 'custom-honorary': { name: 'Honorary', createdAt: 1 } } } }
    })

    // No `categories` key at all in that record — an award can exist with
    // neither nominees nor a winner, and used to be dropped on load because
    // the read sat inside the categories branch.
    expect(wrapper.vm.categories.at(-1)).toMatchObject({ name: 'Honorary', custom: true })
  })

  it('is scoped to its year, not smeared across all of them', async () => {
    const { wrapper } = factory({
      saved: { 1997: { customCategories: { 'custom-honorary': { name: 'Honorary', createdAt: 1 } } } }
    })
    expect(wrapper.vm.categories.map((c) => c.name)).toContain('Honorary')

    await wrapper.setProps({ selectedYear: 2001 })
    await nextTick()

    expect(wrapper.vm.categories.map((c) => c.name)).not.toContain('Honorary')
    expect(wrapper.vm.categories).toHaveLength(PERSONAL_AWARD_CATEGORIES.length)
  })
})
