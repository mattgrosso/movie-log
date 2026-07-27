import axios from 'axios';
import store from '../../store/index';
import { warmImageCache, posterUrl, backdropUrl } from './offlinePosterCache.js';
import { isPlaceholderId } from '../../utils/placeholderId.js';
import { enqueueWrite, removePendingWrite, updatePendingWrite } from '../../utils/pendingWriteQueue.js';

const getTMDBData = async (rating) => {
  const apiKey = process.env.VUE_APP_TMDB_API_KEY;
  const id = rating.id || rating.tvShowId;

  let dataResp;
  let creditsResp;
  let keywordsResp;

  try {
    if (store.state.currentLog === "tvLog") {
      dataResp = await axios.get(`https://api.themoviedb.org/3/tv/${id}?api_key=${apiKey}`);
      creditsResp = await axios.get(`https://api.themoviedb.org/3/tv/${id}/credits?api_key=${apiKey}`);
      keywordsResp = await axios.get(`https://api.themoviedb.org/3/tv/${id}/keywords?api_key=${apiKey}`);
    } else {
      dataResp = await axios.get(`https://api.themoviedb.org/3/movie/${id}?api_key=${apiKey}`);
      creditsResp = await axios.get(`https://api.themoviedb.org/3/movie/${id}/credits?api_key=${apiKey}`);
      keywordsResp = await axios.get(`https://api.themoviedb.org/3/movie/${id}/keywords?api_key=${apiKey}`);
    }
  } catch (error) {
    console.log(error);
    return;
  }

  return {
    ...dataResp.data,
    ...creditsResp.data,
    keywords: keywordsResp.data.keywords || keywordsResp.data.results
  }
}

const findKeyForTVShowInDatabase = (id) => {
  const keys = Object.keys(store.state.tvLog);
  const entries = keys.map((key) => {
    return {
      ...store.state.tvLog[key],
      key
    }
  })

  const entry = entries.find((entry) => entry.tvShow.id === id);

  if (entry) {
    return entry.key;
  } else {
    return false;
  }
}

const findKeyForMovieInDatabase = (id) => {
  const keys = Object.keys(store.state.movieLog);
  const movies = keys.map((key) => {
    return {
      ...store.state.movieLog[key],
      key
    }
  })

  const movie = movies.find((movie) => movie.movie.id === id);

  if (movie) {
    return movie.key;
  } else {
    return false;
  }
}

const getDirectorsFilmography = async (director) => {
  const filmography = await axios.get(`https://api.themoviedb.org/3/person/${director.id}/movie_credits?api_key=${process.env.VUE_APP_TMDB_API_KEY}`);
  const directingCredits = filmography.data.crew.filter((credit) => credit.job === "Director");

  const minimizedCredits = directingCredits.map((credit) => {
    return {
      id: credit.id,
      popularity: credit.popularity,
      release_date: credit.release_date,
      title: credit.title
    }
  });

  return minimizedCredits;
}

const createTVShowRatingFromEpisodeRatings = (ratings) => {
  if (!ratings.episodes || ratings.episodes.length === 0) {
    return {};
  }

  const keys = Object.keys(ratings.episodes[0]);
  const keysToRemove = ["date", "episode", "medium", "season", "tags", "title", "year", "tvShowId"];
  const filteredKeys = keys.filter((key) => !keysToRemove.includes(key));

  const previousIndex = store.getters.allMediaSortedByRating.findIndex((tvShow) => {
    return tvShow.tvShow.id === ratings.episodes[0].tvShowId;
  });

  const averages = {
    date: new Date().getTime(),
    tvShowId: ratings.episodes[0].tvShowId,
    previousRanking: previousIndex + 1
  };

  filteredKeys.forEach((key) => {
    const sum = ratings.episodes.reduce((total, rating) => total + parseFloat(rating[key]), 0);
    const average = sum / ratings.episodes.length;
    averages[key] = parseFloat(average.toPrecision(2));
  });

  return averages;
};

const collectChatGPTKeywords = (ratings) => {
  const chatGPTKeywords = [];
  ratings.forEach((rating) => {
    if (rating.chatGPTKeywords) {
      rating.chatGPTKeywords.forEach((keyword) => {
        if (!chatGPTKeywords.includes(keyword)) {
          chatGPTKeywords.push(keyword);
        }
      });
    }
  });
  return chatGPTKeywords;
}

const stripOwnership = (ratings) => {
  return ratings.map((rating) => {
    const tempRating = { ...rating };
    delete tempRating.ownership;
    return tempRating;
  });
}

const safeTitleKey = (title) => {
  return `${new Date().getTime()}-${crypto.randomUUID()}-${title.replaceAll(/[-!$%@^&*()_+|~=`{}[\]:";'<>?,./#]/g, "-")}`;
}

