---
name: Personal Awards Modal Bug Fixes
description: Known bugs and fixes attempted for the PersonalAwardsModal year selection logic
type: project
---

## Bug: Banner shows one year, modal opens a different year (or null)

**Symptoms reported (2026-04-08):**
- Banner prompt says one year is available, but clicking it opens a different year
- Sometimes the year shows as null/blank, and clicking opens a modal with no nominees

**Root causes identified:**
1. `firstEligibleYear` is a computed property that picks a random year AND saves it to Firebase as `dailyAwardsYear`. Because computed properties re-run reactively, it could pick a different year between the banner render and the modal open.
2. `openModal()` read `dailyAwardsYear` from the store separately from `firstEligibleYear`, creating a race condition where the store hadn't updated yet before the modal read it.
3. `completeYearAndClose()` explicitly sets `dailyAwardsYear` to `null` in Firebase. The old `dailySelection &&` check was truthy-falsy and would incorrectly skip `null`, causing `firstEligibleYear` to fall through and pick a new random year — which could then be returned as the banner year before the random pick completed.

**Fixes applied (2026-04-08):**
1. `openModal()` — removed separate `dailySelection` read, now uses `this.selectedYear || this.firstEligibleYear` directly so banner and modal always show the same year.
2. `firstEligibleYear` — added guard `dailySelection !== selectedYear` to prevent unnecessary Firebase re-saves on every computed re-evaluation.
3. `firstEligibleYear` — changed `dailySelection &&` to `dailySelection != null &&` to properly handle the explicit `null` written after year completion.

**Status:** Deployed but hard to regression test. If the bug recurs, check:
- Whether `dailyAwardsYear` in Firebase is being set correctly before the banner renders
- Whether `firstEligibleYear` is still being called multiple times in quick succession (add a console.log temporarily)
- Whether the `selectedYear` prop passed from Home.vue (`dailyAwardsYear` from store) is arriving as null when it shouldn't be
