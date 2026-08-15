import { describe, it, expect, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import LibraryAccessBanner from '@/components/LibraryAccessBanner.vue'

function factory ({ dbReadDenied = false, userEmail = null, devMode = false } = {}) {
  const pushSpy = vi.fn()
  const wrapper = shallowMount(LibraryAccessBanner, {
    global: {
      mocks: {
        $store: { state: { dbReadDenied, userEmail }, getters: { devMode } },
        $router: { push: pushSpy }
      }
    }
  })
  return { wrapper, pushSpy }
}

// Guidance for someone mistakenly looking at an empty/unreadable library
// after the locked-down rules deploy — the data was never touched, and the
// banner's whole job is saying so.
describe('LibraryAccessBanner', () => {
  it('renders nothing while reads are working', () => {
    expect(factory().wrapper.find('.library-access-banner').exists()).toBe(false)
  })

  it('leads with "your movies aren\'t gone" and names the signed-in account', () => {
    const { wrapper } = factory({ dbReadDenied: true, userEmail: 'wrong.account@gmail.com' })

    expect(wrapper.text()).toContain("aren't gone")
    expect(wrapper.text()).toContain('wrong.account@gmail.com')
    expect(wrapper.text()).toContain('sign in')
  })

  it('offers a sign-in route when there is no session at all', async () => {
    const { wrapper, pushSpy } = factory({ dbReadDenied: true, userEmail: null })

    expect(wrapper.text()).toContain('Sign in with the account')
    await wrapper.find('button').trigger('click')
    expect(pushSpy).toHaveBeenCalledWith('/login')
  })

  it('explains the dev-mode case specifically — signing in again would not help there', () => {
    const { wrapper } = factory({ dbReadDenied: true, userEmail: 'natalie@gmail.com', devMode: true })

    expect(wrapper.text()).toContain('Dev mode')
    expect(wrapper.text()).toContain('testing database')
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
