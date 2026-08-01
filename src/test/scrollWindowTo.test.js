import { describe, it, expect, vi, afterEach } from 'vitest';
import { scrollWindowTo } from '@/utils/scrollWindowTo.js';

afterEach(() => vi.restoreAllMocks());

describe('scrollWindowTo', () => {
  // The whole reason this helper exists: without an explicit 'instant',
  // the app's `scroll-behavior: smooth` on <html> makes the scroll a
  // silent no-op (verified live). See the module's own comment.
  it("always passes behavior: 'instant'", () => {
    const spy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    scrollWindowTo(0);
    expect(spy).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
  });

  it('scrolls to an arbitrary position, not just the top', () => {
    const spy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    scrollWindowTo(1400);
    expect(spy).toHaveBeenCalledWith({ top: 1400, behavior: 'instant' });
  });
});
