# Overnight notes — night of 2026-08-15 → 16

> **Outcome: Custom Lists was built, then removed at Matt's request (v1.58.6).**
> He asked what lists were actually for, I couldn't make a case that beat his
> existing search + Movie Hat — the killer limitation being that a list could
> only hold movies he'd already rated, so it could never be a want-to-watch
> queue — and he called it: rip it out. The build is preserved in git history
> (v1.58.0–1.58.5) if the idea ever comes back, ideally with unseen movies
> allowed. **The delta-sync finding below is the part that survived, and it's
> the more valuable half of the night anyway.**

---

## Second thing I did: delta-sync shadow mode was lying (v1.58.4)

I chased the `[delta-shadow] DIVERGENCE` warnings and they were a **bug in the
instrumentation, not in delta sync**.

Every reported divergence had identical `updatedAt` stamps on both sides and
exactly one differing field: **`dbKey`**. That field (and `_search`) is injected
when an entry is read and is never stored — so the full download carries it and
entries rebuilt from raw Firebase delta rows don't. `diffLibraries` compared
whole entries, so **any launch with recent activity flagged every entry that came
through the delta path.**

This matters more than the noise: the **phase-2 go/no-go (board T4 #7, due
~Aug 18) was going to be decided on this signal**, and the signal was broken in
the direction of "delta sync is unreliable".

Fixed by excluding runtime-injected fields from the comparison, guarded both
ways (runtime-only differences compare identical; a real rating difference still
reports stale).

**First clean reading, on the tester's 1,372-entry library:**

```
identical: true, compared: 1372, deltaEntryCount: 26, stale: 0, missing: 0, extra: 0
```

That is delta reconstruction proving byte-identical to a full download. **Discard
every shadow report from before v1.58.4**; collect a few days of fresh ones and
the phase-2 decision has something real to stand on. Note this is the tester's
library — your account should be watched on its own before deciding.
