import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Bug report 2026-08-26: "When I click the toggle for adjusted for inflation,
// it shouldn't close that sort drop down because then I just have to reopen it
// and pick another thing."
//
// The cause, found by reproducing it against real Bootstrap 5.3.3 rather than
// by reading the source: **Bootstrap registers its delegated data-api handlers
// with useCapture TRUE** (EventHandler passes the `delegation` flag straight
// into addEventListener's third argument). So the document-level
// [data-bs-toggle] click handler runs BEFORE anything inside the menu can see
// the event. While the <ul> was nested inside the toggle <button>, every click
// in the menu therefore reached the toggle and shut it, and NO amount of
// @click.stop could prevent it — two attempts failed exactly that way.
//
// The fix is to take the toggle out of the event path: the <ul> is now a
// SIBLING of the button inside the existing .btn-group, which is Bootstrap's
// own documented structure. Picking a sort closes the menu again on its own
// (clearMenus), and the money toggle's @click.stop now works because the
// event only has to be stopped before it reaches document in the BUBBLE
// phase, which is where clearMenus lives.
//
// The other way to fix it — wrapping the toggle in <div class="dropdown"> —
// is a trap, guarded below.
//
// Asserted against the source: jsdom loads no Bootstrap JS, so a mounted
// component has no dropdown to open and a test that tried would pass against
// the broken page.
const source = () => readFileSync(join(process.cwd(), 'src/components/Home.vue'), 'utf8');

const actionsRow = () => {
  const text = source();
  const start = text.indexOf('class="results-actions col-12');
  const end = text.indexOf('<section class="home-notices">');
  return text.slice(start, end);
};

describe('the sort menu closes on a pick and stays open on the money toggle', () => {
  it('keeps the menu OUT of the toggle button', () => {
    const row = actionsRow();
    const buttonClose = row.indexOf('</button>', row.indexOf('data-bs-toggle="dropdown"'));
    const menuOpen = row.indexOf('<ul class="dropdown-menu"');
    expect(menuOpen).toBeGreaterThan(-1);
    // The toggle must be closed BEFORE the menu opens, or the menu is nested
    // inside it again and Bootstrap's capture-phase handler wins.
    expect(buttonClose).toBeLessThan(menuOpen);
  });

  it('lets the money toggle stop its own click', () => {
    expect(actionsRow()).toContain('@click.stop="toggleMoneyInflation"');
  });

  // Closing is Bootstrap's job again. An explicit hide here would mean the
  // menu is being stopped somewhere it shouldn't be.
  it('does not hand-roll the close', () => {
    expect(source()).not.toContain('closeSortMenu');
    expect(actionsRow()).not.toContain('<ul class="dropdown-menu" @click.stop>');
  });

  // THE TRAP. These chips take their colours from
  // .results-actions-button:nth-child(N), and `flex: 1 1 0` sits on the
  // button rather than on any wrapper — so wrapping the toggle recolours and
  // resizes the row. The <ul> is only safe as a sibling because the sort chip
  // is the LAST button in the group; putting it anywhere earlier would shift
  // every chip after it.
  it('never wraps the toggle, and keeps the sort chip last', () => {
    const row = actionsRow();
    expect(row).not.toContain('<div class="dropdown');

    const buttons = [...row.matchAll(/<button[^>]*class="results-actions-button/g)];
    // Scoped to each button's OWN tag — a fixed lookahead window spills into
    // the next button and finds the toggle one chip early.
    const toggleIndex = buttons.findIndex((m) => row.slice(m.index, row.indexOf('>', m.index)).includes('data-bs-toggle="dropdown"'));
    expect(buttons.length).toBeGreaterThan(1);
    expect(toggleIndex).toBe(buttons.length - 1);
  });
});
