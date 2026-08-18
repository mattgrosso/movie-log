import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Bug report (2026-08-18): "The lightning bolt on the input has a Z index it's
// too high so it's appearing over some other things in particular the sort
// order drop down can pop up and be in that same spot but the lightning bolt
// is still visible on top of it."
//
// The bolt needs `z-index: 5` to sit above the input it lives inside. The bug
// was that `.search-input-group` — `position: relative` with `z-index: auto` —
// does NOT create a stacking context, so that 5 escaped into the ROOT stacking
// context and outranked every page-level overlay stacking below it. Confirmed
// live on cinemaroll.org before the fix: a `position: fixed; z-index: 1`
// element parked over the bolt lost the hit test to the bolt's own glyph;
// adding `isolation: isolate` to the group flipped it, with the bolt still
// rendering normally inside the input.
//
// This is a paint-order contract, and jsdom performs no layout or painting
// (see .claude/rules/testing.md), so it cannot be asserted through a mount.
// Asserting it against the stylesheet source is the honest option — same
// approach databaseRules.test.js takes for a rule that only exists in a file.
// What it guards is narrow but exactly right: nobody can drop the containment
// and quietly restore the bug while every other Home test stays green.
const homePath = join(process.cwd(), 'src/components/Home.vue');
const homeSource = readFileSync(homePath, 'utf8');

// Comments are stripped before any of this is matched. The first draft of
// this test did not, and passed against the reverted fix: the explanatory
// comment above the declaration says "z-index: 5", which satisfied the
// numeric-z-index branch all by itself. A test that matches its own prose is
// not a regression guard.
const withoutComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

// The declarations directly on `.search-input-group`, up to its first nested
// rule — enough to see the group's own positioning without matching the
// nested `.search-quick-links-toggle` block inside it.
const groupBlock = () => {
  const start = homeSource.indexOf('.search-input-group {');
  expect(start, '.search-input-group rule should exist in Home.vue').toBeGreaterThan(-1);
  const body = withoutComments(homeSource.slice(start));
  return body.slice(0, body.indexOf('{', body.indexOf('{') + 1));
};

describe('the quick-links bolt cannot paint over page overlays', () => {
  it('gives .search-input-group its own stacking context', () => {
    const block = groupBlock();
    // `isolation: isolate` is the declaration with no other effect — it does
    // not move the element or change what it stacks against, only where its
    // children's z-indexes apply. An explicit numeric z-index would also work
    // and is accepted here, since either one contains the bolt.
    const isolates = /isolation:\s*isolate/.test(block);
    const hasNumericZIndex = /z-index:\s*-?\d+/.test(block);

    expect(
      isolates || hasNumericZIndex,
      '.search-input-group must establish a stacking context, or the bolt\'s '
      + 'z-index escapes to the root context and paints over page overlays',
    ).toBe(true);
  });

  it('still lifts the bolt above the input beside it', () => {
    const start = homeSource.indexOf('.search-quick-links-toggle {');
    expect(start).toBeGreaterThan(-1);
    const rule = withoutComments(homeSource.slice(start, homeSource.indexOf('}', start)));

    // The containment is only correct because the bolt keeps a z-index at all:
    // it has to stay above the input's own background within the group.
    expect(rule).toMatch(/z-index:\s*\d+/);
    expect(rule).toMatch(/position:\s*absolute/);
  });
});
