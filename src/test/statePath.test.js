import { describe, it, expect } from 'vitest';
import { setValueAtPath } from '@/utils/statePath.js';

describe('setValueAtPath', () => {
  it('sets a top-level key on an empty object', () => {
    expect(setValueAtPath({}, ['lastTweak'], 123)).toEqual({ lastTweak: 123 });
  });

  it('sets a nested key, creating intermediate objects as needed', () => {
    expect(setValueAtPath({}, ['personalAwards', '2024'], { completed: true }))
      .toEqual({ personalAwards: { 2024: { completed: true } } });
  });

  it('preserves sibling keys at every level along the path', () => {
    const source = { personalAwards: { 2023: { completed: true } }, otherKey: 'untouched' };
    const result = setValueAtPath(source, ['personalAwards', '2024'], { completed: false });

    expect(result.personalAwards[2024]).toEqual({ completed: false });
    expect(result.personalAwards[2023]).toEqual({ completed: true });
    expect(result.otherKey).toBe('untouched');
  });

  it('overwrites an existing value at the given path', () => {
    const result = setValueAtPath({ lastTweak: 1 }, ['lastTweak'], 2);
    expect(result.lastTweak).toBe(2);
  });

  it('does not mutate the original object (or its nested objects)', () => {
    const original = { personalAwards: { 2023: { completed: true } } };
    const frozenNested = original.personalAwards;
    setValueAtPath(original, ['personalAwards', '2024'], { completed: false });

    expect(original.personalAwards).toBe(frozenNested);
    expect(original.personalAwards[2024]).toBeUndefined();
  });

  it('treats a null/non-object base as empty rather than throwing', () => {
    expect(setValueAtPath(null, ['a'], 1)).toEqual({ a: 1 });
    expect(setValueAtPath(undefined, ['a', 'b'], 1)).toEqual({ a: { b: 1 } });
  });

  it('returns the value directly when segments is empty', () => {
    expect(setValueAtPath({ existing: true }, [], 'replacement')).toBe('replacement');
  });
});
