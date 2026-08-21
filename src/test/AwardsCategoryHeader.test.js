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

  // Bug report (2026-08-21): "the list of nominees is sticky, but the link
  // back to categories is not... I have to scroll all the way back to the
  // top." First fix duplicated the link into the sticky bar; feedback the
  // same day: "I don't want that categories link to be duplicated. You can
  // get rid of the one that isn't sticky." So: exactly one link, in the bar
  // that never scrolls away.
  it('puts the one and only Categories link inside the sticky section', async () => {
    const { wrapper } = factory()
    wrapper.vm.selectedCategory = 'bestPicture'
    await nextTick()

    expect(wrapper.find('.sticky-top-section .panel-back').exists()).toBe(true)
    expect(wrapper.find('.panel-bar .panel-back').exists()).toBe(false)
    expect(wrapper.findAll('.panel-back')).toHaveLength(1)
  })

  // The layout he asked for, verbatim: "write a line, the category title,
  // and the text that says current nominees... put that on the right edge
  // and keep the categories link on the left edge." jsdom does no layout, so
  // the structure is the contract: one row, link first, then a titles block
  // holding BOTH the name and the instruction - and the instruction gone
  // from its old home below.
  it('puts the title and the nominees instruction in one right-edge block', async () => {
    const { wrapper } = factory()
    wrapper.vm.selectedCategory = 'bestPicture'
    await nextTick()

    const row = wrapper.find('.category-header-row')
    expect(row.exists()).toBe(true)
    expect(row.find('.panel-back').exists()).toBe(true)
    const titles = row.find('.category-header-titles')
    expect(titles.find('.category-header').exists()).toBe(true)
    expect(titles.find('.section-title').text()).toContain('Current Nominees:')
    expect(wrapper.find('.current-nominees-section .section-title').exists()).toBe(false)
  })

  // The instruction text doubled as the tap target that reveals Matt's trash
  // button. Moving it must not lose that.
  it('tapping the relocated instruction still toggles the trash reveal', async () => {
    const { wrapper } = factory()
    wrapper.vm.selectedCategory = 'bestPicture'
    await nextTick()

    expect(wrapper.vm.showTrashIcon).toBe(false)
    await wrapper.find('.category-header-titles .section-title').trigger('click')
    if (wrapper.vm.isMatt) {
      expect(wrapper.vm.showTrashIcon).toBe(true)
    } else {
      expect(wrapper.vm.showTrashIcon).toBe(false)
    }
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

  // "The trash icon that gets revealed when I click on that title needs to
  // be moved into the sticky bar with the title... the trash icon could
  // appear to the left hand side of the text" (2026-08-21). When it lived in
  // the top bar, revealing it after scrolling made a button appear somewhere
  // off-screen - a tap that looks like it does nothing.
  it('reveals the trash inside the sticky bar, beside its tap target', async () => {
    const { wrapper } = factory()
    wrapper.vm.selectedCategory = 'bestPicture'
    await nextTick()

    // Wherever the trash renders, it must be in the sticky row, never the
    // scrolling panel bar.
    expect(wrapper.find('.panel-bar .panel-trash').exists()).toBe(false)

    // The factory mounts with no databaseTopKey, which isMatt treats as
    // Matt - asserted so this test can never silently skip its second half.
    expect(wrapper.vm.isMatt).toBe(true)
    const row = wrapper.find('.nominees-instruction-row')
    expect(row.find('.panel-trash').exists()).toBe(true)
    // Left of the text: the button precedes the instruction in the row.
    const children = row.element.children
    expect(children[0].className).toContain('panel-trash')
    expect(children[1].className).toContain('section-title')
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
