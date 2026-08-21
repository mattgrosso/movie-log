import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import PersonalAwardsModal from '@/components/PersonalAwardsModal.vue'

// Bug report, 2026-08-20: "When I click into a category on my personal awards,
// it doesn't actually say anywhere what category I'm working on on that page
// so if I look away and forget, I have to exit and come back in order to see
// what category I'm in."
//
// The pane's own header slot is `v-if="!selectedCategory"`, so drilling in
// hid the only heading on screen, and the CSS rule that had once styled a
// category title (`.category-header h5`) was left pointing at a wrapper that
// no longer existed — a dead rule, which is how the name went missing.

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

// Unlike the other awards suites, this one has to see the modal's BODY, so
// Modal is stubbed to render its slots rather than swallowed whole.
const MODAL_STUB = {
  name: 'Modal',
  template: '<div class="modal-stub"><slot name="header"/><slot name="body"/><slot name="footer"/></div>'
}

function factory () {
  const store = reactive({
    state: {
      settings: { personalAwards: {} },
      settingsLoaded: true,
      databaseTopKey: 'mattgrosso-gmail-com',
      weights: []
    },
    dispatch: vi.fn(),
    commit: vi.fn()
  })

  const wrapper = mount(PersonalAwardsModal, {
    props: {
      allEntriesWithFlatKeywordsAdded: library,
      autoOpen: true,
      pageMode: true,
      selectedYear: 1997
    },
    global: {
      mocks: { $store: store },
      stubs: { Modal: MODAL_STUB, Teleport: true }
    }
  })
  return { wrapper, store }
}

describe('which category am I in', () => {
  it('names the open category on the detail pane', async () => {
    const { wrapper } = factory()
    wrapper.vm.selectedCategory = 'bestSupportingActress'
    await nextTick()

    expect(wrapper.find('.category-header').text()).toBe('Best Supporting Actress')
  })

  it('follows the category you actually drilled into', async () => {
    const { wrapper } = factory()

    wrapper.vm.selectedCategory = 'bestPicture'
    await nextTick()
    expect(wrapper.find('.category-header').text()).toBe('Best Picture')

    wrapper.vm.selectedCategory = 'bestCinematography'
    await nextTick()
    expect(wrapper.find('.category-header').text()).toBe('Best Cinematography')
  })

  // The whole point of the report is the name surviving a look away, and the
  // panel bar above scrolls off — a name you lose the moment you scroll a
  // grid of nominees is the same bug again. The sticky section is the one
  // part of this pane that stays put.
  it('puts the name inside the sticky section, not the bar that scrolls away', async () => {
    const { wrapper } = factory()
    wrapper.vm.selectedCategory = 'bestPicture'
    await nextTick()

    expect(wrapper.find('.sticky-top-section .category-header').exists()).toBe(true)
    expect(wrapper.find('.panel-bar .category-header').exists()).toBe(false)
  })

  // Same disease, next symptom (bug report, 2026-08-21): "the list of
  // nominees is sticky, but the link back to categories is not... I have to
  // scroll all the way back to the top." The link is duplicated INTO the
  // sticky bar - "also", as reported, so the top copy stays for anyone who
  // hasn't scrolled.
  it('puts a Categories back link inside the sticky section too', async () => {
    const { wrapper } = factory()
    wrapper.vm.selectedCategory = 'bestPicture'
    await nextTick()

    expect(wrapper.find('.sticky-top-section .panel-back').exists()).toBe(true)
    // The original at the top survives - the report said "also".
    expect(wrapper.find('.panel-bar .panel-back').exists()).toBe(true)
  })

  it('the sticky back link actually leaves the category', async () => {
    const { wrapper } = factory()
    wrapper.vm.selectedCategory = 'bestPicture'
    await nextTick()

    await wrapper.find('.sticky-top-section .panel-back').trigger('click')
    await nextTick()

    expect(wrapper.find('.category-header').exists()).toBe(false)
    expect(wrapper.find('.awards-header').exists()).toBe(true)
  })

  it('shows the year heading again on the way back out, not a category name', async () => {
    const { wrapper } = factory()
    wrapper.vm.selectedCategory = 'bestPicture'
    await nextTick()
    expect(wrapper.find('.category-header').exists()).toBe(true)

    wrapper.vm.backToCategories()
    await nextTick()

    expect(wrapper.find('.category-header').exists()).toBe(false)
    expect(wrapper.find('.awards-header').exists()).toBe(true)
  })
})
