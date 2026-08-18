// IBGE administrative mesh overlays (states + municipalities) on the map.
// States: simplified white outline (public/geo/br_states.geojson), loaded
// once. Municipalities: yellow mesh per state (public/geo/municipios/<UF>.geojson),
// loaded on demand when the viewport touches the state at sufficient zoom.
// Fails silently offline. Extracted from MapaView to isolate the map logic.
import L from 'leaflet'

// IBGE area code (codarea) → state abbreviation, used to match each state
// feature with its corresponding municipalities file.
const UF_BY_CODE: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL',
  '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
  '41': 'PR', '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
}

const MUNICIPIOS_MIN_ZOOM = 7
const MUNICIPIOS_MAX_ZOOM = 18

export interface AdminBoundariesController {
  init(
    map: L.Map,
    opts?: { isStatesVisible?: () => boolean; isMunicipiosVisible?: () => boolean },
  ): void
  setStatesVisible(visible: boolean): void
  setMunicipiosVisible(visible: boolean): void
  destroy(): void
}

export function createAdminBoundariesController(): AdminBoundariesController {
  let map: L.Map | null = null
  let statesLayer: L.GeoJSON | null = null
  let municipiosGroup: L.LayerGroup | null = null
  let stateBounds: Array<{ uf: string; bounds: L.LatLngBounds }> = []
  const loadedUfs = new Set<string>()
  const ufLayers = new Map<string, L.GeoJSON>()
  let onMove: (() => void) | null = null

  // Simplified municipal meshes per state. Loads on demand when the
  // viewport touches the state at sufficient zoom; evicted again once the
  // viewport no longer touches it (fetched with force-cache, so a revisit
  // is served from the HTTP cache, not the network). Without this eviction
  // the mesh only ever grows as the user pans — worse on wide/4K viewports,
  // which touch more states per pan — until the whole country is loaded
  // and kept on canvas for the rest of the session.
  function loadVisibleMunicipios() {
    if (!map || !municipiosGroup) return
    const zoom = map.getZoom()
    if (zoom < MUNICIPIOS_MIN_ZOOM || zoom > MUNICIPIOS_MAX_ZOOM) {
      municipiosGroup.clearLayers()
      ufLayers.clear()
      loadedUfs.clear()
      return
    }
    const view = map.getBounds()

    for (const s of stateBounds) {
      if (!loadedUfs.has(s.uf) || view.intersects(s.bounds)) continue
      loadedUfs.delete(s.uf)
      const layer = ufLayers.get(s.uf)
      if (layer) {
        municipiosGroup.removeLayer(layer)
        ufLayers.delete(s.uf)
      }
    }

    for (const s of stateBounds) {
      if (loadedUfs.has(s.uf) || !view.intersects(s.bounds)) continue
      loadedUfs.add(s.uf)
      fetch(`${import.meta.env.BASE_URL}geo/municipios/${s.uf}.geojson`, { cache: 'force-cache' })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((geojson) => {
          if (!map || !municipiosGroup) return
          // Viewport may have moved on since the fetch started — don't add
          // a state that's since panned out of view.
          if (!map.getBounds().intersects(s.bounds)) {
            loadedUfs.delete(s.uf)
            return
          }
          const layer = L.geoJSON(geojson, {
            style: { color: '#facc15', weight: 0.8, opacity: 0.7, fill: false } as any,
            interactive: false,
          }).addTo(municipiosGroup)
          ufLayers.set(s.uf, layer)
        })
        .catch(() => {
          loadedUfs.delete(s.uf) // offline: allows a retry when the map moves
        })
    }
  }

  // White overlay with simplified outlines of the 27 states. Fails silently
  // offline. Also stores the bounds per state for loading municipalities.
  function addStatesOverlay(isStatesVisible: () => boolean) {
    fetch(`${import.meta.env.BASE_URL}geo/br_states.geojson`, { cache: 'force-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((geojson) => {
        if (!map) return
        statesLayer = L.geoJSON(geojson, {
          style: { color: '#ffffff', weight: 1.5, opacity: 0.9, fill: false } as any,
          interactive: false,
        })
        if (isStatesVisible()) statesLayer.addTo(map)
        stateBounds = (geojson.features ?? [])
          .map((f: any) => {
            const uf = UF_BY_CODE[String(f.properties?.codarea)]
            return uf ? { uf, bounds: L.geoJSON(f).getBounds() } : null
          })
          .filter(Boolean) as typeof stateBounds
        loadVisibleMunicipios()
      })
      .catch(() => {
        /* offline: silent */
      })
  }

  return {
    init(m, { isStatesVisible = () => true, isMunicipiosVisible = () => true } = {}) {
      map = m
      // Group of municipal meshes — grouped for bulk toggling.
      municipiosGroup = L.layerGroup()
      if (isMunicipiosVisible()) municipiosGroup.addTo(m)
      addStatesOverlay(isStatesVisible)
      onMove = () => loadVisibleMunicipios()
      m.on('moveend', onMove)
    },
    setStatesVisible(visible) {
      if (!map || !statesLayer) return
      if (visible) statesLayer.addTo(map)
      else statesLayer.remove()
    },
    setMunicipiosVisible(visible) {
      if (!map || !municipiosGroup) return
      if (visible) municipiosGroup.addTo(map)
      else municipiosGroup.remove()
    },
    destroy() {
      if (map && onMove) map.off('moveend', onMove)
      onMove = null
      statesLayer?.remove()
      statesLayer = null
      municipiosGroup?.remove()
      municipiosGroup = null
      stateBounds = []
      loadedUfs.clear()
      ufLayers.clear()
      map = null
    },
  }
}
