import axios from 'axios';
import store from '../../store/index';

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


const addMovieRating = async (ratings, movieTags) => {
  if (!ratings[0].id) {
    return;
  }

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

  const tmdbData = await getTMDBData(ratings[0]);

  let crew;
  let cast;

  if (tmdbData) {
    crew = tmdbData.crew.map((person) => {
      return {
        job: person.job,
        name: person.name
      }
    })

    cast = tmdbData.cast.map((person) => {
      return {
        name: person.name,
        character: person.character
      }
    })
  }

  const tmdbDataWeStore = {
    backdrop_path: tmdbData ? tmdbData.backdrop_path : null,
    cast: tmdbData ? cast : [],
    crew: tmdbData ? crew : [],
    genres: tmdbData ? tmdbData.genres : [],
    id: tmdbData ? tmdbData.id : null,
    imdb_id: tmdbData ? tmdbData.imdb_id : null,
    ownership: ratings[0].ownership || null,
    poster_path: tmdbData ? tmdbData.poster_path : null,
    production_companies: tmdbData ? tmdbData.production_companies : [],
    release_date: tmdbData ? tmdbData.release_date : null,
    runtime: tmdbData ? tmdbData.runtime : null,
    title: tmdbData ? tmdbData.title : "",
    tags: movieTags || [],
    keywords: tmdbData ? tmdbData.keywords : [],
    chatGPTKeywords: chatGPTKeywords
  };

  const ratingsWithoutOwnership = ratings.map((rating) => {
    const tempRating = { ...rating };

    delete tempRating.ownership;

    return tempRating;
  })

  const movieWithRating = {
    movie: tmdbDataWeStore,
    ratings: ratingsWithoutOwnership
  };

  const safeTitle = tmdbDataWeStore.title.replaceAll(/[-!$%@^&*()_+|~=`{}[\]:";'<>?,./#]/g, "-");
  const key = findKeyForMovieInDatabase(ratings[0].id) || `${new Date().getTime()}-${crypto.randomUUID()}-${safeTitle}`;

  return {
    path: `movieLog/${key}`,
    value: movieWithRating
  }
}

const addRating = async (ratings, movieTags) => {
  const dbEntry = await addMovieRating(ratings, movieTags);
  store.dispatch('setDBValue', dbEntry);
  return dbEntry;
}

export default addRating;