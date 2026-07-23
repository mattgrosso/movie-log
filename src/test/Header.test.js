import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import AppHeader from '@/components/Header.vue';

function factory (stateOverrides = {}) {
  return mount(AppHeader, {
    global: {
      mocks: {
        $store: {
          state: { showHeader: true, hideHeaderLogo: false, bannerUrl: null, ...stateOverrides },
          getters: { allMediaAsArray: [], devMode: false },
          commit: vi.fn()
        },
        $router: { push: vi.fn() }
      }
    }
  });
}

describe('Header', () => {
  it('shows the "Cinema Roll" home-link by default', () => {
    const wrapper = factory();
    expect(wrapper.find('.home-link').exists()).toBe(true);
  });

  it('hides the home-link when hideHeaderLogo is true (a game with its own baked-in branding)', () => {
    const wrapper = factory({ hideHeaderLogo: true });
    expect(wrapper.find('.home-link').exists()).toBe(false);
  });

  it('still renders the banner image when the logo is hidden - hideHeaderLogo only affects the overlay, not showHeader', () => {
    const wrapper = factory({ hideHeaderLogo: true, bannerUrl: 'https://example.com/banner.png' });
    expect(wrapper.find('.random-banner img').exists()).toBe(true);
    expect(wrapper.find('.home-link').exists()).toBe(false);
  });

  it('clicking the banner navigates home, same as clicking the "Cinema Roll" title (bug report: needed once hideHeaderLogo hides that title)', async () => {
    const wrapper = factory({ bannerUrl: 'https://example.com/banner.png' });
    await wrapper.find('.random-banner').trigger('click');

    expect(wrapper.vm.$store.commit).toHaveBeenCalledWith('setGoHome', true);
    expect(wrapper.vm.$router.push).toHaveBeenCalledWith('/');
  });
});
