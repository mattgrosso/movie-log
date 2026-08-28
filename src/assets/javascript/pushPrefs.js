// Push notification preferences — the shared shape the settings UI, the
// store, and the push Lambda all agree on. Stored at `{topKey}/push/prefs`.
//
// Category toggles mirror the four notification sources Matt named
// (2026-08-27): the three home-screen prompts, plus friend logs. `hour`/`tz`
// place the daily digest: the Lambda sweeps hourly and sends when the user's
// LOCAL hour matches, so a trip abroad doesn't silently shift the nudge to
// 3am — as long as the app has been opened there once to re-save the tz.

export const PUSH_PREF_DEFAULTS = {
  enabled: true,
  stickiness: true,
  tiebreak: true,
  awards: true,
  friendLogs: true,
  // 7pm local: these are sit-down-with-the-app tasks, and evening is when
  // movies happen.
  hour: 19
};

export function pushPrefsWithDefaults (stored) {
  return {
    ...PUSH_PREF_DEFAULTS,
    tz: (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'America/New_York',
    ...(stored || {})
  };
}
