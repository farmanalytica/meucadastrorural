<script setup lang="ts">
// Side panel for the selected CAR property + official SICAR data. Styling
// comes from src/styles/mapPanels.css (global). State and fetching live in
// the parent (via useCarDetailPanel); this only renders and emits actions.
import { fmtNum } from '../lib/mapGeo'

defineProps<{
  carId: string
  hasFeature: boolean
  municipio: string | null
  areaHa: number
  loadingFeature: boolean
  detailOpen: boolean
  detailLoading: boolean
  detailError: string
  detailRows: Array<{ label: string; value: string }>
  appOverlayError: string
  hasAppFeatures: boolean
}>()
defineEmits<{
  close: []
  'toggle-detail': []
  'export-kml': []
  'export-app': []
  retry: []
}>()
</script>

<template>
  <aside class="mapa__panel" :class="{ 'mapa__panel--details': detailOpen }">
    <button class="mapa__legend-close" title="Fechar" @click="$emit('close')">×</button>
    <h3>Imóvel CAR selecionado</h3>
    <p class="code">{{ carId }}</p>
    <div class="kv">
      <div class="kv__row" v-if="municipio">
        <span class="kv__label">Município</span><span class="kv__value">{{ municipio }}</span>
      </div>
      <div class="kv__row" v-if="hasFeature">
        <span class="kv__label">Área estimada</span><span class="kv__value">{{ fmtNum(areaHa) }} ha</span>
      </div>
    </div>
    <p v-if="loadingFeature" class="hint">Carregando contorno do CAR…</p>
    <div class="actions">
      <button class="btn btn-ghost-dark" :disabled="detailLoading" @click="$emit('toggle-detail')">
        <span class="mapa__label-full">{{ detailOpen ? 'Ocultar dados oficiais' : 'Dados oficiais' }}</span>
        <span class="mapa__label-short">{{ detailOpen ? 'Ocultar' : 'Dados' }}</span>
      </button>
      <button class="btn btn-ghost-dark" :disabled="!hasFeature" @click="$emit('export-kml')">
        <span class="mapa__label-full">Baixar KML</span>
        <span class="mapa__label-short">KML</span>
      </button>
      <button class="btn btn-ghost-dark" :disabled="!hasAppFeatures" @click="$emit('export-app')">
        <span class="mapa__label-full">Baixar Área de Preservação Permanente (APP)</span>
        <span class="mapa__label-short">APP</span>
      </button>
    </div>
    <p v-if="appOverlayError" class="hint is-error">{{ appOverlayError }}</p>
    <section v-if="detailOpen" class="mapa__car-detail" aria-live="polite">
      <div class="mapa__car-detail-head">
        <strong>Dados oficiais SICAR</strong>
        <button
          v-if="detailError"
          type="button"
          class="mapa__car-detail-retry"
          :disabled="detailLoading"
          @click="$emit('retry')"
        >
          Tentar novamente
        </button>
      </div>
      <p v-if="detailLoading" class="mapa__car-detail-status">Consultando base pública do CAR…</p>
      <p v-else-if="detailError" class="mapa__car-detail-status is-error">
        {{ detailError }}
      </p>
      <dl v-else-if="detailRows.length" class="mapa__car-detail-list">
        <div v-for="row in detailRows" :key="row.label" class="mapa__car-detail-row">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
      <p v-else class="mapa__car-detail-status">Sem dados adicionais retornados pelo SICAR.</p>
    </section>
  </aside>
</template>
