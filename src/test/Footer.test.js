import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import Footer from '@/components/Footer.vue';

function factory (devModeValue) {
  const commit = vi.fn();
  const dispatch = vi.fn(() => Promise.resolve());
  const wrapper = mount(Footer, {
    global: {
      mocks: {
        $store: {
          getters: { devMode: devModeValue },
          commit,
          dispatch
        }
      }
    }
  });
  return { wrapper, commit, dispatch };
}

describe('Footer devMode toggle', () => {
  it('reflects $store.getters.devMode rather than tracking its own copy', () => {
    const { wrapper } = factory(true);
    expect(wrapper.find('.dev-mode-switch').classes()).toContain('dev-mode-on');
  });

  it('shows the off state when the store getter is false', () => {
    const { wrapper } = factory(false);
    expect(wrapper.find('.dev-mode-switch').classes()).toContain('dev-mode-off');
  });

  it('toggling commits setDevMode with the flipped value, then re-initializes and reloads', async () => {
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    delete window.location;
    window.location = { ...originalLocation, reload: reloadSpy };

    const { wrapper, commit, dispatch } = factory(false);
    await wrapper.find('.dev-mode-switch').trigger('click');

    expect(commit).toHaveBeenCalledWith('setDevMode', true);
    expect(dispatch).toHaveBeenCalledWith('initializeDB');
    expect(reloadSpy).toHaveBeenCalled();

    window.location = originalLocation;
  });
});
