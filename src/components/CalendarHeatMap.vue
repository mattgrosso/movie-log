<template>
  <div class="calendar-heat-map">
    <calendar-heatmap v-if="values.length" :values="values" :end-date="new Date()" :round="5" tooltip-unit="movies" vertical :range-color="['#23a1f600', '#23a1f600', '#23a1f6', '#96da52', '#ffeb00', '#fb8c00', '#f43b28']"/>
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
  computed: {
    darkOrLight () {
      return document.querySelector("body").classList.contains('bg-dark');
    },
    textColor () {
      return this.darkOrLight ? "#fff" : "#000";
    },
    datesWithCounts () {
      const datesWithCounts = {};

      for (const result of this.results) {
        for (const rating of result.ratings) {
          if (datesWithCounts[rating.date]) {
            datesWithCounts[rating.date]++;
          } else {
            datesWithCounts[rating.date] = 1;
          }
        }
      }

      return datesWithCounts;
    },
    values () {
      const cleanDates = Object.keys(this.datesWithCounts).filter((date) => date && this.datesWithCounts[date] && date !== 'undefined').map((date) => {
        return {
          date: new Date(date),
          count: this.datesWithCounts[date]
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