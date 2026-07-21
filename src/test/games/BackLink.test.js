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
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
  })

  it('renders a custom label when provided', () => {
    const wrapper = mount(BackLink, { props: { label: 'Games' } })
    expect(wrapper.text()).toBe('Games')
  })
})
