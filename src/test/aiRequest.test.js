import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('axios', () => ({ default: { post: vi.fn(() => Promise.resolve({ data: {} })) } }));

const getIdToken = vi.fn(() => Promise.resolve('a-real-token'));
let currentUser = { getIdToken };
vi.mock('firebase/auth', () => ({ getAuth: () => ({ get currentUser () { return currentUser; } }) }));

const { postToAi } = await import('@/utils/aiRequest.js');

describe('postToAi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { getIdToken };
    getIdToken.mockResolvedValue('a-real-token');
  });

  it('attaches the signed-in user\'s ID token', async () => {
    // The endpoint costs money per call and its URL is public in the bundle, so
    // it verifies this token server-side. Every call has to carry one.
    await postToAi('/trivia', { title: 'Jaws', year: 1975 });

    const [, , config] = axios.post.mock.calls[0];
    expect(config.headers.Authorization).toBe('Bearer a-real-token');
  });

  it('posts the payload to the right route', async () => {
    await postToAi('/keywords', { title: 'Jaws' });

    const [url, payload] = axios.post.mock.calls[0];
    expect(url).toContain('/keywords');
    expect(payload).toEqual({ title: 'Jaws' });
  });

  it('refuses to fire a request at all when nobody is signed in', async () => {
    // Better to fail here than to spend a round trip on a guaranteed 401.
    currentUser = null;

    await expect(postToAi('/trivia', { title: 'Jaws' })).rejects.toThrow(/signed in/i);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('lets a token failure surface rather than sending an unauthenticated call', async () => {
    getIdToken.mockRejectedValue(new Error('token refresh failed'));

    await expect(postToAi('/trivia', { title: 'Jaws' })).rejects.toThrow();
    expect(axios.post).not.toHaveBeenCalled();
  });
});
