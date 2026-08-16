import { describe, it, expect } from 'vitest';
import { emailToDatabaseKey, isQaAccountKey, omitQaAccounts } from '../assets/javascript/databaseKey.js';

describe('emailToDatabaseKey', () => {
  it('turns a normal email into the key format already in the database', () => {
    expect(emailToDatabaseKey('mattgrosso@gmail.com')).toBe('mattgrosso-gmail-com');
  });

  it('is idempotent — the router guard re-runs it on an already-derived key', () => {
    const once = emailToDatabaseKey('someone@example.com');
    expect(emailToDatabaseKey(once)).toBe(once);
  });

  it('replaces every character Firebase keys cannot contain', () => {
    // `.` `$` `#` `[` `]` `/` are the ones RTDB actually forbids; the shipped
    // character class is broader, and this pins that it stays broad.
    expect(emailToDatabaseKey('a.b$c[d]e/f@x.com')).not.toMatch(/[.$[\]/]/);
  });

  it('handles a plus-addressed email', () => {
    expect(emailToDatabaseKey('matt+movies@gmail.com')).toBe('matt-movies-gmail-com');
  });

  it('does NOT lowercase — doing so would re-key existing accounts', () => {
    // This is the whole reason the derivation is frozen. If this ever starts
    // returning `mattgrosso-gmail-com`, every account with an uppercase
    // character in its address silently points at an empty database.
    expect(emailToDatabaseKey('MattGrosso@Gmail.com')).toBe('MattGrosso-Gmail-com');
  });

  it('returns null for missing or non-string input rather than throwing', () => {
    expect(emailToDatabaseKey(null)).toBeNull();
    expect(emailToDatabaseKey(undefined)).toBeNull();
    expect(emailToDatabaseKey('')).toBeNull();
    expect(emailToDatabaseKey(42)).toBeNull();
  });
});

// Natalie, 2026-08-16: "In the film club, I can see the cinema test user and I
// can invite them to be in my film club with me which shouldn't be possible."
// The QA tester is a real account signed in by `yarn mint-test-token`, and
// sharing defaults on, so one QA session published it as a findable person.
describe('omitQaAccounts', () => {
  it('drops the QA tester from a directory of real people', () => {
    const directory = {
      'mattgrosso-gmail-com': { name: 'mattgrosso' },
      'cinemaroll-tester-example-com': { name: 'Cinema Roll Tester' },
      'natalierosegrosso-gmail-com': { name: 'natalierosegrosso' }
    };

    expect(Object.keys(omitQaAccounts(directory)))
      .toEqual(['mattgrosso-gmail-com', 'natalierosegrosso-gmail-com']);
  });

  it('leaves a directory without QA accounts untouched, and is null-safe', () => {
    const directory = { 'mattgrosso-gmail-com': { name: 'mattgrosso' } };

    expect(omitQaAccounts(directory)).toEqual(directory);
    expect(omitQaAccounts(null)).toEqual({});
  });

  it('knows the tester key by itself', () => {
    expect(isQaAccountKey('cinemaroll-tester-example-com')).toBe(true);
    expect(isQaAccountKey('mattgrosso-gmail-com')).toBe(false);
  });
});
