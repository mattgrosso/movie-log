<template>
  <div class="col-12 my-3">
    <label class="form-label fs-4 mb-0" :for="name">{{ label }}</label>
    <p class="fs-6 fst-italic">{{ description }}</p>
    <select class="form-select" :name="name" :id="name" v-model="selected">
      <option value=""></option>
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  </div>
</template>

<script>
// Presentational select for one rating criterion. Extracted from RateMovie's
// eight near-identical inline blocks. Uses a real native <select> v-model
// (proxied through `selected`) so binding semantics — string option values, a
// null initial showing the leading empty option — match the original markup
// exactly. All scoring/default logic stays in the parent.
export default {
  name: 'RatingSelect',
  props: {
    label: { type: String, required: true },
    description: { type: String, default: '' },
    name: { type: String, required: true },
    // [{ value: '0', label: '0 - Worst in class' }, ...] — the leading empty
    // option is rendered by this component, not included here.
    options: { type: Array, required: true },
    modelValue: { default: null }
  },
  emits: ['update:modelValue'],
  computed: {
    selected: {
      get () {
        return this.modelValue;
      },
      set (value) {
        this.$emit('update:modelValue', value);
      }
    }
  }
};
</script>
