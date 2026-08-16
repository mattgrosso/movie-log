import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import BackLink from '@/components/games/BackLink.vue'

// A router stand-in: `back` is what Vue Router records as the previous entry.
function routerMocks ({ back = null, parent = '/', title = 'Home', current = '/games/trivia' } = {}) {
  const push = vi.fn()
  const goBack = vi.fn()
  return {
    push,
    goBack,
    mocks: {
      $router: {
        push,
        back: goBack,
        options: { history: { state: { back } } },
        resolve: () => ({ meta: { title } })
      },
      $route: { fullPath: current, meta: { parent } }
    }
  }
}

// Every game screen + the games hub uses BackLink as its top-of-page
// affordance. Unlike MovieDetail/RateMovie (which hide the global Header),
// this follows Insights.vue's approach: the Header stays visible and the
// link is lifted over it purely via CSS (position:absolute with no
// positioned ancestor — see BackLink.vue's comment). No store interaction.
describe('BackLink', () => {
  // Matt, 2026-08-16: "sometimes you land somewhere from a place, but then
  // the button that you think might take you back actually takes you home
  // instead of back." Every back link used to push to a FIXED destination.
  it('goes back to where you came from, and says where that is', async () => {
    const { mocks, goBack, push } = routerMocks({ back: '/insights', title: 'Insights' })
    const wrapper = mount(BackLink, { global: { mocks } })

    expect(wrapper.text()).toBe('Insights')
    await wrapper.find('.back-link').trigger('click')
    expect(goBack).toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  // A deep link, a cold PWA launch, a hard refresh: there is no history.
  it('falls back to the declared parent when there is nowhere to go back to', async () => {
    const { mocks, goBack, push } = routerMocks({ back: null, parent: '/games', title: 'Games' })
    const wrapper = mount(BackLink, { global: { mocks } })

    expect(wrapper.text()).toBe('Games')
    await wrapper.find('.back-link').trigger('click')
    expect(push).toHaveBeenCalledWith('/games')
    expect(goBack).not.toHaveBeenCalled()
  })

  it('never offers to send you back to the login screen', async () => {
    const { mocks, push } = routerMocks({ back: '/login', parent: '/', title: 'Home' })
    const wrapper = mount(BackLink, { global: { mocks } })

    await wrapper.find('.back-link').trigger('click')
    expect(push).toHaveBeenCalledWith('/')
  })

  it('hands over to the screen when it has its own work to do', async () => {
    const { mocks, goBack, push } = routerMocks({ back: '/insights', title: 'Insights' })
    const wrapper = mount(BackLink, { props: { deferNavigation: true }, global: { mocks } })

    await wrapper.find('.back-link').trigger('click')
    expect(wrapper.emitted('click')[0][0]).toMatchObject({ path: '/insights', useBack: true })
    // The screen navigates, not the link.
    expect(goBack).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('still honours an explicit label override', () => {
    const { mocks } = routerMocks({ back: '/insights', title: 'Insights' })
    const wrapper = mount(BackLink, { props: { label: 'Games' }, global: { mocks } })
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

    it('navigates on a rightward swipe starting at the edge', () => {
      const { mocks, goBack } = routerMocks({ back: '/games' })
      mount(BackLink, { global: { mocks } })
      swipe({ startX: 5, endX: 90 })
      expect(goBack).toHaveBeenCalled()
    })

    it('ignores a swipe that starts away from the edge', () => {
      // Otherwise any rightward drag anywhere on the page would navigate back.
      const { mocks, goBack } = routerMocks({ back: '/games' })
      mount(BackLink, { global: { mocks } })
      swipe({ startX: 200, endX: 320 })
      expect(goBack).not.toHaveBeenCalled()
    })

    it('does not emit click on a short tap-like touch (not a real swipe)', () => {
      const { mocks, goBack } = routerMocks({ back: '/games' })
      mount(BackLink, { global: { mocks } })
      swipe({ startX: 5, endX: 20 })
      expect(goBack).not.toHaveBeenCalled()
    })

    it('does not emit click on a mostly-vertical drag (a scroll, not a swipe)', () => {
      const { mocks, goBack } = routerMocks({ back: '/games' })
      mount(BackLink, { global: { mocks } })
      swipe({ startX: 5, startY: 100, endX: 70, endY: 400 })
      expect(goBack).not.toHaveBeenCalled()
    })

    it('does not emit click on a leftward swipe', () => {
      const { mocks, goBack } = routerMocks({ back: '/games' })
      mount(BackLink, { global: { mocks } })
      swipe({ startX: 20, endX: -50 })
      expect(goBack).not.toHaveBeenCalled()
    })

    it('renders no overlay that could sit on top of the page', () => {
      // The whole point of the rewrite: nothing covers the left edge any more.
      const { mocks } = routerMocks()
      const wrapper = mount(BackLink, { global: { mocks } })
      expect(wrapper.find('.back-link-edge-swipe').exists()).toBe(false)
    })

    it('stops listening once unmounted', () => {
      const { mocks, goBack } = routerMocks({ back: '/games' })
      const wrapper = mount(BackLink, { global: { mocks } })
      wrapper.unmount()
      swipe({ startX: 5, endX: 90 })
      expect(goBack).not.toHaveBeenCalled()
    })
  })
})
