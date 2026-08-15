import { describe, it, expect } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import OfflineBanner from '@/components/OfflineBanner.vue'

function factory (isOnline) {
  return shallowMount(OfflineBanner, {
    global: {
      mocks: {
        $store: { state: { isOnline } }
      }
    }
  })
}

// Bug report: "we should have some sort of indication on the screen to show
// that people [are] in an off-line mode."
describe('OfflineBanner', () => {
  it('renders nothing while online', () => {
    expect(factory(true).find('.offline-banner').exists()).toBe(false)
  })

  it('shows the offline notice, including that changes still save and sync later', () => {
    const wrapper = factory(false)

    expect(wrapper.find('.offline-banner').exists()).toBe(true)
    expect(wrapper.text()).toContain('offline')
    expect(wrapper.text()).toContain('sync')
  })
})
