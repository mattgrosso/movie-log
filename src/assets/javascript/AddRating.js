import axios from 'axios';
import cheerio from "cheerio";
import { getDatabase, ref, set } from "firebase/database";
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

  if (!tmdbData || !imdbData) {
    return;
  }

  const crew = tmdbData.crew.map((person) => {
    return {
      job: person.job,
      name: person.name
    }
  })

  const cast = tmdbData.cast.map((person) => {
    return {
      name: person.name
    }
  })

  const tmdbDataWeStore = {
    backdrop_path: tmdbData.backdrop_path,
    cast: cast,
    crew: crew,
    genres: tmdbData.genres,
    id: tmdbData.id,
    imdb_id: tmdbData.imdb_id,
    ownership: ratings[0].ownership || null,
    poster_path: tmdbData.poster_path,
    production_companies: tmdbData.production_companies,
    release_date: tmdbData.release_date,
    runtime: tmdbData.runtime,
    title: tmdbData.title,
    awards: imdbData,
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

  const key = findKeyForMovieInDatabase(ratings[0].id) || crypto.randomUUID();
  const db = getDatabase();

  set(ref(db, `${store.state.databaseTopKey}/movieLog/${key}`), movieWithRating);

  if (!batch) {
    await store.dispatch('getDatabase');
  }
}
export default addRating;