import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BackLink from '@/components/games/BackLink.vue'

// Every game screen + the games hub uses BackLink as its top-of-page
// affordance. Unlike MovieDetail/RateMovie (which hide the global Header),
// this follows Insights.vue's approach: the Header stays visible and the
// link is lifted over it purely via CSS (position:absolute with no
// positioned ancestor — see BackLink.vue's comment). No store interaction.
describe('BackLink', () => {
  it('emits click and defaults to a "Home" label', async () => {
    const wrapper = mount(BackLink)
    expect(wrapper.text()).toBe('Home')
    await wrapper.find('.back-link').trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
  })

  it('renders a custom label when provided', () => {
    const wrapper = mount(BackLink, { props: { label: 'Games' } })
    expect(wrapper.text()).toBe('Games')
  })

  // Bug report: "I should be able to swipe left from the left edge of the
  // screen in order to trigger the same back behavior." A thin fixed strip
  // along the left edge tracks touchstart/touchend and emits the same
  // 'click' event a tap on the link itself would.
  describe('left-edge swipe gesture', () => {
    function swipe (wrapper, { startX = 5, startY = 300, endX, endY = 300 }) {
      const zone = wrapper.find('.back-link-edge-swipe')
      zone.trigger('touchstart', { touches: [{ clientX: startX, clientY: startY }] })
      zone.trigger('touchend', { changedTouches: [{ clientX: endX, clientY: endY }] })
    }

    it('emits click on a rightward swipe starting at the edge', () => {
      const wrapper = mount(BackLink)
      swipe(wrapper, { startX: 5, endX: 90 })
      expect(wrapper.emitted('click')).toBeTruthy()
    })

    it('does not emit click on a short tap-like touch (not a real swipe)', () => {
      const wrapper = mount(BackLink)
      swipe(wrapper, { startX: 5, endX: 20 })
      expect(wrapper.emitted('click')).toBeFalsy()
    })

    it('does not emit click on a mostly-vertical drag (a scroll, not a swipe)', () => {
      const wrapper = mount(BackLink)
      const zone = wrapper.find('.back-link-edge-swipe')
      zone.trigger('touchstart', { touches: [{ clientX: 5, clientY: 100 }] })
      zone.trigger('touchend', { changedTouches: [{ clientX: 70, clientY: 400 }] })
      expect(wrapper.emitted('click')).toBeFalsy()
    })

    it('does not emit click on a leftward swipe', () => {
      const wrapper = mount(BackLink)
      swipe(wrapper, { startX: 20, endX: -50 })
      expect(wrapper.emitted('click')).toBeFalsy()
    })
  })
})
