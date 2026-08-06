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
  // screen in order to trigger the same back behavior." Bound on the WINDOW
  // and filtered by where the touch started, rather than via an invisible
  // strip — the strip covered anything within 20px of the left edge and ate
  // taps on it.
  describe('left-edge swipe gesture', () => {
    // Dispatched on window, since that's where the listeners live now.
    function touch (type, x, y) {
      const event = new Event(type)
      const point = { clientX: x, clientY: y }
      event.touches = [point]
      event.changedTouches = [point]
      window.dispatchEvent(event)
    }

    function swipe ({ startX = 5, startY = 300, endX, endY = 300 }) {
      touch('touchstart', startX, startY)
      touch('touchend', endX, endY)
    }

    it('emits click on a rightward swipe starting at the edge', () => {
      const wrapper = mount(BackLink)
      swipe({ startX: 5, endX: 90 })
      expect(wrapper.emitted('click')).toBeTruthy()
    })

    it('ignores a swipe that starts away from the edge', () => {
      // Otherwise any rightward drag anywhere on the page would navigate back.
      const wrapper = mount(BackLink)
      swipe({ startX: 200, endX: 320 })
      expect(wrapper.emitted('click')).toBeFalsy()
    })

    it('does not emit click on a short tap-like touch (not a real swipe)', () => {
      const wrapper = mount(BackLink)
      swipe({ startX: 5, endX: 20 })
      expect(wrapper.emitted('click')).toBeFalsy()
    })

    it('does not emit click on a mostly-vertical drag (a scroll, not a swipe)', () => {
      const wrapper = mount(BackLink)
      swipe({ startX: 5, startY: 100, endX: 70, endY: 400 })
      expect(wrapper.emitted('click')).toBeFalsy()
    })

    it('does not emit click on a leftward swipe', () => {
      const wrapper = mount(BackLink)
      swipe({ startX: 20, endX: -50 })
      expect(wrapper.emitted('click')).toBeFalsy()
    })

    it('renders no overlay that could sit on top of the page', () => {
      // The whole point of the rewrite: nothing covers the left edge any more.
      const wrapper = mount(BackLink)
      expect(wrapper.find('.back-link-edge-swipe').exists()).toBe(false)
    })

    it('stops listening once unmounted', () => {
      const wrapper = mount(BackLink)
      wrapper.unmount()
      swipe({ startX: 5, endX: 90 })
      expect(wrapper.emitted('click')).toBeFalsy()
    })
  })
})
