import axios from 'axios';
import cheerio from "cheerio";
import * as Sentry from "@sentry/vue";
import store from '../../store/index';

const getTMDBData = async (id) => {
  const apiKey = process.env.VUE_APP_TMDB_API_KEY;

  let dataResp;
  let creditsResp;

  try {
    dataResp = await axios.get(`https://api.themoviedb.org/3/movie/${id}?api_key=${apiKey}`);
    creditsResp = await axios.get(`https://api.themoviedb.org/3/movie/${id}/credits?api_key=${apiKey}`);
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

const findKeyForMovieInDatabase = (id) => {
  const keys = Object.keys(store.state.database);
  const movies = keys.map((key) => {
    return {
      ...store.state.database[key],
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

const addRating = async (ratings, batch, movieTags) => {
  if (!ratings[0].id) {
    return;
  }

  const tmdbData = await getTMDBData(ratings[0].id);
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

  const dbEntry = {
    path: `movieLog/${key}`,
    value: movieWithRating
  }

  Sentry.captureMessage(`${store.state.databaseTopKey} is adding a rating. The path is ${dbEntry.path}. The value is ${JSON.stringify(dbEntry.value)}`);
  store.dispatch('setDBValue', dbEntry);
}
export default addRating;