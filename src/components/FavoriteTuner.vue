<template>
  <div class="favorite-tuner">
    <!-- Small icon-only pencil, pinned inline with the section title on the
         right of the pane's top border. Mobile-first: always visible, no hover. -->
    <button
      class="tuner-toggle"
      :class="{ active: expanded }"
      :aria-expanded="expanded ? 'true' : 'false'"
      :aria-label="expanded ? 'Close tuning' : 'Tune this list'"
      @click="expanded = !expanded"
    >
      <i class="bi" :class="expanded ? 'bi-x-lg' : 'bi-pencil'"></i>
    </button>

    <!-- Collapsing accordion panel. -->
    <transition name="tuner-accordion">
      <div v-if="expanded" class="tuner-panel">
        <p class="tuner-intro">
          Adjust how this list is ranked. Changes preview instantly and save to your settings.
        </p>

        <div v-for="lever in levers" :key="lever.key" class="tuner-lever">
          <div class="tuner-lever-head">
            <label :for="`${uid}-${lever.key}`" class="tuner-lever-label">{{ lever.label }}</label>
            <input
              :id="`${uid}-${lever.key}`"
              class="tuner-number"
              type="number"
              :min="lever.min"
              :max="lever.max"
              :step="lever.step"
              :value="lever.value"
              @input="onInput(lever, $event.target.value)"
            />
          </div>
          <input
            class="tuner-slider"
            type="range"
            :min="lever.min"
            :max="lever.max"
            :step="lever.step"
            :value="lever.value"
            @input="onInput(lever, $event.target.value)"
          />
          <p class="tuner-help">{{ lever.help }}</p>
        </div>

        <button class="tuner-reset" @click="$emit('reset')">
          <i class="bi bi-arrow-counterclockwise"></i> Reset to defaults
        </button>
      </div>
    </transition>
  </div>
</template>

<script>
let tunerCounter = 0;

export default {
  name: 'FavoriteTuner',
  props: {
    // Each lever: { key, label, value, min, max, step, help }
    levers: {
      type: Array,
      required: true
    }
  },
  emits: ['update', 'reset'],
  data () {
    return {
      expanded: false,
      uid: `tuner-${tunerCounter++}`
    };
  },
  methods: {
    onInput (lever, rawValue) {
      // Keep ints integral (minEntries, billingLimit); allow decimals otherwise.
      const isInt = Number.isInteger(lever.step) && Number.isInteger(lever.min);
      let value = isInt ? parseInt(rawValue, 10) : parseFloat(rawValue);
      if (isNaN(value)) return;
      // Clamp to the declared range so typed numbers can't escape it.
      value = Math.max(lever.min, Math.min(lever.max, value));
      this.$emit('update', { key: lever.key, value });
    }
  }
};
</script>

<style lang="scss">
.favorite-tuner {
  width: 100%;

  .tuner-toggle {
    // Pinned to the pane's top-right border line (its nearest positioned
    // ancestor is .insights-pane), level with the centered title but without
    // participating in its layout — so the title stays centered.
    align-items: center;
    background: #212529; // matches the pane background to sit cleanly on the border
    border: none;
    border-radius: 50%;
    color: #bbb;
    cursor: pointer;
    display: inline-flex;
    font-size: 0.72rem;
    height: 26px;
    justify-content: center;
    padding: 0;
    position: absolute;
    right: 12px;
    top: 0;
    transform: translateY(-50%);
    width: 26px;
    z-index: 2;

    &:active {
      transform: translateY(-50%) scale(0.9);
    }

    &.active {
      background: #1976d2;
      color: #fff;
    }
  }

  .tuner-panel {
    background: #1c1c1c;
    border: 1px solid #383838;
    border-radius: 8px;
    margin-bottom: 0.75rem;
    padding: 0.9rem 1rem;
    text-align: left;

    .tuner-intro {
      color: #9aa;
      font-size: 0.72rem;
      margin: 0 0 0.85rem;
    }

    .tuner-lever {
      margin-bottom: 1rem;

      .tuner-lever-head {
        align-items: center;
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.3rem;

        .tuner-lever-label {
          color: #fff;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .tuner-number {
          background: #2a2a2a;
          border: 1px solid #555;
          border-radius: 4px;
          color: #fff;
          font-size: 0.8rem;
          padding: 0.15rem 0.35rem;
          text-align: right;
          width: 4.5rem;
        }
      }

      .tuner-slider {
        accent-color: #1976d2;
        cursor: pointer;
        width: 100%;
      }

      .tuner-help {
        color: #8a9; // muted green-grey, readable on dark
        font-size: 0.7rem;
        line-height: 1.3;
        margin: 0.25rem 0 0;
      }
    }

    .tuner-reset {
      background: none;
      border: 1px solid #555;
      border-radius: 4px;
      color: #ccc;
      cursor: pointer;
      font-size: 0.75rem;
      padding: 0.3rem 0.6rem;

      &:active {
        background: #333;
      }
    }
  }

  // Accordion transition
  .tuner-accordion-enter-active,
  .tuner-accordion-leave-active {
    overflow: hidden;
    transition: max-height 0.25s ease, opacity 0.2s ease;
    max-height: 1200px;
  }
  .tuner-accordion-enter-from,
  .tuner-accordion-leave-to {
    max-height: 0;
    opacity: 0;
  }
}
</style>
