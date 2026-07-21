// Single source of truth for the personal-awards category list, shared by
// PersonalAwardsModal.vue (where they're nominated/won) and MovieDetail.vue
// (where a movie's personal-award history is displayed). Keeping this in one
// place means the two can never drift out of sync on key/name/type.
export const PERSONAL_AWARD_CATEGORIES = [
  { key: 'bestPicture', name: 'Best Picture', type: 'movie' },
  { key: 'bestDirector', name: 'Best Director', type: 'person' },
  { key: 'bestActor', name: 'Best Actor', type: 'person' },
  { key: 'bestActress', name: 'Best Actress', type: 'person' },
  { key: 'bestSupportingActor', name: 'Best Supporting Actor', type: 'person' },
  { key: 'bestSupportingActress', name: 'Best Supporting Actress', type: 'person' },
  { key: 'bestScreenplay', name: 'Best Screenplay or Writing', type: 'movie' },
  { key: 'bestCinematography', name: 'Best Cinematography', type: 'movie' },
  { key: 'bestEditing', name: 'Best Editing', type: 'movie' },
  { key: 'bestScore', name: 'Best Score or Music', type: 'movie' },
  { key: 'bestVisualEffects', name: 'Best Visual Effects or Production Design', type: 'movie' },
  { key: 'bestAnimatedFeature', name: 'Best Animated Feature', type: 'movie' },
  { key: 'bestDocumentaryFeature', name: 'Best Documentary Feature', type: 'movie' },
];

export const PERSONAL_AWARD_CATEGORY_NAMES = PERSONAL_AWARD_CATEGORIES.reduce((acc, category) => {
  acc[category.key] = category.name;
  return acc;
}, {});
