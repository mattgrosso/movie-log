/**
 * Stops the page behind a teleported sheet from scrolling while it is open.
 *
 * Extracted from WhereToWatch when MoviePreview needed the same thing. The
 * detail below was expensive to establish and must not be re-derived by
 * copy-paste in a third sheet.
 *
 * Bug report, 2026-08-19: "it appears to be like a modal like a slide up
 * modal, but I can still scroll the content behind it so it should probably
 * prevent that."
 *
 * These sheets are teleported to <body> and their backdrop covers the
 * viewport, but a fixed overlay does not stop the document underneath from
 * scrolling — on a touch screen a drag that starts on the backdrop, or
 * continues past the sheet's own scroll extent, moves the page.
 *
 * BOTH <html> and <body> are held, and that is not belt-and-braces. In this
 * app document.scrollingElement is <html>: measured on the deployed page,
 * holding <body> alone left the computed overflow-y on <html> at `visible`,
 * so the element a finger actually scrolls was never constrained. With both
 * held it reads `hidden` while the sheet is open and returns to `visible` on
 * close.
 *
 * Note for anyone re-checking this: window.scrollTo() is NOT a valid probe.
 * An overflow: hidden box is still programmatically scrollable by spec, so
 * scrollTo moves the page either way — it "failed" for the fixed version too.
 * Read the computed overflow, or use a real wheel/touch gesture.
 *
 * Previous inline values are restored rather than assumed to be '', since
 * something else may legitimately have set them.
 */
export default {
  data () {
    return {
      // The inline overflow of <html> and <body>, saved while a sheet holds
      // them at 'hidden'. null means "we are not currently holding them".
      previousOverflow: null
    };
  },
  // Never leave the page locked because the component was torn down while
  // open (its screen unmounting mid-sheet, say) — the whole app would become
  // unscrollable with nothing on screen to explain why.
  beforeUnmount () {
    this.lockBackgroundScroll(false);
  },
  methods: {
    lockBackgroundScroll (locked) {
      if (typeof document === 'undefined') return;
      const targets = [document.documentElement, document.body].filter(Boolean);
      if (!targets.length) return;

      if (locked) {
        if (this.previousOverflow === null) {
          this.previousOverflow = targets.map((el) => el.style.overflow);
        }
        targets.forEach((el) => { el.style.overflow = 'hidden'; });
        return;
      }

      if (this.previousOverflow !== null) {
        targets.forEach((el, index) => { el.style.overflow = this.previousOverflow[index] ?? ''; });
        this.previousOverflow = null;
      }
    }
  }
};
