import { describe, it, expect } from 'vitest'
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
