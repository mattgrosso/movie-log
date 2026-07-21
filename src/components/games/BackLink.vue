<template>
  <div class="back-link" @click="$emit('click')" role="button" :aria-label="`Back to ${label}`">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-caret-left-fill" viewBox="0 0 16 16">
      <path d="m3.86 8.753 5.482 4.796c.646.566 1.658.106 1.658-.753V3.204a1 1 0 0 0-1.659-.753l-5.48 4.796a1 1 0 0 0 0 1.506z"/>
    </svg>
    <span>{{ label }}</span>
  </div>
</template>

<script>
export default {
  name: 'BackLink',
  props: {
    label: { type: String, default: 'Home' }
  },
  emits: ['click']
};
</script>

<style scoped>
.back-link {
  align-items: center;
  color: #eee;
  column-gap: 4px;
  cursor: pointer;
  display: flex;
  padding: 12px;
}

.back-link:active {
  opacity: 0.7;
}
</style>
