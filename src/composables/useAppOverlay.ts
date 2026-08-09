import { ref, shallowRef, watch, type Ref } from 'vue'
import { fetchAppFeaturesForCod, createAppOverlayController } from '../lib/appOverlayLayer'

export interface UseAppOverlayOptions {
  selectedId: Ref<string | null>
}

/**
 * Per-parcel Área de Preservação Permanente (APP) layer toggle: fetches APP
 * polygons for the selected cod_imovel on demand and draws them via
 * appOverlayLayer's own pane. Opt-in only — no map-wide APP layer. Shown by
 * default as soon as a property is selected (silently, when data exists);
 * the toggle in the Camadas panel lets the user hide/show it afterwards.
 * Features are cached per cod_imovel so hide/show and the "Baixar APP"
 * download don't refetch, and cleared when the selected property changes.
 */
export function useAppOverlay({ selectedId }: UseAppOverlayOptions) {
  const appOverlay = createAppOverlayController()

  const appOverlayVisible = ref(false)
  const appOverlayLoading = ref(false)
  const appOverlayError = ref('')
  const appOverlayFeatures = shallowRef<any[] | null>(null)
  let requestToken = 0

  function resetAppOverlay() {
    requestToken += 1
    appOverlayVisible.value = false
    appOverlayLoading.value = false
    appOverlayError.value = ''
    appOverlayFeatures.value = null
    appOverlay.clear()
  }

  // silent=true is used for the automatic load right after a property is
  // selected: no data / a failed fetch just leaves the layer off, without
  // surfacing an error the user didn't ask for.
  async function loadAndShowAppOverlay(id: string, { silent = false } = {}) {
    if (appOverlayFeatures.value) {
      appOverlay.show(id, appOverlayFeatures.value)
      appOverlayVisible.value = true
      return
    }

    const token = requestToken + 1
    requestToken = token
    appOverlayLoading.value = true
    if (!silent) appOverlayError.value = ''
    try {
      const features = await fetchAppFeaturesForCod(id)
      if (requestToken !== token || selectedId.value !== id) return
      if (!features) {
        if (!silent) appOverlayError.value = 'Sem dados de Área de Preservação Permanente (APP) para este imóvel.'
        return
      }
      appOverlayFeatures.value = features
      appOverlay.show(id, features)
      appOverlayVisible.value = true
    } catch (_err) {
      if (requestToken === token && !silent) {
        appOverlayError.value = 'Falha ao carregar a Área de Preservação Permanente (APP).'
      }
    } finally {
      if (requestToken === token) appOverlayLoading.value = false
    }
  }

  async function toggleAppOverlay() {
    if (appOverlayLoading.value) return

    if (appOverlayVisible.value) {
      appOverlay.clear()
      appOverlayVisible.value = false
      return
    }

    const id = selectedId.value
    if (!id) return
    await loadAndShowAppOverlay(id)
  }

  // Switching properties (or closing the panel) invalidates the overlay so
  // it never shows or downloads the previous parcel's polygons, then tries
  // to show the new one's APP by default.
  watch(selectedId, (id) => {
    resetAppOverlay()
    if (id) void loadAndShowAppOverlay(id, { silent: true })
  })

  return {
    appOverlayVisible,
    appOverlayLoading,
    appOverlayError,
    appOverlayFeatures,
    toggleAppOverlay,
    resetAppOverlay,
    initAppOverlayLayer: appOverlay.init,
    destroyAppOverlayLayer: appOverlay.destroy,
  }
}
