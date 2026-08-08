import { computed, ref, shallowRef, watch, type Ref, type ShallowRef } from 'vue'
import { polygonAreaHa } from '../lib/mapGeo'
import { fetchCarDetail, formatCarDetailRows, type CarDetailProperties } from '../lib/carDetails'

export interface UseCarDetailPanelOptions {
  selectedId: Ref<string | null>
  selectedFeature: ShallowRef<any | null>
}

/**
 * CAR property detail panel: municipality/area derived from the selected
 * feature + fetching the official (SICAR) data with caching, a race token,
 * and loading/error states. Extracted from MapaView.
 */
export function useCarDetailPanel({ selectedId, selectedFeature }: UseCarDetailPanelOptions) {
  const carDetailOpen = ref(false)
  const carDetailLoading = ref(false)
  const carDetailError = ref('')
  const carDetail = shallowRef<CarDetailProperties | null>(null)
  const carDetailCache = new Map<string, CarDetailProperties>()
  let carDetailRequestToken = 0

  const municipio = computed(() => selectedFeature.value?.properties?.municipio || null)
  const areaHa = computed(() =>
    selectedFeature.value ? polygonAreaHa(selectedFeature.value.geometry) : 0,
  )
  const carDetailRows = computed(() =>
    carDetail.value ? formatCarDetailRows(carDetail.value) : [],
  )

  function resetCarDetailPanel() {
    carDetailRequestToken += 1
    carDetailOpen.value = false
    carDetailLoading.value = false
    carDetailError.value = ''
    carDetail.value = null
  }

  async function loadSelectedCarDetails({ force = false } = {}) {
    const id = selectedId.value
    if (!id) return

    const cached = carDetailCache.get(id)
    if (cached && !force) {
      carDetail.value = cached
      carDetailError.value = ''
      carDetailLoading.value = false
      return
    }

    const token = carDetailRequestToken + 1
    carDetailRequestToken = token
    carDetailLoading.value = true
    carDetailError.value = ''
    try {
      const result = await fetchCarDetail(id)
      if (carDetailRequestToken !== token || selectedId.value !== id) return
      if (result.state === 'success') {
        carDetailCache.set(id, result.data)
        carDetail.value = result.data
        return
      }
      carDetail.value = null
      carDetailError.value = result.state === 'not-found'
        ? 'CAR não encontrado no SICAR.'
        : `Não foi possível carregar os dados oficiais (${result.error}).`
    } finally {
      if (carDetailRequestToken === token && selectedId.value === id) {
        carDetailLoading.value = false
      }
    }
  }

  function toggleCarDetailPanel() {
    carDetailOpen.value = !carDetailOpen.value
    if (carDetailOpen.value) void loadSelectedCarDetails()
  }

  function retryCarDetails() {
    void loadSelectedCarDetails({ force: true })
  }

  // Switching properties closes and clears the panel so data doesn't mix.
  watch(selectedId, resetCarDetailPanel)

  return {
    carDetailOpen,
    carDetailLoading,
    carDetailError,
    carDetail,
    carDetailRows,
    municipio,
    areaHa,
    toggleCarDetailPanel,
    retryCarDetails,
    resetCarDetailPanel,
  }
}
