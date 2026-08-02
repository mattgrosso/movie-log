import { describe, it, expect } from 'vitest';
import { emailToDatabaseKey } from '../assets/javascript/databaseKey.js';

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
