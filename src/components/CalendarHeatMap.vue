<template>
  <div class="calendar-heat-map">
    <calendar-heatmap v-if="values.length" :values="values" :end-date="new Date()" :round="5" tooltip-unit="movies" vertical :range-color="['#23a1f6', '#23a1f6', '#96da52', '#ffeb00', '#fb8c00', '#f43b28', '#a42121']"/>
  </div>
</template>

<script>
export default {
  name: "CalendarHeatMap",
  props: {
    results: {
      type: Array,
      required: true
    }
  },
  data () {
    return {
      data: {}
    }
  },
  mounted () {
    let data = {};

    for (let result of this.results) {
      for (let rating of result.ratings) {
        if (data[rating.date]) {
          data[rating.date]++;
        } else {
          data[rating.date] = 1;
        }
      }
    }

    this.data = data;
  },
  computed: {
    darkOrLight () {
      return document.querySelector("body").classList.contains('bg-dark');
    },
    textColor () {
      return this.darkOrLight ? "#fff" : "#000";
    },
    values () {
      const cleanDates = Object.keys(this.data).filter((date) => date && this.data[date] && date !== 'undefined').map((date) => {
        return {
          date: new Date(date),
          count: this.data[date]
        }
      });

      return cleanDates;
    }
  }
};
</script>

<style lang="scss">
.calendar-heat-map {
  .vch__wrapper {
    text {
      font-size: 0.5rem;
      fill: v-bind(textColor);
    }

    .vch__legend__wrapper {
      display: none;
    }
  }

  .vch__legend {
    display: none;
  }
}

.tippy-content {
  background-color: #333;
  border-radius: 3px;
  color: #fff;
  max-width: 80vw;
  padding: 5px 10px;
  white-space: nowrap;
}

</style>