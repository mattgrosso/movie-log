// Scrolls the document to an absolute Y position, reliably.
//
// The app sets `scroll-behavior: smooth` on <html>, and under it BOTH the
// obvious ways to scroll programmatically silently do nothing in this app -
// verified live in a real browser:
//   document.documentElement.scrollTop = 900  ->  stays put
//   window.scrollTo({ top: 0 })               ->  stays put
//   window.scrollTo(0, 300)                   ->  stays put
//   window.scrollTo({ top: 0, behavior: 'instant' })  ->  works
// So every programmatic document scroll in this app must pass an explicit
// 'instant' (or an explicit 'smooth' if animation is genuinely wanted -
// that path works, it's only the INHERITED CSS behaviour that fails).
//
// This was found while fixing games inheriting Home's scroll position, and
// it turned out Home's own "put me back where I was in the grid when I come
// back from a movie's detail page" restoration had been silently broken the
// same way - it used the scrollTop-assignment form.
export function scrollWindowTo (top) {
  window.scrollTo({ top, behavior: 'instant' });
}
