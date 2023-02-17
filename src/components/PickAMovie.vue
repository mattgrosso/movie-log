<template>
  <div class="pick-a-movie">
    <ul class="p-0 d-flex justify-content-around flex-wrap">
      <li class="card shadow border" v-for="movie in searchResults" :key="movie.id" @click="rateMovie(movie)">
        <img class="card-img-top" :src="`https://image.tmdb.org/t/p/original${movie.poster_path}`" align="center">
        <p class="m-2 mb-1 card-text text-center">
          <a class="link-success" target="_blank" @click.stop :href="`https://www.themoviedb.org/movie/${movie.id}`">
            TMDB#{{movie.id}}
          </a>
        </p>
        <p class="m-2 mt-1 card-text text-center">
          {{movie.title}}
          <br>
          {{movie.release_date}}
        </p>
      </li>
    </ul>
  </div>
</template>

<script>
export default {
  computed: {
    searchResults () {
      return this.$store.state.newEntrySearchResults;
    }
  },
  methods: {
    rateMovie (movie) {
      this.$store.commit('setMovieToRate', movie);
      this.$router.push('/rate-movie');
    }
  },
}
</script>

<style lang="scss">
  .pick-a-movie {
    ul {
      column-gap: 1rem;
      list-style: none;
      margin: 1rem 1rem 5rem;
      row-gap: 1rem;

      .card {
        border-radius: 4px;
        cursor: pointer;
        width: calc((100% - 2rem) / 3);

        @media screen and (min-width: 832px) {
          width: calc((100% - 2rem) / 6);
        }

        p {
          font-size: .75rem;
        }
      }
    }
  }
</style>