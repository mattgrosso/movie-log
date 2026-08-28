// Push notification preferences — the shared shape the settings UI, the
// store, and the push Lambda all agree on. Stored at `{topKey}/push/prefs`.
//
// Category toggles mirror the four notification sources Matt named
// (2026-08-27): the three home-screen prompts, plus friend logs.
//
// CADENCE (Matt, 2026-08-28: "It'll be nice if it just happened more
// regularly, you know, as the prompts come in"):
//   'asTheyCome' — the default. The Lambda sweeps every 15 minutes and pings
//     when something NEW is waiting, inside the waking window, spaced by
//     `pushesPerDay`. It deliberately does NOT re-announce a backlog it has
//     already mentioned — see aws-lambda/pushCadence.js, which owns every
//     one of those rules and is where the tests live.
//   'daily' — the original behaviour, one nudge at `hour`.
//
// `tz` places all of it in local time, so a trip abroad doesn't shift the
// nudges to 3am — as long as the app is opened there once to re-save it.

export const PUSH_PREF_DEFAULTS = {
  enabled: true,
  stickiness: true,
  tiebreak: true,
  awards: true,
  friendLogs: true,
  cadence: 'asTheyCome',
  // Waking hours. Anything maturing overnight waits for the morning.
  windowStart: 9,
  windowEnd: 21,
  // Spread across the window, so 4 across 9am–9pm is one every three hours —
  // a ceiling, not a target: with nothing new to say, nothing is sent.
  pushesPerDay: 4,
  // Only used by the 'daily' cadence. 7pm local: these are sit-down-with-the-
  // app tasks, and evening is when movies happen.
  hour: 19
};

export function pushPrefsWithDefaults (stored) {
  return {
    ...PUSH_PREF_DEFAULTS,
    tz: (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'America/New_York',
    ...(stored || {})
  };
}
