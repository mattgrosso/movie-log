---
paths:
  - "src/**/*.vue"
  - "src/assets/scss/**"
---

# UI rules (Vue components)

Cinema Roll is a **mobile-first PWA installed on iOS home screens**. Nearly every UI
bug in this project's history came from forgetting that. Full narrative:
`docs/history/ui-and-layout.md`.

## Never use `:hover` for feedback — use `:active`

A tapped element keeps its hover state on iOS, because there is no mouse to leave it.
This has shipped as a user-visible bug **more than once** (tiebreak posters "stuck
grown" after selection; game tiles). Add `:active` press states; add `:hover` only as a
redundant extra for mouse users, never as the only feedback.

## Always check contrast

Dark themes throughout. Before shipping any UI change, verify text is legible against
its actual background. Bootstrap's `.text-muted` (~#6c757d) **fails** against this app's
`#4a4a4a` panels (~2.3:1) — use `#ccc` (~6:1), as `.result-wins` does.

## Every programmatic document scroll needs an explicit `behavior`

`<html>` has `scroll-behavior: smooth`, which makes these **silent no-ops**:

```js
window.scrollTo({ top: 0 })              // does nothing
document.documentElement.scrollTop = 900 // does nothing
```

Use `src/utils/scrollWindowTo.js`, or pass `behavior: 'instant'` explicitly. This broke
Home's scroll restoration for a 1,300-movie library without anyone noticing, and made a
first attempt at the games scroll-to-top do nothing at all.

## Style calls Matt has made

- **Poster/photo rows: images edge-aligned, text flows.** In any horizontal
  row of posters or photos, every image's top AND bottom edge must line up:
  fixed image height + `align-items: flex-start` on the row. Text below an
  image may grow to any number of lines — never clamp, ellipse, or
  fixed-height it; the cards just get taller (2026-08-15).

- **No emojis in the UI.** Blanket rule (2026-08-15, after the category-row
  crown): never use emoji glyphs in designs — status marks, winner badges,
  decorations, anything. Use Bootstrap Icons (`bi-*`) with explicit colors
  (gold `#ffd700` for winner marks) or plain styled text instead. Existing
  emojis elsewhere in the app are sweep candidates when touching that code.

- **No left-edge accent bars** (the Bootstrap-ish colored strip on a panel's left
  edge as the only stroke of color) — he's said he's "not that into it" (2026-08-15,
  Trophy Case films panel). Prefer neutral surfaces (#161616/#2e2e2e border) and show
  selection/focus by dimming siblings + subtle scale, not colored outlines. Several
  older screens still carry left-accent banners (Reel Wordle/Connections/Clue Budget
  result banners, target-clues) — sweep candidates, don't add new ones.

## Layout traps that have bitten here

- **Don't put `min-height: 100vh` on a routed component's root.** `.cinema-roll` and
  `.app-main` already handle full-height layout; adding it produces a phantom
  header's-worth of empty scroll on every such page. This was true of 13 components at
  once.
- **Adjacent margins collapse to the larger.** Halving one side of a gap changes nothing
  if the other side dominates — reduce both, and check which rule is actually winning
  before assuming your edit did anything.
- **A percentage height on a flex-sized parent silently does nothing.** Cap by height and
  let `aspect-ratio` derive the width; cross-axis `stretch` sets height but lets flex
  pick the width.
- **A form control's UA-imposed minimum width beats `width: 100%`.** `datetime-local` in
  a narrow Bootstrap column overflowed horizontally and latched the iOS layout viewport
  wider than the screen. `min-width: 0` on `.form-control`/`.form-select` is the fix.
- **An invisible full-height overlay for a gesture will eat real taps.** `BackLink`'s
  20px edge-swipe strip silently ate the leftmost button on every game screen. Listen on
  `window` and filter by touch origin instead.
- **`v-show` does not hide a Bootstrap display utility.** `v-show` writes an inline
  `display: none`; `.d-flex`/`.d-block`/`.d-grid` are `display: … !important`, and
  `!important` in a stylesheet beats a plain inline style. `v-show` on such an element is
  a **silent no-op** — the tiebreak poster row stayed fully laid out under its own loading
  spinner and visibly dropped 180px. Toggle a class you own (`visibility: hidden` keeps the
  space reserved and refuses taps), or put `v-show` on a wrapper that carries no `d-*`
  class. **jsdom will not catch this**: no Bootstrap CSS is loaded there, so a test
  asserting `element.style.display === 'none'` passes against the broken page. Assert the
  class instead.
- **A loading state that replaces content must overlay it, not precede it.** Two siblings
  in normal flow means the content moves the moment the indicator leaves. One
  `position: relative` stage + an `inset: 0` indicator over a hidden-but-present row
  costs zero layout shift.
- **Touch targets: 40px minimum.** Anything smaller gets reported as "the button doesn't
  work."
- **`transform` only during drag** — combining it with `filter`/shadow left visual trails
  on real devices.

## Mid-drag state and animation

A helper that mutates reactive state as its last act, followed by more mutations in the
caller, **paints an intermediate frame** — `await` yields to Vue's scheduler in between.
Keep such mutations in one synchronous block. And `v-for` keys must be identity-based,
never array indices, or insertion makes Vue reuse the wrong DOM nodes.

## Measure at phone width

`.random-banner` is `display: none` above 600px. A desktop-width measurement is of a
layout no phone ever sees — this produced a confident "it fits" that was wrong by 240px.
Force the mobile header and a ~390px container when checking fit.
