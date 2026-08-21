import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Bug report (2026-08-21): "On the film club page of recent movies from friends
// the hat corners are appearing below the posters instead of on top of them."
//
// SendToHat's root carried `position: relative`. Two callers pin that same root
// to a poster's corner with `position: absolute` (`.cs-poster-hat` in
// FilmClubScreen, `.cc-poster-hat` in ClubCharts). Those are parent-scoped
// rules on a child component's root, so they compile to exactly the same
// specificity as the component's own rule — `.x[data-v-…]`, 0-2-0 either way —
// and the winner is decided purely by order in the emitted stylesheet.
//
// Confirmed against a real build before fixing: `.send-to-hat[data-v-330a5df4]
// {position:relative}` was emitted THREE times (once per chunk importing the
// component), at byte offsets 346771, 436607 and 531948, while
// `.cs-poster-hat` landed at 353243 and `.cc-poster-hat` at 367010. Two copies
// of `relative` therefore came last and won, and `relative` leaves the button
// in normal flow — directly below the poster, exactly as reported.
//
// Nothing inside the component needs a containing block from that root: the
// wedge is `.hat-icon-button::before`, contained by `.hat-icon-button`'s own
// `position: relative`, and both pickers are teleported to <body> and fixed.
//
// This is a paint/layout-order contract and jsdom does no layout (see
// .claude/rules/testing.md), so it cannot be asserted through a mount.
// Asserting against the stylesheet source is the honest option, same as
// searchBoltStacking.test.js.
const read = (relative) => readFileSync(join(process.cwd(), relative), 'utf8');

// Comments are stripped before anything is matched. searchBoltStacking.test.js
// learned this the hard way, and the trap is live here too: the comment that
// replaced the offending declaration explains the bug using the words
// "position: relative", which would satisfy a naive search all by itself.
const withoutComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const styleBlock = (source) => {
  const start = source.indexOf('<style');
  expect(start, 'component should have a <style> block').toBeGreaterThan(-1);
  return withoutComments(source.slice(start));
};

/** The declarations directly on a selector, up to its closing brace. */
const ruleBody = (css, selector) => {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) return null;
  const end = css.indexOf('}', start);
  return css.slice(start + selector.length + 2, end);
};

describe('SendToHat root positioning', () => {
  const css = styleBlock(read('src/components/SendToHat.vue'));

  // The root may carry no rule at all, which is the current state and is fine.
  // What it must never do is set `position` — that is what overrode the callers.
  it('does not set position on its own root', () => {
    const body = ruleBody(css, '.send-to-hat');
    if (body === null) return;
    expect(body).not.toMatch(/(^|[\s;])position\s*:/);
  });

  it('does not set position on the variant roots either', () => {
    for (const selector of ['.send-to-hat-icon', '.send-to-hat-default']) {
      const body = ruleBody(css, selector);
      if (body === null) continue;
      expect(body, `${selector} should not position the root`).not.toMatch(/(^|[\s;])position\s*:/);
    }
  });

  // The wedge still needs its own containing block. If this ever moves back up
  // to the root, the bug returns by a different route.
  it('keeps the containing block for the wedge on the button', () => {
    const button = ruleBody(css, '.hat-icon-button');
    expect(button, '.hat-icon-button rule should exist').not.toBeNull();
    expect(button).toMatch(/position\s*:\s*relative/);
  });
});

describe('the callers that pin the hat to a poster corner', () => {
  const cases = [
    ['src/components/FilmClubScreen.vue', '.cs-poster-hat'],
    ['src/components/ClubCharts.vue', '.cc-poster-hat'],
  ];

  it.each(cases)('%s still positions %s absolutely', (file, selector) => {
    const body = ruleBody(styleBlock(read(file)), selector);
    expect(body, `${selector} should exist in ${file}`).not.toBeNull();
    expect(body).toMatch(/position\s*:\s*absolute/);
  });
});
