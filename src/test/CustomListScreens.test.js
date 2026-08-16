import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CustomListsScreen from '@/components/CustomListsScreen.vue'
import CustomListDetail from '@/components/CustomListDetail.vue'

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((entry) => ({ calculatedTotal: entry?.ratings?.[0]?.calculatedTotal ?? null }))
}))

function entry (tmdbId, title, rating, year = 2000) {
  return {
    dbKey: `k${tmdbId}`,
    movie: { id: tmdbId, title, release_date: `${year}-06-15`, poster_path: `/${tmdbId}.jpg` },
    ratings: [{ calculatedTotal: rating }]
  }
}

const LIBRARY = [
  entry(1, 'Alpha', 9, 1990),
  entry(2, 'Beta', 7, 2010),
  entry(3, 'Gamma Unlisted', 5, 2020)
]

function makeStore (lists, { dispatch = vi.fn(() => Promise.resolve('new-id')) } = {}) {
  return {
    state: { settings: {} },
    getters: { customLists: lists, allMoviesAsArray: LIBRARY },
    commit: vi.fn(),
    dispatch
  }
}

function mountDetail (list, { dispatch = vi.fn(() => Promise.resolve()), push = vi.fn() } = {}) {
  return mount(CustomListDetail, {
    global: {
      mocks: {
        $store: makeStore(list ? [list] : [], { dispatch }),
        $route: { params: { listId: list ? list.id : 'gone' } },
        $router: { push }
      },
      stubs: { BackLink: true }
    }
  })
}

const LIST = {
  id: 'comfort',
  name: 'Comfort Watches',
  sortMode: 'manual',
  updatedAt: 5,
  items: {
    1: { at: 100, order: 0 },
    2: { at: 200, order: 1 }
  }
}

describe('CustomListsScreen', () => {
  let dispatch, push

  beforeEach(() => {
    dispatch = vi.fn(() => Promise.resolve('comfort'))
    push = vi.fn()
  })

  function mountIndex (lists) {
    return mount(CustomListsScreen, {
      global: {
        mocks: { $store: makeStore(lists, { dispatch }), $route: { params: {} }, $router: { push } },
        stubs: { BackLink: true }
      }
    })
  }

  it('shows each list with its resolved count and average', () => {
    const wrapper = mountIndex([LIST])
    const text = wrapper.text()
    expect(text).toContain('Comfort Watches')
    expect(text).toContain('2 films')
    expect(text).toContain('8.00 average') // (9 + 7) / 2
  })

  it('creating a list dispatches and navigates to it', async () => {
    const wrapper = mountIndex([])
    await wrapper.find('.cl-create-input').setValue('  Comfort   Watches ')
    await wrapper.find('.cl-create-button').trigger('click')
    await Promise.resolve()

    expect(dispatch).toHaveBeenCalledWith('createCustomList', '  Comfort   Watches '.trim())
    expect(push).toHaveBeenCalledWith('/lists/comfort')
  })

  it('refuses to create a blank list', async () => {
    const wrapper = mountIndex([])
    await wrapper.find('.cl-create-input').setValue('   ')
    await wrapper.find('.cl-create-button').trigger('click')
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('tells a new user what to do instead of showing an empty page', () => {
    expect(mountIndex([]).text()).toContain('No lists yet')
  })
})

describe('CustomListDetail', () => {
  it('renders rows in the list\'s manual order', () => {
    const wrapper = mountDetail(LIST)
    const titles = wrapper.findAll('.ld-row-title').map((n) => n.text())
    expect(titles).toEqual(['Alpha', 'Beta'])
  })

  it('suggests only library movies not already in the list', async () => {
    const wrapper = mountDetail(LIST)
    await wrapper.find('.ld-add-input').setValue('a')      // under the 2-char floor
    expect(wrapper.findAll('.suggestion').length).toBe(0)

    await wrapper.find('.ld-add-input').setValue('am')     // matches "Gamma Unlisted"
    const suggestions = wrapper.findAll('.suggestion').map((s) => s.text())
    expect(suggestions.join(' ')).toContain('Gamma Unlisted')
    expect(suggestions.join(' ')).not.toContain('Alpha')   // already a member
  })

  it('adding dispatches with the TMDB id and clears the search', async () => {
    const dispatch = vi.fn(() => Promise.resolve())
    const wrapper = mountDetail(LIST, { dispatch })
    await wrapper.find('.ld-add-input').setValue('gamma')
    await wrapper.findAll('.suggestion')[0].trigger('click')

    expect(dispatch).toHaveBeenCalledWith('addToCustomList', { listId: 'comfort', tmdbId: 3 })
    expect(wrapper.vm.query).toBe('')
  })

  it('removing dispatches for that row', async () => {
    const dispatch = vi.fn(() => Promise.resolve())
    const wrapper = mountDetail(LIST, { dispatch })
    await wrapper.findAll('.ld-remove')[0].trigger('click')
    expect(dispatch).toHaveBeenCalledWith('removeFromCustomList', { listId: 'comfort', tmdbId: '1' })
  })

  it('reordering writes only the rows whose position changed', async () => {
    const dispatch = vi.fn(() => Promise.resolve())
    const wrapper = mountDetail(LIST, { dispatch })
    // The SECOND row's "up" arrow — the first row's is disabled. (A
    // disabled button reports attributes('disabled') === '', which is
    // falsy, so filtering on that would have picked the wrong one.)
    const secondRow = wrapper.findAll('.ld-row')[1]
    await secondRow.findAll('.ld-action')[0].trigger('click')

    expect(dispatch).toHaveBeenCalledWith('applyCustomListOrder', {
      listId: 'comfort',
      updates: { 2: 0, 1: 1 }
    })
  })

  it('deleting takes two taps', async () => {
    const dispatch = vi.fn(() => Promise.resolve())
    const push = vi.fn()
    const wrapper = mountDetail(LIST, { dispatch, push })

    await wrapper.find('.ld-delete').trigger('click')
    expect(dispatch).not.toHaveBeenCalledWith('deleteCustomList', 'comfort')
    expect(wrapper.find('.ld-delete').text()).toContain('Tap again')

    await wrapper.find('.ld-delete').trigger('click')
    expect(dispatch).toHaveBeenCalledWith('deleteCustomList', 'comfort')
    expect(push).toHaveBeenCalledWith('/lists')
  })

  it('reports movies that have left the library instead of quietly shrinking', () => {
    const withGhost = { ...LIST, items: { ...LIST.items, 999: { at: 1, order: 5 } } }
    const wrapper = mountDetail(withGhost)
    expect(wrapper.findAll('.ld-row').length).toBe(2)
    expect(wrapper.text()).toContain('no longer in your library')
  })

  it('a deleted list shows a message rather than crashing', () => {
    expect(mountDetail(null).text()).toContain('no longer exists')
  })
})