// Shapes a live TMDB response + the ratings collected for it into the
// `movie` sub-object AddRating stores. Pulled out of addMovieRating so the
// reconciliation flow (matching an offline placeholder rating to a real
// TMDB movie) can reuse the exact same shaping logic.
const shapeTmdbDataIntoMovie = (tmdbData, ratings) => {
  const crew = tmdbData.crew.map((person) => ({ job: person.job, name: person.name }));
  const cast = tmdbData.cast.map((person) => ({ name: person.name, character: person.character }));

  return {
    backdrop_path: tmdbData.backdrop_path,
    budget: tmdbData.budget,
    cast,
    crew,
    genres: tmdbData.genres,
    id: tmdbData.id,
    imdb_id: tmdbData.imdb_id,
    ownership: ratings[0].ownership || null,
    poster_path: tmdbData.poster_path,
    production_companies: tmdbData.production_companies,
    release_date: tmdbData.release_date,
    revenue: tmdbData.revenue,
    runtime: tmdbData.runtime,
    title: tmdbData.title,
    keywords: tmdbData.keywords,
    chatGPTKeywords: collectChatGPTKeywords(ratings)
  };
}

// A transient TMDB fetch failure shouldn't wipe out previously-good local
// data (the old, buggy behavior) - and offline, there's no TMDB call to make
// at all when the movie is already local. Both cases reuse what's already
// stored, just refreshing ownership/chatGPTKeywords from the new rating.
const buildMovieFromLocalData = (previousMovie, ratings) => {
  return {
    ...previousMovie,
    ownership: ratings[0].ownership || previousMovie.ownership || null,
    chatGPTKeywords: [...new Set([...(previousMovie.chatGPTKeywords || []), ...collectChatGPTKeywords(ratings)])]
  };
}

// Fetches real TMDB data for `tmdbId` and shapes it with `ratings`. Used by
// the reconciliation flow to finalize a placeholder rating once the user has
// picked which real movie it was - deliberately takes an explicit id rather
// than reading it off ratings[0] (which still carries the OLD placeholder
// id at that point). Throws if the fetch fails; the caller decides how to
// surface that (e.g. let the user retry the search).
export const shapeTmdbMovie = async (tmdbId, ratings) => {
  const tmdbData = await getTMDBData({ id: tmdbId });
  if (!tmdbData) {
    throw new Error(`Failed to fetch TMDB data for id ${tmdbId}`);
  }
  return shapeTmdbDataIntoMovie(tmdbData, ratings);
}

// Builds a placeholder movie object for a rating made offline with no TMDB
// lookup possible (just a typed title, optionally a year) - marked with
// isPendingReconciliation so it durably survives being written to Firebase
// and can be found again later for the "did you mean this movie?" prompt.
// Fields are deliberately non-null, sensible DEFAULTS rather than an
// all-null shape:
//   - release_date always resolves to a real (if approximate) date - a null
//     release_date would break date-parsing call sites throughout the app
//     (MovieDetail, Insights, sort-by-date) that assume a parseable value.
//   - runtime defaults to 90, not null - the "include shorts" filter is
//     `runtime <= 40`, and `null <= 40` is true in JS (null coerces to 0),
//     so a null-runtime placeholder would be silently excluded whenever
//     that setting is off.
const buildPlaceholderMovie = (ratings) => {
  const rating = ratings[0];
  const typedYear = /^\d{4}$/.test(String(rating.year || '').trim()) ? String(rating.year).trim() : null;
  const year = typedYear || String(new Date().getFullYear());

  return {
    id: rating.id,
    title: rating.title,
    release_date: `${year}-01-01`,
    runtime: 90,
    poster_path: null,
    backdrop_path: null,
    genres: [],
    cast: [],
    crew: [],
    keywords: [],
    production_companies: [],
    imdb_id: null,
    ownership: rating.ownership || null,
    chatGPTKeywords: collectChatGPTKeywords(ratings),
    isPendingReconciliation: true
  };
}

const addMovieRating = async (ratings) => {
  if (!ratings[0].id) {
    return;
  }

  const existingKey = findKeyForMovieInDatabase(ratings[0].id);
  const existingEntry = existingKey ? store.state.movieLog[existingKey] : null;

  let tmdbDataWeStore;

  if (!store.state.isOnline && existingEntry) {
    // Offline re-rate: the movie's TMDB data is already local, skip the
    // network call entirely.
    tmdbDataWeStore = buildMovieFromLocalData(existingEntry.movie, ratings);
  } else {
    const tmdbData = await getTMDBData(ratings[0]);

    if (tmdbData) {
      tmdbDataWeStore = shapeTmdbDataIntoMovie(tmdbData, ratings);
    } else if (existingEntry) {
      tmdbDataWeStore = buildMovieFromLocalData(existingEntry.movie, ratings);
    } else {
      // Genuinely new movie, but the TMDB fetch failed - surface this rather
      // than silently writing a broken entry (id: null, no poster, etc.).
      throw new Error(`Failed to fetch TMDB data for id ${ratings[0].id}`);
    }
  }

  const movieWithRating = {
    movie: tmdbDataWeStore,
    ratings: stripOwnership(ratings)
  };

  const key = existingKey || safeTitleKey(tmdbDataWeStore.title);

  return {
    path: `movieLog/${key}`,
    value: movieWithRating
  }
}

