import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import BugResolutionNotice from '@/components/BugResolutionNotice.vue';
import { fetchUnseenResolutions, markResolutionsSeen } from '@/utils/bugResolutions';

vi.mock('@/utils/bugResolutions', () => ({
  fetchUnseenResolutions: vi.fn(),
  markResolutionsSeen: vi.fn(),
}));

const NOTICE = {
  id: '-Oxyz',
  reportSnippet: 'The list was empty when I opened the app',
  understood: 'When you opened the app, it showed you nothing instead of your movies.',
  fixed: 'We taught it to wait for your movies to arrive before deciding the list is empty.',
  resolvedAt: Date.parse('2026-08-21T12:00:00Z'),
};

function factory ({ dbLoaded = true, topKey = 'someone-example-com' } = {}) {
  return mount(BugResolutionNotice, {
    global: {
      mocks: {
        $store: { state: { dbLoaded }, getters: { databaseTopKey: topKey } },
      },
    },
  });
}

describe('BugResolutionNotice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Two stages since the notification-space unification (2026-08-21): a
  // prompt-card in .home-notices first, the full story only on tap.
  it('starts as a prompt-card, not the full panel', async () => {
    fetchUnseenResolutions.mockResolvedValue([NOTICE]);
    const wrapper = factory();
    await flushPromises();

    expect(wrapper.find('.prompt-card').exists()).toBe(true);
    expect(wrapper.text()).toContain('A bug you reported has been fixed');
    expect(wrapper.find('.bug-resolution-panel').exists()).toBe(false);
  });

  it('opens the full story on tap, with their words and both explanations', async () => {
    fetchUnseenResolutions.mockResolvedValue([NOTICE]);
    const wrapper = factory();
    await flushPromises();

    await wrapper.find('.prompt-card').trigger('click');

    const text = wrapper.text();
    expect(wrapper.find('.bug-resolution-panel').exists()).toBe(true);
    expect(wrapper.find('.prompt-card').exists()).toBe(false);
    expect(text).toContain(NOTICE.reportSnippet);
    expect(text).toContain(NOTICE.understood);
    expect(text).toContain(NOTICE.fixed);
  });

  it('renders nothing when there is nothing unseen', async () => {
    fetchUnseenResolutions.mockResolvedValue([]);
    const wrapper = factory();
    await flushPromises();

    expect(wrapper.find('.prompt-card').exists()).toBe(false);
    expect(wrapper.find('.bug-resolution-panel').exists()).toBe(false);
  });

  it('does not even look before the library has loaded', async () => {
    factory({ dbLoaded: false });
    await flushPromises();

    expect(fetchUnseenResolutions).not.toHaveBeenCalled();
  });

  it('marks every shown notice seen on "Got it" and closes everything', async () => {
    fetchUnseenResolutions.mockResolvedValue([NOTICE, { ...NOTICE, id: '-Other' }]);
    const wrapper = factory();
    await flushPromises();

    expect(wrapper.text()).toContain('2 bugs you reported have been fixed');
    await wrapper.find('.prompt-card').trigger('click');
    await wrapper.find('.bug-resolution-panel__actions .btn').trigger('click');

    expect(markResolutionsSeen).toHaveBeenCalledWith(expect.anything(), ['-Oxyz', '-Other']);
    expect(wrapper.find('.bug-resolution-panel').exists()).toBe(false);
    expect(wrapper.find('.prompt-card').exists()).toBe(false);
  });

  it('counts a backdrop dismissal of the story as seen too', async () => {
    fetchUnseenResolutions.mockResolvedValue([NOTICE]);
    const wrapper = factory();
    await flushPromises();

    await wrapper.find('.prompt-card').trigger('click');
    await wrapper.find('.bug-resolution-backdrop').trigger('click');

    expect(markResolutionsSeen).toHaveBeenCalledWith(expect.anything(), ['-Oxyz']);
    expect(wrapper.find('.prompt-card').exists()).toBe(false);
  });
});
