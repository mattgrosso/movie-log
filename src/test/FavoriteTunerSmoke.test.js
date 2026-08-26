import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mount } from '@vue/test-utils'
import FavoriteTuner from '@/components/FavoriteTuner.vue'

describe('FavoriteTuner renders', () => {
  it('shows toggle and emits update on slider input', async () => {
    const levers = [{ key: 'minEntries', label: 'Min films', value: 4, min: 1, max: 15, step: 1, help: 'help' }]
    const wrapper = mount(FavoriteTuner, { props: { levers } })
    expect(wrapper.find('.tuner-toggle').exists()).toBe(true)
    await wrapper.find('.tuner-toggle').trigger('click')
    expect(wrapper.find('.tuner-slider').exists()).toBe(true)
    await wrapper.find('.tuner-slider').setValue(7)
    expect(wrapper.emitted('update')[0][0]).toEqual({ key: 'minEntries', value: 7 })
  })
})

// Bug report 2026-08-25, filed against Favorite Composers but true of all
// eight favorite sections, which share this one component: "I just tried
// clicking on the edit button beneath my favorite composers and the button
// kinda like jumps away as I tap it like moves and then unless I tap really
// quickly twice, it doesn't really work."
//
// The cause was a leftover resting transform. The pencil used to be
// absolutely positioned on the pane's top border, where `translateY(-50%)`
// CENTRED it; the 2026-08-15 tab rework moved it into normal flow and left
// the translate inside `:active`, where it became a 16px jump on touch-down.
// The button moved out from under the finger, so touchend landed outside it
// and no click fired.
//
// Asserted against the source because jsdom loads no stylesheet — a mounted
// component here has no computed transform to check, and a test that looked
// would pass against the broken page.
describe('FavoriteTuner press feedback', () => {
  const styleBlock = () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/FavoriteTuner.vue'), 'utf8',
    )
    const start = source.indexOf('.tuner-toggle {')
    expect(start).toBeGreaterThan(-1)
    return source.slice(start, source.indexOf('.tuner-panel {', start))
  }

  it('never moves the toggle under the finger', () => {
    const activeRule = styleBlock().match(/&:active\s*{[^}]*}/)
    expect(activeRule).not.toBeNull()
    // A shrink is fine; any displacement is not.
    expect(activeRule[0]).toContain('scale(0.9)')
    expect(activeRule[0]).not.toMatch(/translate/)
  })

  it('gives the 32px circle a 40px tap target', () => {
    // The house minimum (.claude/rules/vue-ui.md): "Touch targets: 40px
    // minimum. Anything smaller gets reported as 'the button doesn't work.'"
    // Grown with a pseudo-element so the circle itself is unchanged.
    const block = styleBlock()
    expect(block).toMatch(/&::after\s*{[^}]*inset:\s*-4px/)
    expect(block).toContain('position: relative')
  })
})