const addRating = async (ratings) => {
  const id = ratings[0].id;
  if (!id) {
    return;
  }

  const isPlaceholder = isPlaceholderId(id);
  let dbEntry;

  if (isPlaceholder) {
    const movie = buildPlaceholderMovie(ratings);
    const ratingsWithoutOwnership = stripOwnership(ratings);
    const key = findKeyForMovieInDatabase(id) || safeTitleKey(movie.title);
    dbEntry = { path: `movieLog/${key}`, value: { movie, ratings: ratingsWithoutOwnership } };
  } else {
    dbEntry = await addMovieRating(ratings);
    if (!dbEntry) {
      return;
    }
  }

  // Optimistic local commit - the movie shows up in the grid/previous-
  // viewings/a same-session re-edit immediately, regardless of connectivity
  // or what happens below. See setMovieLogEntry's own comment in
  // store/index.js.
  const key = dbEntry.path.split('movieLog/')[1];
  store.commit('setMovieLogEntry', { key, value: dbEntry.value });

  // BULLETPROOFING (Jul 2026, following a live data-loss report): durably
  // enqueue BEFORE attempting any network write, unconditionally, for every
  // rating - not only as a fallback after a failed attempt. This closes the
  // one gap the earlier "direct write" fix still had: if the tab/app is
  // killed in the split second while the write is actually in flight
  // (after the user has already seen the rating "saved" via the optimistic
  // commit above, but before the network round-trip resolves either way),
  // there would otherwise be nothing durable on disk yet. With the enqueue
  // happening FIRST, that same instant is already covered - IndexedDB has a
  // durable copy the moment this line completes, and it will be retried by
  // initializeDB/App.vue's background triggers on the very next load,
  // completely independent of whatever happens to the write attempt below.
  const queueEntry = {
    type: isPlaceholder ? 'placeholder' : 'write',
    dbEntry
  };
  if (isPlaceholder) {
    // Placeholders' queue entry additionally carries reconciliation
    // metadata - this is how the reconciliation banner/screen find "things
    // still needing a real TMDB match," not just a write-retry mechanism,
    // so it's never removed on success below, only marked `written`.
    // enqueueWrite dedupes by path, so re-rating the same still-
    // unreconciled placeholder just updates this one entry in place.
    Object.assign(queueEntry, {
      placeholderMovieId: id,
      title: dbEntry.value.movie.title,
      year: ratings[0].year || null,
      ratings: dbEntry.value.ratings,
      status: 'unreconciled'
    });
  }
  const queuedRecord = await enqueueWrite(queueEntry);

  // THE ACTUAL FIX for the original data-loss bug report: a direct, AWAITED
  // write attempt with no dependency on the SHARED/guarded flushPendingWrites
  // action - see writeDatabaseEntryNow's own comment in store/index.js for
  // the full history. This restores the same guarantee the app always had
  // before the offline-rating feature existed for the common (online) case:
  // if this resolves, the write is CONFIRMED on the server before the caller
  // is told the rating succeeded. The queue entry above is the durability
  // net underneath this attempt, not an alternative to it.
  if (store.state.isOnline) {
    try {
      await store.dispatch('writeDatabaseEntryNow', dbEntry);
      // Confirmed - the queue entry has done its job. 'write' entries are
      // fully done and removed; 'placeholder' entries stay queued
      // (reconciliation tracking is a separate concern from write success)
      // but are marked written so a later redundant flush pass can tell.
      if (queuedRecord) {
        if (isPlaceholder) {
          await updatePendingWrite(queuedRecord.id, { written: true });
        } else {
          await removePendingWrite(queuedRecord.id);
        }
      }
    } catch (error) {
      // Already durably queued above regardless of this failure - the
      // background sweep (App.vue's triggers / initializeDB) will keep
      // retrying it. Placeholders swallow this (the whole point of that
      // flow is "sync eventually," and its queue entry is the same safety
      // net either way); a normal rating still re-throws so the user gets
      // immediate visibility/control via RateMovie.vue's existing error UI,
      // rather than silently trusting an unconfirmed save - the data itself
      // is never at risk either way, this is purely about surfacing status.
      if (isPlaceholder) {
        console.error('Direct write failed for a placeholder rating, will retry via the background queue:', error);
      } else {
        throw error;
      }
    }
  }
  // else: genuinely offline - no point attempting a write we know can't
  // reach the server. Already durably queued above; App.vue's triggers +
  // initializeDB pick it up once connectivity returns.

  // Fire-and-forget: get this movie's poster/backdrop into the offline image
  // cache immediately, rather than only whenever it's next viewed. Not
  // awaited - this must never slow down or fail the actual save. No-op for
  // a placeholder (both paths are null until reconciled).
  const newImageUrls = [posterUrl(dbEntry.value.movie?.poster_path), backdropUrl(dbEntry.value.movie?.backdrop_path)].filter(Boolean);
  if (newImageUrls.length) {
    warmImageCache(newImageUrls);
  }

  return dbEntry;
}

export default addRating;
