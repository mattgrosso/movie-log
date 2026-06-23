// Deterministic year-picker for the "year ready for awards" prompt.
//
// Inputs:
//   incompleteYears        — number[]: years that need work (not explicitly completed, or have new movies)
//   personalAwards         — { [year]: { completed, categories, ... } }: stored awards state
//   dailyAwardsYear        — number | null | undefined: year persisted earlier today, if any
//   dailyAwardsYearDate    — string | null | undefined: toDateString() value when dailyAwardsYear was persisted
//   todayString            — string: new Date().toDateString() for the current call
//   selectedYearProp       — number | null | undefined: explicit override (e.g., Resume Awards button)
//
// Behavior:
//   1. If selectedYearProp is provided, return it (explicit user intent wins).
//   2. If dailyAwardsYear was set today AND is still incomplete, keep it (sticky).
//   3. Otherwise prefer the oldest year with partial progress; fall back to the oldest incomplete year.
//
// This function is pure: same inputs → same output. No randomness, no side effects.
export function pickEligibleAwardsYear ({
  incompleteYears,
  personalAwards,
  dailyAwardsYear,
  dailyAwardsYearDate,
  todayString,
  selectedYearProp
}) {
  if (selectedYearProp != null) {
    return selectedYearProp;
  }

  if (!Array.isArray(incompleteYears) || incompleteYears.length === 0) {
    return null;
  }

  const awards = personalAwards || {};

  // Sticky: keep today's selection unless it's been completed.
  if (dailyAwardsYear != null && dailyAwardsYearDate === todayString) {
    const existing = awards[dailyAwardsYear];
    const isCompleted = !!(existing && existing.completed);
    if (!isCompleted && incompleteYears.includes(dailyAwardsYear)) {
      return dailyAwardsYear;
    }
  }

  // Deterministic pick: prefer years with partial progress, then any incomplete year. Oldest wins.
  const yearsWithPartialProgress = incompleteYears.filter((year) => {
    const existing = awards[year];
    if (!existing || !existing.categories) return false;
    return Object.values(existing.categories).some(
      (category) =>
        (category.nominees && category.nominees.length > 0) ||
        category.winner ||
        category.noNominees
    );
  });

  const sortAsc = (a, b) => a - b;
  if (yearsWithPartialProgress.length > 0) {
    return [...yearsWithPartialProgress].sort(sortAsc)[0];
  }
  return [...incompleteYears].sort(sortAsc)[0];
}
