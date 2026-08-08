<script setup lang="ts">
// Single-view map app: CAR (SICAR) property outlines, state/municipality
// boundaries, CAR search by code or address, KML download and official
// SICAR data for the selected property. All data comes from public
// sources fetched by the browser — there is no backend.
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import L from 'leaflet'
import { createUnavailableLayerController } from './lib/areaOverlayLayer'
import { SECTION_ZOOM_THRESHOLD } from './lib/areaOverlayLayer.styles'
import { createAdminBoundariesController } from './lib/adminBoundariesLayer'
import { downloadKml } from './lib/kmlExporter'
import { useCarDetailPanel } from './composables/useCarDetailPanel'
import { useMapLayers } from './composables/useMapLayers'
import MapSearch from './components/MapSearch.vue'
import CarDetailPanel from './components/CarDetailPanel.vue'
import LayerVisibilityToggle from './components/LayerVisibilityToggle.vue'

// areaOverlayLayer reads globalThis.L (ported code) — guarantee it before
// the controller is created.
;(globalThis as any).L = L

const mapEl = ref<HTMLElement | null>(null)
let map: L.Map | null = null
let gotoMarker: L.CircleMarker | null = null

const selectedId = ref<string | null>(null)
const selectedFeature = shallowRef<any | null>(null)
const loadingFeature = ref(false)
const carSearching = ref(false)
const carSearchError = ref('')
const mapCenter = ref<{ lat: number; lng: number } | null>(null)
const currentZoom = ref(4)

const { showCar, carOpacity, showStates, showMunicipios } = useMapLayers()

const detailPanel = useCarDetailPanel({ selectedId, selectedFeature })

const carController = createUnavailableLayerController({
  onSelectUnavailable: (id: string) => void selectCar(id),
})
const adminBoundaries = createAdminBoundariesController()

async function selectCar(id: string) {
  carController.selectUnavailable(id)
  selectedId.value = id
  selectedFeature.value = null
  loadingFeature.value = true
  try {
    const match = await carController.findAreaOverlay(id)
    if (selectedId.value !== id) return
    selectedFeature.value = match?.feature ?? null
  } finally {
    if (selectedId.value === id) loadingFeature.value = false
  }
}

function closePanel() {
  carController.clearSelection()
  selectedId.value = null
  selectedFeature.value = null
  loadingFeature.value = false
}

async function onCarSearch(code: string) {
  carSearching.value = true
  carSearchError.value = ''
  try {
    const match = await carController.focusUnavailable(code)
    if (!match) {
      carSearchError.value = 'Imóvel CAR não encontrado. Confira o código (ex.: GO-5208608-…).'
      return
    }
    selectedId.value = match.unavailableId
    selectedFeature.value = match.feature
    loadingFeature.value = false
  } catch (err: any) {
    carSearchError.value = err?.message || 'Falha na busca do CAR.'
  } finally {
    carSearching.value = false
  }
}

function onGoto(lat: number, lng: number) {
  if (!map) return
  map.setView([lat, lng], Math.max(map.getZoom(), 14), { animate: true })
  if (gotoMarker) gotoMarker.remove()
  gotoMarker = L.circleMarker([lat, lng], {
    radius: 8,
    color: '#f97316',
    weight: 3,
    fillOpacity: 0.25,
  }).addTo(map)
}

function exportKml() {
  const feature = selectedFeature.value
  const id = selectedId.value
  if (!feature || !id) return
  downloadKml(
    { type: 'Feature', properties: { id }, geometry: feature.geometry },
    id,
  )
}

watch(showCar, (visible) => carController.setVisible(visible))
watch(carOpacity, (value) => carController.setOpacity(value))
watch(showStates, (visible) => adminBoundaries.setStatesVisible(visible))
watch(showMunicipios, (visible) => adminBoundaries.setMunicipiosVisible(visible))

onMounted(() => {
  if (!mapEl.value) return
  map = L.map(mapEl.value, {
    preferCanvas: true,
    center: [-14.2, -51.9],
    zoom: 4,
    zoomControl: false,
  })
  // Top-left is taken by the brand/search card.
  L.control.zoom({ position: 'bottomleft' }).addTo(map)
  L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: '© Esri — Esri, Maxar, Earthstar Geographics' },
  ).addTo(map)

  const syncView = () => {
    if (!map) return
    const c = map.getCenter()
    mapCenter.value = { lat: c.lat, lng: c.lng }
    currentZoom.value = map.getZoom()
  }
  map.on('moveend zoomend', syncView)
  syncView()

  adminBoundaries.init(map, {
    isStatesVisible: () => showStates.value,
    isMunicipiosVisible: () => showMunicipios.value,
  })
  carController.setVisible(showCar.value)
  carController.setOpacity(carOpacity.value)
  carController.init(map)

  // Deep link: /?car=<codImovel> opens straight on a property.
  const carParam = new URLSearchParams(window.location.search).get('car')
  if (carParam) void onCarSearch(carParam)
})

