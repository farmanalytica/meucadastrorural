import { ref, watch } from 'vue'

/**
 * Manage map layer visibility and preferences
 * Persists layer visibility settings to localStorage
 */
export function useMapLayers() {
  const showAreas = ref(true)
  const showCar = ref(true)
  const carOpacity = ref(1) // 0..1 — opacity multiplier for the CAR overlay
  const showStates = ref(true)
  const showMunicipios = ref(true)
  const showPivots = ref(true)

  // Load persisted layer preferences
  const LAYER_PREFS_KEY = 'mapa.layers.v1'
  try {
    const saved = JSON.parse(localStorage.getItem(LAYER_PREFS_KEY) || '{}')
    if (typeof saved.showCar === 'boolean') showCar.value = saved.showCar
    if (typeof saved.carOpacity === 'number') carOpacity.value = saved.carOpacity
    if (typeof saved.showAreas === 'boolean') showAreas.value = saved.showAreas
    if (typeof saved.showStates === 'boolean') showStates.value = saved.showStates
    if (typeof saved.showMunicipios === 'boolean') showMunicipios.value = saved.showMunicipios
    if (typeof saved.showPivots === 'boolean') showPivots.value = saved.showPivots
  } catch {
    // Corrupted prefs: ignore and use defaults
  }

  // Persist changes to localStorage
  watch([showCar, carOpacity, showAreas, showStates, showMunicipios, showPivots], () => {
    localStorage.setItem(
      LAYER_PREFS_KEY,
      JSON.stringify({
        showCar: showCar.value,
        carOpacity: carOpacity.value,
        showAreas: showAreas.value,
        showStates: showStates.value,
        showMunicipios: showMunicipios.value,
        showPivots: showPivots.value,
      })
    )
  })

  /**
   * Toggle visibility of a layer
   */
  function toggleLayer(layer: 'areas' | 'car' | 'states' | 'municipios' | 'pivots') {
    switch (layer) {
      case 'areas':
        showAreas.value = !showAreas.value
        break
      case 'car':
        showCar.value = !showCar.value
        break
      case 'states':
        showStates.value = !showStates.value
        break
      case 'municipios':
        showMunicipios.value = !showMunicipios.value
        break
      case 'pivots':
        showPivots.value = !showPivots.value
        break
    }
  }

  /**
   * Set CAR opacity (0..1)
   */
  function setCarOpacity(value: number) {
    carOpacity.value = Math.max(0, Math.min(1, value))
  }

  return {
    showAreas,
    showCar,
    carOpacity,
    showStates,
    showMunicipios,
    showPivots,
    toggleLayer,
    setCarOpacity,
  }
}
