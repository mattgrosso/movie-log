import { describe, it, expect } from 'vitest';
import { emailToMemberKey } from '@/assets/javascript/movieHatAuth.js';

// This MUST agree with movie-hat's src/store/memberKey.mjs, which is the
// source of truth and also generates that project's database rules from the
// same character list. A disagreement here means Cinema Roll asks for a key
// the rules will never grant.
describe('emailToMemberKey', () => {
  it('replaces every character Firebase forbids in a key', () => {
    expect(emailToMemberKey('mattgrosso@gmail.com')).toBe('mattgrosso@gmail-com');
    expect(emailToMemberKey('a.b$c#d[e]f/g@x.com')).toBe('a-b-c-d-e-f-g@x-com');
  });

  it('keeps @, which is legal and keeps the keys readable', () => {
    expect(emailToMemberKey('someone@example.com')).toContain('@');
  });

  it('folds case, so a member added as Matt@ matches a token saying matt@', () => {
    expect(emailToMemberKey('MattGrosso@Gmail.com')).toBe('mattgrosso@gmail-com');
  });

  it('trims, because an invite field will happily hand you a space', () => {
    expect(emailToMemberKey('  matt@x.com  ')).toBe('matt@x-com');
  });

  it('is null-safe', () => {
    expect(emailToMemberKey(null)).toBeNull();
    expect(emailToMemberKey('')).toBeNull();
    expect(emailToMemberKey(42)).toBeNull();
  });
});
