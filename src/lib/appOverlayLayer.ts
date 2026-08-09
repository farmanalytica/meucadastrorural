// @ts-nocheck
// Per-parcel APP (Área de Preservação Permanente) overlay: fetched on demand
// for a single selected cod_imovel, never map-wide (the dataset is 24GB).
// Modeled on areaOverlayLayer's findViaStaticIndex/resolveOverlayMatch
// (static index -> static bucket file -> filter) — not on the chunked
// viewport machinery, since this is a single fetch per click.
import { APPS_OVERLAY_PREFIX, fetchStaticJson } from './areaOverlayLayer.helpers';

const COD_IMOVEL_RE = /^([A-Z]{2})-(\d{7})-([0-9A-Fa-f]{32})$/;

export const APP_STYLE = {
    color: '#15803d',
    weight: 2,
    opacity: 0.95,
    fillColor: '#16a34a',
    fillOpacity: 0.28,
};

export function parseCodForApps(cod) {
    const match = COD_IMOVEL_RE.exec(String(cod || '').trim().toUpperCase());
    if (!match) return null;
    return { uf: match[1], municipio7: match[2] };
}

// Index and bucket files can be reused across clicks (a bucket holds many
// cod_imovel values, sometimes tens of MB), so both are cached by their
// resolved URL rather than refetched per property.
const indexCache = new Map();
const bucketCache = new Map();

function getMunicipioIndex(uf, municipio7) {
    const key = `${uf}/${municipio7}`;
    if (!indexCache.has(key)) {
        const url = `${APPS_OVERLAY_PREFIX}/index/${uf}/${municipio7}.json`;
        indexCache.set(key, fetchStaticJson(url, { allowNotFound: true }));
    }
    return indexCache.get(key);
}

function getBucket(relpath) {
    if (!bucketCache.has(relpath)) {
        const url = `${APPS_OVERLAY_PREFIX}/${relpath}`;
        bucketCache.set(relpath, fetchStaticJson(url, { allowNotFound: true }));
    }
    return bucketCache.get(relpath);
}

// Returns the property's APP features (typically ~11 sub-polygons across
// themes), or null when there's no APP data for this cod_imovel.
export async function fetchAppFeaturesForCod(cod) {
    const normalized = String(cod || '').trim().toUpperCase();
    const parsed = parseCodForApps(normalized);
    if (!parsed) return null;

    const index = await getMunicipioIndex(parsed.uf, parsed.municipio7);
    if (!index) return null;
    const relpath = index[normalized];
    if (!relpath) return null;

    const data = await getBucket(relpath);
    if (!data || !Array.isArray(data.features)) return null;

    const features = data.features.filter((f) => f?.properties?.cod_imovel === normalized);
    return features.length > 0 ? features : null;
}

function formatThemeLabel(codTema) {
    return String(codTema || '').replace(/_/g, ' ').trim();
}

// Draws/clears the APP overlay for the currently-selected parcel. Its own
// pane keeps it visually distinct (and above) the CAR selection highlight.
export function createAppOverlayController() {
    let leafletMap = null;
    let layer = null;
    let visibleCod = null;
    const APP_PANE = 'appOverlayPane';

    function ensurePane() {
        if (!leafletMap) return;
        let pane = leafletMap.getPane(APP_PANE);
        if (!pane) {
            pane = leafletMap.createPane(APP_PANE);
            pane.style.zIndex = '448';
            pane.style.pointerEvents = 'none';
        }
    }

    function init(map) {
        leafletMap = map;
    }

    function clear() {
        if (layer && leafletMap) leafletMap.removeLayer(layer);
        layer = null;
        visibleCod = null;
    }

    function show(cod, features) {
        const L = globalThis.L;
        if (!leafletMap || !L) return;
        clear();
        ensurePane();
        layer = L.geoJSON({ type: 'FeatureCollection', features }, {
            pane: APP_PANE,
            interactive: false,
            style: () => APP_STYLE,
            onEachFeature(feature, featureLayer) {
                const label = formatThemeLabel(feature.properties && feature.properties.cod_tema);
                if (label) featureLayer.bindTooltip(label, { sticky: true });
            },
        }).addTo(leafletMap);
        visibleCod = cod;
    }

    function destroy() {
        clear();
        leafletMap = null;
    }

    return {
        init,
        destroy,
        show,
        clear,
        isVisible: () => Boolean(layer),
        getVisibleCod: () => visibleCod,
    };
}
