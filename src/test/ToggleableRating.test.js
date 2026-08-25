import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ToggleableRating from '@/components/ToggleableRating.vue'

// Two bug reports from the movie detail page, 2026-08-25.
//
// 1. "It seems like we're showing more decimal places now on our scores.
//    Whatever the maximum number of decimals we might show is, we should
//    always match that number of significant figures even if there are
//    trailing zeros."
//
//    Scores went to four computed decimals on 2026-08-21, displayed at two.
//    scorePrecision.test.js guards three templates against a bare
//    `{{rating.calculatedTotal}}` — but MovieDetail hands the same number to
//    this component as a PROP and it rendered `{{rating}}`, a spelling the
//    guard cannot see. So the detail page has been printing 8.4372 ever since.
//
// 2. "I don't want that rank to be a link. The whole score is a button that
//    toggles itself... I don't want be accidentally clicking a link while I'm
//    trying to toggle. So, get rid of the link and move the rank info so that
//    it mimics the placement of the normalized parenthetical."
//
//    The rank now renders here, as a label in the same position as the
//    "(normalized rating)" one, and taps fall through to the toggle like
//    everything else in this component.

const mountRating = (props = {}) => mount(ToggleableRating, {
  props: { rating: 8.4372, normalizedRating: 7, ...props },
})

describe('ToggleableRating score precision', () => {
  it('shows the score at two decimals, not the stored four', () => {
    expect(mountRating().text()).toContain('8.44')
    expect(mountRating().text()).not.toContain('8.4372')
  })

  it('keeps the trailing zero so every score is the same width', () => {
    // Matt's actual ask: match the maximum number of decimals ALWAYS. A "8.4"
    // sitting under a "8.44" is the thing being reported.
    expect(mountRating({ rating: 8.4 }).text()).toContain('8.40')
    expect(mountRating({ rating: 9 }).text()).toContain('9.00')
  })

  it('formats the normalized score too', async () => {
    const wrapper = mountRating({ normalizedRating: 7.5031 })
    await wrapper.trigger('click')
    expect(wrapper.text()).toContain('7.50')
    expect(wrapper.text()).not.toContain('7.5031')
  })

  it('still counts stars off the unrounded number', async () => {
    // The prop stays numeric; only the display is formatted. Rounding before
    // the star maths would move half-stars around.
    const wrapper = mountRating({ normalizedRating: 7 })
    await wrapper.trigger('click')
    await wrapper.trigger('click')
    expect(wrapper.findAll('.bi-star-fill')).toHaveLength(3)
    expect(wrapper.find('.bi-star-half').exists()).toBe(true)
  })
})

describe('ToggleableRating rank', () => {
  it('shows the rank beside the score, as a parenthetical', () => {
    const wrapper = mountRating({ rankLabel: '412th' })
    expect(wrapper.find('.rating label').text()).toBe('(412th)')
  })

  it('is not a link or a button — the whole control is one toggle', () => {
    const wrapper = mountRating({ rankLabel: '412th' })
    expect(wrapper.find('.rating a').exists()).toBe(false)
    expect(wrapper.find('.rating button').exists()).toBe(false)
  })

  it('toggles rather than doing anything of its own when tapped', async () => {
    const wrapper = mountRating({ rankLabel: '412th' })
    await wrapper.find('.rating label').trigger('click')
    expect(wrapper.find('.normalized-rating').exists()).toBe(true)
    expect(wrapper.emitted('typeChanged').at(-1)).toEqual(['normalizedRating'])
  })

  it('hides the rank once the score is showing as anything else', async () => {
    const wrapper = mountRating({ rankLabel: '412th' })
    await wrapper.trigger('click')
    expect(wrapper.text()).not.toContain('412th')
  })

  it('says nothing when there is no rank to show', () => {
    expect(mountRating().find('.rating label').exists()).toBe(false)
  })
})
