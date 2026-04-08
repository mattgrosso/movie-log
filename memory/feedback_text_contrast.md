---
name: Text Contrast - Always Check Against Dark Backgrounds
description: Matt is repeatedly frustrated by dark text on dark backgrounds. Always verify text color before shipping UI changes.
type: feedback
---

Always explicitly set a text color class on any new UI element. Never assume Bootstrap's default text color will be visible.

**Why:** This app uses dark themes throughout. Bootstrap's default text color is dark/black, which is invisible on dark backgrounds. Matt has flagged this multiple times and finds it very annoying.

**How to apply:**
- Every new table, card, list, or text block needs an explicit color class: `text-light`, `text-white`, `text-muted`, or `text-secondary`
- `table-dark` alone does NOT make the text light — you need `text-light` too
- `text-muted` and `text-secondary` render as grey, which is fine for secondary info on dark backgrounds
- Before finishing any UI change, mentally trace every piece of text and ask: what color is this, and what color is the background behind it?
- When in doubt, add `text-light` explicitly rather than relying on inheritance
