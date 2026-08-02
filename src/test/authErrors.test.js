import { describe, it, expect } from 'vitest';
import { friendlyAuthError, CANCELLED_CODES } from '../assets/javascript/authErrors.js';

describe('friendlyAuthError', () => {
  it('translates a known Firebase code into plain language', () => {
    expect(friendlyAuthError({ code: 'auth/email-already-in-use' })).toContain('already exists');
  });

  it('stays vague for invalid-credential so it cannot be used to probe which emails are registered', () => {
    const message = friendlyAuthError({ code: 'auth/invalid-credential' });
    expect(message).not.toMatch(/no account|not found|doesn't exist/i);
  });

  it('surfaces the message from our own non-Firebase errors as-is', () => {
    const error = new Error('Signed in, but no email address came back.');
    expect(friendlyAuthError(error)).toBe('Signed in, but no email address came back.');
  });

  it('falls back to a generic message for an unrecognised code', () => {
    expect(friendlyAuthError({ code: 'auth/some-future-code' })).toBe('Something went wrong signing in. Please try again.');
  });

  it('handles being given nothing at all', () => {
    expect(friendlyAuthError(undefined)).toBe('Something went wrong signing in. Please try again.');
  });

  it('lists the popup-cancellation codes the UI suppresses', () => {
    expect(CANCELLED_CODES).toContain('auth/popup-closed-by-user');
    expect(CANCELLED_CODES).toContain('auth/cancelled-popup-request');
  });
});
