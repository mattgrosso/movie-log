import { describe, it, expect, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import UpdateAvailableBanner from '@/components/UpdateAvailableBanner.vue'

function factory (updateAvailable) {
  return shallowMount(UpdateAvailableBanner, {
    global: {
      mocks: {
        $store: { state: { updateAvailable } }
      }
    }
  })
}

describe('UpdateAvailableBanner', () => {
  it('renders nothing when no update is available', () => {
    const wrapper = factory(false)

    expect(wrapper.find('.update-available-banner').exists()).toBe(false)
  })

  it('shows a prompt (not an automatic reload) once an update is available', () => {
    const wrapper = factory(true)

    expect(wrapper.find('.update-available-banner').exists()).toBe(true)
    expect(wrapper.text()).toContain('new version')
    expect(wrapper.find('button').text()).toContain('Refresh')
  })

  it('only reloads when the user explicitly taps Refresh - never on its own', async () => {
    const reloadSpy = vi.fn()
    const originalLocation = window.location
    delete window.location
    window.location = { ...originalLocation, reload: reloadSpy }

    const wrapper = factory(true)
    expect(reloadSpy).not.toHaveBeenCalled()

    await wrapper.find('button').trigger('click')

    expect(reloadSpy).toHaveBeenCalledTimes(1)

    window.location = originalLocation
  })
})
