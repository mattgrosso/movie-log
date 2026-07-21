import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import BackLink from '@/components/games/BackLink.vue'

// Every game screen + the games hub uses BackLink as its sole top-of-page
// affordance instead of the global Header — see CLAUDE.md's "Unified
// Home/Back Affordance". Regression guard for a bug report where none of
// the 7 usages hid the global header, so it rendered above this link.
describe('BackLink', () => {
  function mountWithStore () {
    const commit = vi.fn()
    const wrapper = mount(BackLink, {
      global: { mocks: { $store: { commit } } }
    })
    return { wrapper, commit }
  }

  it('hides the global header on mount', () => {
    const { commit } = mountWithStore()
    expect(commit).toHaveBeenCalledWith('setShowHeader', false)
  })

  it('restores the global header on unmount', () => {
    const { wrapper, commit } = mountWithStore()
    wrapper.unmount()
    expect(commit).toHaveBeenCalledWith('setShowHeader', true)
  })

  it('emits click and defaults to a "Home" label', () => {
    const { wrapper } = mountWithStore()
    expect(wrapper.text()).toBe('Home')
    wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
  })

  it('renders a custom label when provided', () => {
    const { wrapper } = (() => {
      const commit = vi.fn()
      return { wrapper: mount(BackLink, { props: { label: 'Games' }, global: { mocks: { $store: { commit } } } }) }
    })()
    expect(wrapper.text()).toBe('Games')
  })
})
