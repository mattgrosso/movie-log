import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Bug report 2026-08-26: "When I click the toggle for adjusted for inflation,
// it shouldn't close that sort drop down because then I just have to reopen it
// and pick another thing. It should just toggle it in place."
//
// The cause is structural. The <ul class="dropdown-menu"> lives INSIDE the
// <button data-bs-toggle="dropdown">, so every click in the menu bubbles up to
// the toggle and Bootstrap's delegated [data-bs-toggle] handler toggles the
// menu shut. That is the behaviour we want when picking a sort and the wrong
// one for a checkbox you flip and then keep choosing from.
//
// Restructuring was the obvious fix and is a trap: the chips in that row take
// their rainbow colours from `.results-actions-button:nth-child(N)`, so
// wrapping the toggle in the `<div class="dropdown">` Bootstrap documents
// would break every colour after it. So the menu stops its own clicks and
// closing became explicit.
//
// Asserted against the source: jsdom loads no Bootstrap JS, so a mounted
// component here has no dropdown to open and a test that tried would pass
// against the broken page.
const source = () => readFileSync(join(process.cwd(), 'src/components/Home.vue'), 'utf8');

describe('the sort menu closes on a pick and stays open on the money toggle', () => {
  it('stops clicks inside the menu from reaching the toggle', () => {
    expect(source()).toContain('<ul class="dropdown-menu" @click.stop>');
  });

  it('closes explicitly after a sort is picked', () => {
    const method = source().match(/setOrToggleSortValue \(value\) \{[\s\S]*?\n {4}\}/);
    expect(method).not.toBeNull();
    expect(method[0]).toContain('this.closeSortMenu()');
  });

  it('does NOT close when the money toggle is flipped', () => {
    const method = source().match(/toggleMoneyInflation \(\) \{[\s\S]*?\n {4}\}/);
    expect(method).not.toBeNull();
    expect(method[0]).not.toContain('closeSortMenu');
  });

  it('reaches the toggle by ref rather than a document query', () => {
    const method = source().match(/closeSortMenu \(\) \{[\s\S]*?\n {4}\}/);
    expect(method[0]).toContain('this.$refs.sortToggle');
    expect(method[0]).toContain('Dropdown.getInstance');
  });

  // The rainbow's colours are positional. If a future change wraps this
  // button, every chip after it changes colour.
  it('leaves the toggle a direct child of the actions row', () => {
    const text = source();
    const rowStart = text.indexOf('class="results-actions col-12');
    const toggleStart = text.indexOf('ref="sortToggle"');
    expect(toggleStart).toBeGreaterThan(rowStart);
    // No wrapper element introduced between the row and the button.
    expect(text.slice(rowStart, toggleStart)).not.toContain('<div class="dropdown');
  });
});
