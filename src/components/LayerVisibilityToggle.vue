<script setup lang="ts">
// One control for "is this data layer shown on the map" everywhere that
// question exists (sidebar overlays, zones raster/vector) — previously each
// panel invented its own checkbox class (.gis__check, .zones-analysis__field)
// for the identical interaction. An eye / eye-off glyph reads as a map-layer
// toggle the way a GIS layer list does; a plain checkbox doesn't carry that
// meaning on its own.
defineProps<{
  modelValue: boolean
  label: string
  disabled?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <button
    type="button"
    class="layer-toggle"
    role="switch"
    :aria-checked="modelValue"
    :disabled="disabled"
    @click="$emit('update:modelValue', !modelValue)"
  >
    <svg
      v-if="modelValue"
      class="layer-toggle__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
    <svg
      v-else
      class="layer-toggle__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M9.9 4.24A9.4 9.4 0 0 1 12 4c7 0 11 7 11 7a13.2 13.2 0 0 1-2.16 3.19" />
      <path d="M6.61 6.61A13.5 13.5 0 0 0 1 12s4 7 11 7a9.5 9.5 0 0 0 5.39-1.61" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
    <span class="layer-toggle__label"><slot>{{ label }}</slot></span>
  </button>
</template>

<style scoped>
.layer-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  border: none;
  background: none;
  padding: 0.15rem 0;
  font: inherit;
  font-size: 0.72rem;
  color: var(--text);
  cursor: pointer;
  text-align: left;
}

.layer-toggle__icon {
  flex: none;
  width: 15px;
  height: 15px;
  color: var(--text-soft);
  transition: color 0.15s;
}

.layer-toggle[aria-checked='true'] .layer-toggle__icon {
  color: var(--accent);
}

.layer-toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.layer-toggle__label {
  min-width: 0;
}
</style>
