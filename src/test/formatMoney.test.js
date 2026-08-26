import { describe, it, expect } from 'vitest';
import { formatMoneyShort, formatProfit, formatReturn } from '../assets/javascript/formatMoney.js';

// Requested 2026-08-26: "Budget should be able to show the budget (300M, 250K,
// etc). Box office should do the same but for box office numbers. Profit
// should show the difference between the budget and the box office. And
// return should show a percentage." All of it lands in an 8px caption bar
// under a poster, so brevity is the requirement, not a preference.

describe('formatMoneyShort', () => {
  it('reads the way the ask was written', () => {
    expect(formatMoneyShort(300_000_000)).toBe('$300M');
    expect(formatMoneyShort(250_000)).toBe('$250K');
  });

  it('keeps one decimal only where it carries the story', () => {
    // $1.2B vs $1.9B is the whole difference; $237M vs $237.4M is noise.
    expect(formatMoneyShort(1_200_000_000)).toBe('$1.2B');
    expect(formatMoneyShort(4_500_000)).toBe('$4.5M');
    expect(formatMoneyShort(237_400_000)).toBe('$237M');
  });

  it('never leaves a trailing .0 hanging in the caption', () => {
    expect(formatMoneyShort(1_000_000_000)).toBe('$1B');
    expect(formatMoneyShort(5_000_000)).toBe('$5M');
  });

  it('rounds up across a unit boundary rather than printing $1000M', () => {
    expect(formatMoneyShort(999_000_000)).toBe('$999M');
    expect(formatMoneyShort(1_000_000)).toBe('$1M');
  });

  it('leaves small change alone', () => {
    expect(formatMoneyShort(999)).toBe('$999');
    expect(formatMoneyShort(0)).toBe('$0');
  });

  it('takes the fallback for anything that is not a number', () => {
    expect(formatMoneyShort(null)).toBe('');
    expect(formatMoneyShort(undefined, '—')).toBe('—');
    expect(formatMoneyShort(NaN, '—')).toBe('—');
    expect(formatMoneyShort(Infinity, '—')).toBe('—');
  });
});

describe('formatProfit', () => {
  // "$240M" and "lost $240M" are opposite facts, and the caption has no room
  // to say which — so the sign carries it.
  it('signs a hit and a flop differently', () => {
    expect(formatProfit(200_000_000, 900_000_000)).toBe('+$700M');
    expect(formatProfit(300_000_000, 60_000_000)).toBe('−$240M');
  });

  it('uses a true minus sign, which lines up with digits', () => {
    expect(formatProfit(300_000_000, 60_000_000).startsWith('−')).toBe(true);
    expect(formatProfit(300_000_000, 60_000_000).startsWith('-')).toBe(false);
  });

  it('does not sign an exact break-even', () => {
    expect(formatProfit(100_000_000, 100_000_000)).toBe('$0');
  });

  it('takes the fallback when either figure is missing', () => {
    expect(formatProfit(null, 900, '—')).toBe('—');
    expect(formatProfit(900, undefined, '—')).toBe('—');
  });
});

describe('formatReturn', () => {
  it('states what came back as a share of what went in', () => {
    expect(formatReturn(200_000_000, 900_000_000)).toBe('450%');
    expect(formatReturn(300_000_000, 60_000_000)).toBe('20%');
    expect(formatReturn(100, 100)).toBe('100%'); // break-even
  });

  // Several very different disasters would otherwise all read "0%".
  it('keeps a decimal on a genuine catastrophe', () => {
    expect(formatReturn(100_000_000, 4_500_000)).toBe('4.5%');
    expect(formatReturn(100_000_000, 900_000)).toBe('0.9%');
  });

  // Infinity would sort and read above every real film.
  it('refuses a zero budget rather than printing infinity', () => {
    expect(formatReturn(0, 500_000_000, '—')).toBe('—');
    expect(formatReturn(-5, 500, '—')).toBe('—');
  });

  it('takes the fallback when either figure is missing', () => {
    expect(formatReturn(undefined, 500, '—')).toBe('—');
    expect(formatReturn(500, null, '—')).toBe('—');
  });
});
