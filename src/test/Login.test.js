import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Login from '@/components/Login.vue'

describe('Login', () => {
  it('renders a "Sign in with Google" button', () => {
    const wrapper = mount(Login, {
      global: { mocks: { $store: { dispatch: vi.fn() } } }
    })
    expect(wrapper.text()).toContain('Sign in with Google')
  })

  it('dispatches the login action on click', async () => {
    const dispatch = vi.fn()
    const wrapper = mount(Login, {
      global: { mocks: { $store: { dispatch } } }
    })
    await wrapper.find('.google-signin-button').trigger('click')
    expect(dispatch).toHaveBeenCalledWith('login')
  })
})
