import { describe, it, expect } from 'vitest';
import { unseenResolutions } from '@/utils/bugResolutions';
import { emailToTopKey, snippetOf } from '../../scripts/bugResolutionHelpers.mjs';
import { emailToDatabaseKey } from '@/assets/javascript/databaseKey';

describe('unseenResolutions', () => {
  it('keeps only unseen entries, oldest resolution first', () => {
    const entries = {
      a: { understood: 'x', resolvedAt: 300, seen: false },
      b: { understood: 'y', resolvedAt: 100, seen: true },
      c: { understood: 'z', resolvedAt: 200 }
    };

    const unseen = unseenResolutions(entries);

    expect(unseen.map((n) => n.id)).toEqual(['c', 'a']);
  });

  it('is empty for empty or missing data', () => {
    expect(unseenResolutions(null)).toEqual([]);
    expect(unseenResolutions({})).toEqual([]);
  });

  // A notice already marked seen must never resurface — that is the whole
  // contract of the "Got it" button.
  it('never returns a seen entry', () => {
    expect(unseenResolutions({ a: { seen: true } })).toEqual([]);
  });
});

describe('emailToTopKey (the resolve script\'s derivation)', () => {
  // The script writes into `<topKey>/bugReportResolutions`, so its
  // derivation must agree with the app's — a mismatched key writes the
  // notice into an account that doesn't exist and nobody ever sees it.
  it('agrees with the app\'s emailToDatabaseKey exactly', () => {
    const emails = [
      'someone@example.com',
      'First.Last+tag@sub.domain.co.uk',
      'UPPER@CASE.COM',
      "quirky!#$%&'*+-/=?^_`{|}~@odd.example",
      'plain@x.y'
    ];
    for (const email of emails) {
      expect(emailToTopKey(email)).toBe(emailToDatabaseKey(email));
    }
  });

  it('returns null for a report with no email', () => {
    expect(emailToTopKey(null)).toBe(null);
    expect(emailToTopKey('')).toBe(null);
  });
});

describe('snippetOf', () => {
  it('quotes short reports whole', () => {
    expect(snippetOf('  The filter forgot me.  ')).toBe('The filter forgot me.');
  });

  it('shortens long reports with an ellipsis inside the limit', () => {
    const long = 'a'.repeat(500);
    const snippet = snippetOf(long);
    expect(snippet.length).toBeLessThanOrEqual(280);
    expect(snippet.endsWith('…')).toBe(true);
  });

  it('turns nothing into an empty string, not a crash', () => {
    expect(snippetOf(undefined)).toBe('');
  });
});
