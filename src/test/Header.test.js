import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import AppHeader from '@/components/Header.vue';
import { createBannerParallax } from '@/assets/javascript/bannerParallax.js';

vi.mock('@/assets/javascript/bannerParallax.js', () => ({
  createBannerParallax: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() }))
}));

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

  describe('version number stays visible even when the logo is hidden (bug report: "the version number... doesn\'t appear with our new game headers... just the exact same spot")', () => {
    it('shows the version inside .home-link by default', () => {
      const wrapper = factory();
      expect(wrapper.find('.home-link .version').exists()).toBe(true);
      expect(wrapper.find('.version-only').exists()).toBe(false);
    });

    it('falls back to a standalone .version-only element when hideHeaderLogo is true', () => {
      const wrapper = factory({ hideHeaderLogo: true });
      expect(wrapper.find('.home-link').exists()).toBe(false);
      expect(wrapper.find('.version-only .version').exists()).toBe(true);
    });

    // The corner badge is the house stamp's version half (0.5rem over a banner
    // photo has no room for a timestamp); the full "v… · built …" line is in
    // the footer. Assert the text, not just that the element exists — an empty
    // .version would satisfy the two tests above.
    it('renders the version with the house "v" prefix, in both placements', () => {
      const originalVersion = process.env.VUE_APP_VERSION;
      process.env.VUE_APP_VERSION = '1.96.4';

      expect(factory().find('.home-link .version').text()).toBe('v1.96.4');
      expect(factory({ hideHeaderLogo: true }).find('.version-only .version').text()).toBe('v1.96.4');

      process.env.VUE_APP_VERSION = originalVersion;
      if (originalVersion === undefined) delete process.env.VUE_APP_VERSION;
    });

    it('.version-only also navigates home on click, same as the normal title', async () => {
      const wrapper = factory({ hideHeaderLogo: true });
      await wrapper.find('.version-only').trigger('click');

      expect(wrapper.vm.$store.commit).toHaveBeenCalledWith('setGoHome', true);
      expect(wrapper.vm.$router.push).toHaveBeenCalledWith('/');
    });
  });

  // Tilt parallax on the banner photo (bug report 2026-08-21). The sensor
  // logic lives in bannerParallax.js and has its own tests; here we pin the
  // wiring: started on mount, stopped on unmount, aimed at the banner img.
  describe('banner tilt parallax', () => {
    it('starts on mount with a getter that resolves the banner img, and stops on unmount', () => {
      const wrapper = factory({ bannerUrl: 'https://example.com/banner.png' });

      const call = createBannerParallax.mock.calls.at(-1);
      const instance = createBannerParallax.mock.results.at(-1).value;
      expect(instance.start).toHaveBeenCalled();
      expect(call[0].getImage()).toBe(wrapper.find('.random-banner img').element);

      wrapper.unmount();
      expect(instance.stop).toHaveBeenCalled();
    });

    it('the image getter just returns nothing while no banner is loaded', () => {
      factory({ bannerUrl: null });

      const call = createBannerParallax.mock.calls.at(-1);
      expect(call[0].getImage()).toBeFalsy();
    });
  });
});
