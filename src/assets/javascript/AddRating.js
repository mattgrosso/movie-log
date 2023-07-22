import axios from 'axios';
import cheerio from "cheerio";
import * as Sentry from "@sentry/vue";
import store from '../../store/index';

const getTMDBData = async (rating) => {
  const apiKey = process.env.VUE_APP_TMDB_API_KEY;
  const id = rating.id || rating.tvShowId;

  let dataResp;
  let creditsResp;

  try {
    if (store.state.currentLog === "tvLog") {
      dataResp = await axios.get(`https://api.themoviedb.org/3/tv/${id}?api_key=${apiKey}`);
      creditsResp = await axios.get(`https://api.themoviedb.org/3/tv/${id}/credits?api_key=${apiKey}`);
    } else {
      dataResp = await axios.get(`https://api.themoviedb.org/3/movie/${id}?api_key=${apiKey}`);
      creditsResp = await axios.get(`https://api.themoviedb.org/3/movie/${id}/credits?api_key=${apiKey}`);
    }
  } catch (error) {
    console.log(error);
    return;
  }

  return {
    ...dataResp.data,
    ...creditsResp.data
  }
}

const getIMDBData = async (id) => {
  if (!id) {
    return null;
  }

  let resp;

  try {
    resp = await axios.get(`https://fast-refuge-34363.herokuapp.com/www.imdb.com/title/${id}/awards`);
  } catch (error) {
    console.log(error);
    return;
  }

  const $ = cheerio.load(resp.data);

  const oscarWins = $("h3:contains('Oscar [Winner]')").parent().next().text();
  const oscarNoms = $("h3:contains('Oscar [Nominee]')").parent().next().text();

  const BAFTAWins = $("h3:contains('BAFTA Film Award [Winner]')").parent().next().text();
  const BAFTANoms = $("h3:contains('BAFTA Film Award [Nominee]')").parent().next().text();

  const GoldGlobeWins = $("h3:contains('Golden Globe [Winner]')").parent().next().text();
  const GoldGlobeNoms = $("h3:contains('Golden Globe [Nominee]')").parent().next().text();

  return {
    oscarWins: parseScrapedAwards(oscarWins),
    oscarNoms: parseScrapedAwards(oscarNoms),
    BAFTAWins: parseScrapedAwards(BAFTAWins),
    BAFTANoms: parseScrapedAwards(BAFTANoms),
    GoldGlobeWins: parseScrapedAwards(GoldGlobeWins),
    GoldGlobeNoms: parseScrapedAwards(GoldGlobeNoms)
  };
}

const parseScrapedAwards = (string) => {
  return string.replace(/ {2}/g, "").split("\n").filter((str) => str);
}

const findKeyForTVShowInDatabase = (id) => {
  const keys = Object.keys(store.state.tvLog);
  const tvShows = keys.map((key) => {
    return {
      ...store.state.tvLog[key],
      key
    }
  })

  const tvShow = tvShows.find((tvShow) => tvShow.tvShow.id === id);

  if (tvShow) {
    return tvShow.key;
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

const createTVShowRatingFromEpisodeRatings = (ratings) => {
  if (!ratings || ratings.length === 0) {
    return {};
  }

  const keys = Object.keys(ratings[0]);
  const keysToRemove = ["date", "episode", "medium", "season", "tags", "title", "year"];
  const filteredKeys = keys.filter((key) => !keysToRemove.includes(key));
  const averages = {};

  filteredKeys.forEach((key) => {
    const sum = ratings.reduce((total, rating) => total + rating[key], 0);
    const average = sum / ratings.length;
    averages[key] = parseFloat(average.toPrecision(2));
  });

  return averages;
};

const addTVShowRating = async (ratings, tvShowTags) => {
  if (!ratings.episodes[0].tvShowId) {
    return;
  }

  const tmdbData = await getTMDBData(ratings.episodes[0]);

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
        name: person.name
      }
    })
  }

  const tmdbDataWeStore = {
    backdrop_path: tmdbData ? tmdbData.backdrop_path : null,
    cast: tmdbData ? cast : [],
    crew: tmdbData ? crew : [],
    created_by: tmdbData ? tmdbData.created_by : [],
    genres: tmdbData ? tmdbData.genres : [],
    id: tmdbData ? tmdbData.id : null,
    poster_path: tmdbData ? tmdbData.poster_path : null,
    production_companies: tmdbData ? tmdbData.production_companies : [],
    first_air_date: tmdbData ? tmdbData.first_air_date : null,
    last_air_date: tmdbData ? tmdbData.last_air_date : null,
    networks: tmdbData ? tmdbData.networks : [],
    number_of_episodes: tmdbData ? tmdbData.number_of_episodes : null,
    number_of_seasons: tmdbData ? tmdbData.number_of_seasons : null,
    name: tmdbData ? tmdbData.name : null,
    tags: tvShowTags || []
  };

  const ratingsWithShowRating = { ...ratings, tvShow: createTVShowRatingFromEpisodeRatings(ratings.episodes) };

  const tvShowWithRatings = {
    tvShow: tmdbDataWeStore,
    ratings: ratingsWithShowRating
  };

  const key = findKeyForTVShowInDatabase(ratings.episodes[0].id) || `${new Date().getTime()}-${crypto.randomUUID()}`;

  return {
    path: `tvLog/${key}`,
    value: tvShowWithRatings
  }
}

const addMovieRating = async (ratings, movieTags) => {
  if (!ratings[0].id) {
    return;
  }

  const tmdbData = await getTMDBData(ratings[0]);
  const imdbData = await getIMDBData(tmdbData.imdb_id);

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
        name: person.name
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
    title: tmdbData ? tmdbData.title : null,
    awards: imdbData || null,
    tags: movieTags || []
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

  const key = findKeyForMovieInDatabase(ratings[0].id) || `${new Date().getTime()}-${crypto.randomUUID()}`;

  return {
    path: `movieLog/${key}`,
    value: movieWithRating
  }
}

const addRating = async (ratings, movieTags) => {
  let dbEntry;

  if (store.state.currentLog === "tvLog") {
    dbEntry = await addTVShowRating(ratings, movieTags);
  } else {
    dbEntry = await addMovieRating(ratings, movieTags);
  }

  store.dispatch('setDBValue', dbEntry);
}

export default addRating;