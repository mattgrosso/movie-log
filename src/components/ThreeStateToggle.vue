<template>
  <div class="three-state-toggle mb-3">
    <label class="form-label text-white mb-2">{{ label }}</label>
    <div class="btn-group d-flex" role="group" :aria-label="label + ' toggle'">
      <button 
        type="button" 
        class="btn btn-sm flex-fill"
        :class="value === 'disabled' ? 'btn-danger' : 'btn-outline-danger'"
        @click="setState('disabled')"
        :disabled="disabled"
      >
        Disabled
      </button>
      <button 
        type="button" 
        class="btn btn-sm flex-fill"
        :class="value === 'normal' ? 'btn-secondary' : 'btn-outline-secondary'"
        @click="setState('normal')"
        :disabled="disabled"
      >
        Normal
      </button>
      <button 
        type="button" 
        class="btn btn-sm flex-fill"
        :class="value === 'forced' ? 'btn-warning' : 'btn-outline-warning'"
        @click="setState('forced')"
        :disabled="disabled"
      >
        Forced
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ThreeStateToggle',
  props: {
    value: {
      type: String,
      default: 'normal',
      validator: (value) => ['disabled', 'normal', 'forced'].includes(value)
    },
    label: {
      type: String,
      required: true
    },
    id: {
      type: String,
      required: true
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },
  methods: {
    setState(state) {
      if (this.disabled) return;
      this.$emit('input', state);
    }
  }
}
</script>

<style scoped>
.three-state-toggle .btn-group {
  border-radius: 0.375rem;
}

.three-state-toggle .btn {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0.25rem 0.5rem;
}

.three-state-toggle .btn:not(.btn-danger):not(.btn-secondary):not(.btn-warning) {
  color: rgba(255, 255, 255, 0.7);
  border-color: rgba(255, 255, 255, 0.3);
}

.three-state-toggle .btn:not(.btn-danger):not(.btn-secondary):not(.btn-warning):hover {
  color: rgba(255, 255, 255, 0.9);
  border-color: rgba(255, 255, 255, 0.5);
  background-color: rgba(255, 255, 255, 0.1);
}
</style>