onBeforeUnmount(() => {
  carController.destroy()
  adminBoundaries.destroy()
  map?.remove()
  map = null
})
</script>

<template>
  <div class="app">
    <div ref="mapEl" class="app__map"></div>

    <header class="app__brand">
      <h1>Meu Cadastro Rural</h1>
      <p>Consulta pública do CAR — limites, KML e dados oficiais</p>
      <MapSearch
        :car-searching="carSearching"
        :car-search-error="carSearchError"
        :bias="mapCenter"
        @car-search="onCarSearch"
        @goto="onGoto"
      />
    </header>

    <section class="app__layers">
      <h2>Camadas</h2>
      <LayerVisibilityToggle v-model="showCar" label="Imóveis CAR" />
      <label class="app__opacity" v-if="showCar">
        <span>Opacidade</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="carOpacity"
          @input="carOpacity = Number(($event.target as HTMLInputElement).value)"
        />
      </label>
      <LayerVisibilityToggle v-model="showStates" label="Estados" />
      <LayerVisibilityToggle v-model="showMunicipios" label="Municípios" />
      <p v-if="showCar && currentZoom < SECTION_ZOOM_THRESHOLD" class="app__zoom-hint">
        Aproxime o mapa para ver os limites dos imóveis
      </p>
    </section>

    <CarDetailPanel
      v-if="selectedId"
      :car-id="selectedId"
      :has-feature="Boolean(selectedFeature)"
      :municipio="detailPanel.municipio.value"
      :area-ha="detailPanel.areaHa.value"
      :loading-feature="loadingFeature"
      :detail-open="detailPanel.carDetailOpen.value"
      :detail-loading="detailPanel.carDetailLoading.value"
      :detail-error="detailPanel.carDetailError.value"
      :detail-rows="detailPanel.carDetailRows.value"
      @close="closePanel"
      @toggle-detail="detailPanel.toggleCarDetailPanel"
      @export-kml="exportKml"
      @retry="detailPanel.retryCarDetails"
    />

    <footer class="app__credits">
      Dados: <a href="https://www.car.gov.br/" target="_blank" rel="noopener noreferrer">SICAR</a> ·
      <a href="https://www.ibge.gov.br/" target="_blank" rel="noopener noreferrer">IBGE</a>
    </footer>
  </div>
</template>

<style scoped>
.app {
  position: relative;
  height: 100%;
  overflow: hidden;
}

.app__map {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.app__brand {
  position: absolute;
  z-index: 20;
  top: 1rem;
  left: 1rem;
  width: 320px;
  max-width: calc(100vw - 2rem);
  padding: 0.9rem 1rem;
  background: rgba(251, 252, 251, 0.97);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid var(--border);
  border-radius: var(--r);
  box-shadow: var(--sh-md);
}

.app__brand h1 {
  margin: 0;
  font-size: 1.05rem;
  color: var(--primary);
}

.app__brand p {
  margin: 0.15rem 0 0.6rem;
  font-size: 0.72rem;
  color: var(--text-soft);
}

.app__layers {
  position: absolute;
  z-index: 15;
  top: 1rem;
  right: 1rem;
  width: 170px;
  padding: 0.7rem 0.85rem;
  background: rgba(251, 252, 251, 0.95);
  border: 1px solid var(--border);
  border-radius: var(--r);
  box-shadow: var(--sh-sm);
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.app__layers h2 {
  margin: 0 0 0.2rem;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-soft);
}

.app__opacity {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.68rem;
  color: var(--text-soft);
}

.app__opacity input {
  flex: 1;
  min-width: 0;
}

.app__zoom-hint {
  margin: 0.25rem 0 0;
  font-size: 0.68rem;
  color: var(--text-muted);
}

.app__credits {
  position: absolute;
  z-index: 15;
  bottom: 0.35rem;
  left: 0.5rem;
  font-size: 0.68rem;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
}

.app__credits a {
  color: inherit;
}

@media (max-width: 640px) {
  .app__brand {
    width: calc(100vw - 2rem);
  }

  .app__layers {
    top: auto;
    bottom: 4.5rem;
  }
}
</style>
