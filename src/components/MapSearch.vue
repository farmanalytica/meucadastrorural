<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { parseCoords, looksLikeCarCode, autocompleteAddress, type AddressSuggestion } from '../lib/geocode'

const props = defineProps<{
  carSearching?: boolean
  carSearchError?: string
  // Bias address suggestions toward the current map centre.
  bias?: { lat: number; lng: number } | null
}>()

const emit = defineEmits<{
  (e: 'car-search', code: string): void
  (e: 'goto', lat: number, lng: number, label?: string): void
}>()

type Item =
  | { type: 'coords'; label: string; lat: number; lng: number }
  | { type: 'car'; label: string; code: string }
  | { type: 'address'; label: string; lat: number; lng: number }

const query = ref('')
const suggestions = ref<AddressSuggestion[]>([])
const loading = ref(false)
const open = ref(false)
const highlight = ref(-1)

let debounceId: ReturnType<typeof setTimeout> | undefined
let controller: AbortController | undefined

// Build the dropdown: a coords shortcut and/or a CAR shortcut on top, then
// address suggestions from Photon.
const items = computed<Item[]>(() => {
  const q = query.value.trim()
  const list: Item[] = []
  const coords = parseCoords(q)
  if (coords) {
    list.push({ type: 'coords', label: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`, lat: coords.lat, lng: coords.lng })
  }
  if (!coords && looksLikeCarCode(q)) {
    list.push({ type: 'car', label: q.toUpperCase(), code: q })
  }
  for (const s of suggestions.value) {
    list.push({ type: 'address', label: s.label, lat: s.lat, lng: s.lng })
  }
  return list
})

watch(query, (q) => {
  highlight.value = -1
  suggestions.value = []
  if (debounceId) clearTimeout(debounceId)
  controller?.abort()
  const trimmed = q.trim()
  open.value = trimmed.length > 0
  // Coords / CAR codes don't need geocoding — the shortcut items cover them.
  if (trimmed.length < 3 || parseCoords(trimmed) || looksLikeCarCode(trimmed)) return
  loading.value = true
  debounceId = setTimeout(async () => {
    controller = new AbortController()
    try {
      suggestions.value = await autocompleteAddress(trimmed, {
        bias: props.bias ?? undefined,
        signal: controller.signal,
      })
    } catch {
      // Aborted or network error — leave suggestions empty.
    } finally {
      loading.value = false
    }
  }, 350)
})

function activate(item: Item): void {
  if (item.type === 'car') emit('car-search', item.code)
  else emit('goto', item.lat, item.lng, item.type === 'address' ? item.label : undefined)
  close()
}

function onSubmit(): void {
  if (!items.value.length) return
  activate(items.value[highlight.value >= 0 ? highlight.value : 0])
}

function onArrow(delta: number): void {
  if (!items.value.length) return
  open.value = true
  highlight.value = (highlight.value + delta + items.value.length) % items.value.length
}

function close(): void {
  open.value = false
  highlight.value = -1
}

function iconFor(t: Item['type']): string {
  return t === 'coords' ? '📍' : t === 'car' ? '🏠' : '🗺️'
}

onBeforeUnmount(() => {
  if (debounceId) clearTimeout(debounceId)
  controller?.abort()
})
</script>

<template>
  <div class="mapsearch" @keydown.escape="close">
    <form class="mapsearch__row" @submit.prevent="onSubmit">
      <input
        v-model="query"
        class="mapsearch__input"
        type="search"
        placeholder="CAR, endereço ou coordenadas"
        title="Busque por endereço, código do CAR (ex.: GO-…) ou coordenadas (ex.: -16.68, -49.25)"
        autocomplete="off"
        @focus="open = query.trim().length > 0"
        @keydown.down.prevent="onArrow(1)"
        @keydown.up.prevent="onArrow(-1)"
      />
      <button class="mapsearch__btn" type="submit" :disabled="carSearching || !query.trim()" title="Buscar">
        {{ carSearching ? '…' : 'Ir' }}
      </button>
    </form>

    <ul v-if="open && items.length" class="mapsearch__menu">
      <li
        v-for="(item, i) in items"
        :key="item.type + i"
        class="mapsearch__item"
        :class="{ 'is-active': i === highlight }"
        @mousedown.prevent="activate(item)"
        @mouseenter="highlight = i"
      >
        <span class="mapsearch__icon" aria-hidden="true">{{ iconFor(item.type) }}</span>
        <span class="mapsearch__label">
          <template v-if="item.type === 'coords'">Ir para {{ item.label }}</template>
          <template v-else-if="item.type === 'car'">Buscar imóvel CAR: {{ item.label }}</template>
          <template v-else>{{ item.label }}</template>
        </span>
      </li>
      <li v-if="loading" class="mapsearch__hint">Buscando endereços…</li>
    </ul>

    <p v-if="carSearchError" class="mapsearch__error">{{ carSearchError }}</p>
  </div>
</template>

<style scoped>
.mapsearch { position: relative; }
.mapsearch__row { display: flex; gap: 0.4rem; }
.mapsearch__input {
  flex: 1; min-width: 0; padding: 0.55rem 0.7rem;
  border: 1px solid var(--border); border-radius: 10px; font-size: 0.85rem; background: var(--white); color: var(--text);
}
.mapsearch__input:focus { outline: none; border-color: var(--primary); }
.mapsearch__btn {
  flex-shrink: 0; padding: 0 0.9rem; border: 0; border-radius: 10px;
  background: var(--primary); color: var(--white); font-weight: 700; cursor: pointer;
}
.mapsearch__btn:hover:not(:disabled) { filter: brightness(1.08); }
.mapsearch__btn:disabled { opacity: 0.5; cursor: not-allowed; }
.mapsearch__menu {
  position: absolute; z-index: 1200; top: calc(100% + 4px); left: 0; right: 0;
  list-style: none; margin: 0; padding: 0.25rem; max-height: 280px; overflow-y: auto;
  background: var(--white); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--sh-md);
}
.mapsearch__item {
  display: flex; align-items: center; gap: 0.55rem; padding: 0.5rem 0.6rem;
  border-radius: 7px; cursor: pointer; font-size: 0.82rem; line-height: 1.3;
}
.mapsearch__item.is-active { background: var(--bg); }
.mapsearch__icon { flex-shrink: 0; }
.mapsearch__label { overflow: hidden; text-overflow: ellipsis; }
.mapsearch__hint { padding: 0.4rem 0.6rem; font-size: 0.75rem; color: var(--text-muted); }
.mapsearch__error { color: #c0392b; font-size: 0.78rem; margin: 0.4rem 0 0; }
</style>
