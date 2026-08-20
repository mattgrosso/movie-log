---
paths:
  - "src/components/PersonalAwardsModal.vue"
  - "src/components/TrophyCase.vue"
  - "src/components/TweakInline.vue"
  - "src/assets/javascript/personalAwards*.js"
  - "src/assets/javascript/awardStats.js"
  - "src/assets/javascript/otherAwards.js"
  - "src/assets/javascript/genderEligibility.js"
  - "src/assets/javascript/tieBreakTournament.js"
---

# Awards & tiebreak rules

Full narrative: `docs/history/awards.md`.

## Personal awards

Stored at `settings/personalAwards/<year>` as
`{ categories: { <key>: { nominees, winner } } }`, nominees/winner in "minimal" form
carrying a `movieId`. `PERSONAL_AWARD_CATEGORIES` lives in
`personalAwardsCategories.js` so consumers don't duplicate and drift from the list.

- **The modal must never auto-close.** Completion date is set only when the user clicks
  "Complete Awards". Eligibility logic must keep showing years with *partial* progress —
  three separate computeds got this wrong at once and made the modal vanish mid-work.
- **`getOptionId` special-cases `bestDirector`** to always return `movie-<movieId>`.
  A freshly-computed Director option is a movie-group with no top-level `id`; one restored
  through `convertNomineeToMinimal`/`expandNomineeFromMinimal` has the id promoted to top
  level. Without the special case they never match and saved directors don't highlight.
- **Acting grids load 3 cast per movie initially**, so `extractAndGroupPeopleByMovie`
  always appends already-nominated cast members regardless of the gender heuristic, with a
  dedupe guard in `loadMoreForMovie`.
- **Use the user's own award name.** `settings.personalAwardName` (default 'Oscar') via
  `awardNameWithThe`/`awardNameWithoutThe`/`awardNameSingular` in `personalAwards.js` —
  never hardcode "Personal" or "Oscar".

## Acting-category gender eligibility

**One source: `genderEligibility.js`'s `isEligibleForActingCategory`.** Two copies had
drifted, and one silently excluded every TMDB `gender: 0` ("not specified") person from
*both* acting categories, making them unnominatable with no error.

Rule: anything that isn't a definite female/male reading — missing, `0`, or `3`
(non-binary) — is eligible for **every** acting category. Being wrongly offered a
nomination is harmless; being silently unnominatable is not. Guard with
`Number.isFinite`, not `typeof x === 'number'` (`typeof NaN` is `'number'`).

## Award statistics

`awardStats.js` — two deliberate modelling decisions, don't "fix" them:

- **A winner is also a nominee.** The modal only lets you pick a winner from selected
  nominees, so nomination counts include wins. That's what people expect.
- **A person's award counts for their film.** "Titanic won 11" includes its acting and
  directing wins.

Ties break alphabetically; `minCount` defaults to 2.

## Trophy Case images

**A person never gets a movie poster.** Branch on winner type (`expanded.name` present =
person): stored `details.profile_path` → TMDB `/search/person` lookup → their initial. A
wrong picture is worse than a letter. Movies get their poster. Note `expanded.details` is
real — populated two hops away in `PersonalAwardsModal.convertNomineeToMinimal`; grepping
one file is not enough to conclude that branch is dead.

## Round-robin tiebreak

`tieBreakTournament.js` is pure and store-free. `findTiedGroup` expands to the full
contiguous run of equal scores; `createRoundRobinTournament(ids, rng)` builds every pair
(pass `Math.random` to shuffle match order).

- **`tweakDeltaForRank` is not a score delta.** `tweakValue` feeds `overall`, weighted 2
  and divided by 10, then rounded to 2dp — so the visible score moves by a *fifth* of the
  tweak. `-0.05` is the smallest step that moves the displayed score at all. Anything
  smaller vanishes in rounding and makes the same tournament recur forever.
- **Membership is frozen at creation.** `findTiedGroup` only runs when no tournament
  record exists, so a movie rated mid-tournament can't be pulled in.
- **Scores are applied in one batch** at the results screen, never per match.
- Trigger on a `needsNewTournament` computed, not on `showTweakModal` *changing* — the
  "force tiebreak" testing toggle pins it true so it never changes again.
- A 2-contestant tie skips the tournament ceremony entirely and always closes + stamps
  `lastTweak`, never chaining into a different tied group.
- **Stamping `lastTweak` is not enough to enforce the delay.** Home pins the prompt open
  for as long as a tournament RECORD exists (so nothing steals the screen mid-tournament)
  and consults the daily quota only when there is none. So *creating* the next tournament
  right after "Done" walks straight past the delay that was just set — reported as "I just
  finished a tie break tournament and it is immediately offering me another one". Only the
  `forced` prompt state chains into the next tied group; otherwise `justAcknowledged`
  blocks `needsNewTournament` until the prompt has actually closed once, so the answer
  doesn't depend on Vue's flush ordering between the parent's prop update and the child's
  watcher.
