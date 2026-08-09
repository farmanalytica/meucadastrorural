<script setup lang="ts">
// Shared shell for footer-triggered popups (disclaimer, help guide): overlay
// + centered card + close button, teleported above the map. Typography and
// the numbered step-list look for slotted content live in the global style
// block below, shared across every popup that uses this shell instead of
// being redeclared per consumer.
import { useId } from 'vue'

defineProps<{ title: string }>()
defineEmits<{ close: [] }>()

const titleId = useId()
</script>

<template>
  <Teleport to="body">
    <div class="map-popup-overlay" @click.self="$emit('close')">
      <div class="map-popup" role="dialog" aria-modal="true" :aria-labelledby="titleId">
        <button class="map-popup__close" title="Fechar" @click="$emit('close')">×</button>
        <h2 :id="titleId">{{ title }}</h2>
        <div class="popup-content"><slot /></div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.map-popup-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(17, 24, 39, 0.55);
}

.map-popup {
  position: relative;
  width: 560px;
  max-width: 100%;
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  background: #fbfcfb;
  border: 1px solid var(--border);
  border-radius: var(--r);
  box-shadow: var(--sh-lg);
  padding: 1.5rem 1.5rem 1.25rem;
}

.map-popup h2 {
  margin: 0 1.5rem 0.9rem 0;
  font-size: 1.1rem;
  color: var(--primary);
}

.map-popup__close {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
  color: var(--text-soft);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
}

.map-popup__close:hover {
  background: var(--bg);
  color: var(--text);
}
</style>

<style>
/* Unscoped: targets slotted content, which keeps the consumer component's
   own scope id rather than this wrapper's. */
.popup-content h3 {
  margin: 1rem 0 0.35rem;
  font-size: 0.82rem;
  color: var(--primary);
}

.popup-content h3:first-child {
  margin-top: 0;
}

.popup-content p {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.5;
  color: var(--text);
}

.popup-content p a {
  color: var(--primary);
  font-weight: 650;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.popup-cta-link {
  display: inline-block;
  margin-top: 1.1rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--primary);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.step-flow {
  list-style: none;
  margin: 0.9rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.step-flow__step {
  position: relative;
  display: flex;
  gap: 0.7rem;
  padding: 0 0 1.1rem;
}

.step-flow__step:last-child {
  padding-bottom: 0;
}

.step-flow__step:not(:last-child)::after {
  content: '';
  position: absolute;
  left: 0.85rem;
  top: 1.9rem;
  bottom: 0.15rem;
  width: 2px;
  background: var(--border);
}

.step-flow__num {
  flex: none;
  display: grid;
  place-items: center;
  width: 1.7rem;
  height: 1.7rem;
  border-radius: 50%;
  background: var(--primary);
  color: #fff;
  font-size: 0.78rem;
  font-weight: 700;
  z-index: 1;
}

.step-flow__step strong {
  display: block;
  font-size: 0.82rem;
  color: var(--text);
}

.step-flow__step p {
  margin: 0.2rem 0 0;
  font-size: 0.78rem;
  line-height: 1.45;
}
</style>
