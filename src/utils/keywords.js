import uniq from 'lodash/uniq';

// Merge a movie's TMDB + AI + user-added keywords, then hide any the user removed.
// Returns a flat, de-duped array of keyword strings.
export function computeFlatKeywords(movie) {
  if (!movie) return [];
  const flatTMDBKeywords = movie.keywords ? movie.keywords.map((k) => k.name) : [];
  const flatChatGPTKeywords = movie.chatGPTKeywords || [];
  const customKeywords = movie.customKeywords || [];
  const removedKeywords = movie.removedKeywords || [];
  const merged = uniq([...flatTMDBKeywords, ...flatChatGPTKeywords, ...customKeywords]);
  return removedKeywords.length ? merged.filter((k) => !removedKeywords.includes(k)) : merged;
}
