// @ts-nocheck
// Manages the chunked overlay of CAR (SICAR) outlines on Leaflet in map mode.
//
// Usage: call createUnavailableLayerController({ onSelectUnavailable }) once,
// then controller.init(leafletMap) after the map exists. The controller wires
// up moveend/zoomend to load only the visible chunks and fires
// onSelectUnavailable(unavailableId) when a polygon is clicked.
//
// Reads globalThis.L — MapaView guarantees the reference before instantiating.

// farmanalytica extension (not part of the port): hit-test + click cycling
// to choose between overlapping properties.
import { pointInPolygonGeom, polygonAreaHa } from './mapGeo';
import {
    INVALID_AREA_OVERLAY_QUERY_MESSAGE,
    SECTION_ZOOM_THRESHOLD,
    MIN_OVERLAY_ZOOM,
    MAX_CONCURRENT_CHUNK_FETCHES,
    MAX_SECTION_POLYGONS,
    MAX_CHUNK_CACHE_FEATURES,
    DEFAULT_STYLE,
    HOVER_STYLE,
    SELECTED_STYLE,
    SELECTION_HIGHLIGHT_STYLE,
    FEATURED_HIGHLIGHT_STYLE,
    SECTION_STYLE,
} from './areaOverlayLayer.styles';
import {
    requestStaticAreaJson,
    buildSectionsAsync,
    sectionToGeoJsonFeature,
    bboxIntersects,
    getDetailChunkBudget,
    getChunkDistanceScore,
    computeDesiredChunkEntries,
    getChunkIdsToUnload,
    shouldUseSectionLayer,
    shouldAddResolvedChunkLayer,
} from './areaOverlayLayer.helpers';
import { createChunkLoadScheduler } from './chunkLoadScheduler';

export const __testables = {
    INVALID_AREA_OVERLAY_QUERY_MESSAGE,
    SECTION_ZOOM_THRESHOLD,
    MAX_CONCURRENT_CHUNK_FETCHES,
    getDetailChunkBudget,
    computeDesiredChunkEntries,
    getChunkIdsToUnload,
    shouldAddResolvedChunkLayer,
    shouldUseSectionLayer,
};

// ─── Factory ──────────────────────────────────────────────────────────────────
export function createUnavailableLayerController({ onSelectUnavailable } = {}) {
    let leafletMap = null;
    let manifestPromise = null;
    let sectionsPromise = null;
    let visible = false;
    let selectedUnavailableId = null;
    let selectionHighlightLayer = null;
    let selectionHighlightPending = null;
    let featuredId = null;
    let featuredHighlightLayer = null;
    let featuredHighlightPending = null;
    // Opacity multiplier for the CAR overlay (0..1), driven by the layers panel.
    let opacityMul = 1;
    let interactionsEnabled = true;
    // Click cycling on overlapping properties (farmanalytica extension).
    let clickCycleState = { x: 0, y: 0, ids: [], index: 0, has: false };

    const UNAVAILABLE_HIGHLIGHT_PANE = 'mapUnavailableHighlightPane';
    const FEATURED_HIGHLIGHT_PANE = 'mapFeaturedHighlightPane';
    let chunkRenderer = null;
    function ensureHighlightPane() {
        if (!leafletMap) return;
        let highlightPane = leafletMap.getPane(UNAVAILABLE_HIGHLIGHT_PANE);
        if (!highlightPane) {
            highlightPane = leafletMap.createPane(UNAVAILABLE_HIGHLIGHT_PANE);
            highlightPane.style.zIndex = '446';
            highlightPane.style.pointerEvents = 'none';
        }
    }
    function ensureFeaturedPane() {
        if (!leafletMap) return;
        let pane = leafletMap.getPane(FEATURED_HIGHLIGHT_PANE);
        if (!pane) {
            pane = leafletMap.createPane(FEATURED_HIGHLIGHT_PANE);
            pane.style.zIndex = '445';
            pane.style.pointerEvents = 'none';
        }
    }
    function getChunkRenderer() {
        const L = globalThis.L;
        if (!L || !leafletMap) return null;
        if (!chunkRenderer) {
            chunkRenderer = L.canvas({ padding: 0.5, tolerance: 4 });
        }
        return chunkRenderer;
    }

    const chunkDataCache = new Map();
    const activeLayers = new Map();
    let sectionLayer = null;

    const chunkLoadScheduler = createChunkLoadScheduler({
        maxConcurrent: MAX_CONCURRENT_CHUNK_FETCHES,
        load: (entry) => fetchChunk(entry),
        isLoaded: (chunkId) => activeLayers.has(chunkId),
        isEnabled: () => visible && Boolean(leafletMap),
        onLoaded: (entry, data) => addChunkLayer(entry.id, data),
        onError: (err, entry) => {
            console.error(`Unavailable overlay chunk ${entry.id} load failed:`, err);
        },
    });

    function getManifest() {
        if (!manifestPromise) {
            const chunks = [];
            manifestPromise = requestStaticAreaJson('manifest')
                .then((staticMf) => {
                    if (staticMf && Array.isArray(staticMf.chunks)) {
                        for (const entry of staticMf.chunks) {
                            chunks.push(entry);
                        }
                    }
                    return chunks.length > 0
                        ? { chunk_size_deg: (staticMf || {}).chunk_size_deg, chunks }
                        : null;
                });
        }
        return manifestPromise;
    }

    function getSections() {
        if (sectionsPromise) return sectionsPromise;
        sectionsPromise = (async () => {
            const precomputed = await requestStaticAreaJson('sections', { allowNotFound: true });
            if (Array.isArray(precomputed) && precomputed.length > 0) {
                return precomputed;
            }
            const mf = await getManifest();
            if (!mf) return [];
            return buildSectionsAsync(mf);
        })().catch((err) => {
            sectionsPromise = null;
            throw err;
        });
        return sectionsPromise;
    }

    function scaleStyle(style) {
        if (opacityMul >= 1) return style;
        return {
            ...style,
            opacity: (style.opacity || 0) * opacityMul,
            fillOpacity: (style.fillOpacity || 0) * opacityMul,
        };
    }

    function styleForFeature(feature) {
        const id = feature && feature.properties && feature.properties.unavailable_id;
        return scaleStyle((id && id === selectedUnavailableId) ? SELECTED_STYLE : DEFAULT_STYLE);
    }

    function applyLayerInteractivity(layer, isInteractive) {
        if (!layer) return;
        layer.options.interactive = isInteractive;
        layer.eachLayer((sub) => {
            sub.options.interactive = isInteractive;
            const el = sub.getElement && sub.getElement();
            if (el) el.style.cursor = '';
        });
        if (!isInteractive) layer.setStyle(styleForFeature);
    }

    function setInteractive(isInteractive) {
        interactionsEnabled = Boolean(isInteractive);
        clickCycleState.has = false;
        for (const layer of activeLayers.values()) {
            applyLayerInteractivity(layer, interactionsEnabled);
        }
    }

    function setOpacity(frac) {
        const next = Number(frac);
        opacityMul = Number.isFinite(next) ? Math.max(0, Math.min(1, next)) : 1;
        for (const layer of activeLayers.values()) layer.setStyle(styleForFeature);
    }

    function getCachedFeatureSum() {
        let total = 0;
        for (const value of chunkDataCache.values()) total += value.count || 0;
        return total;
    }

    function fetchChunk(entry) {
        const cached = chunkDataCache.get(entry.id);
        if (cached) {
            chunkDataCache.delete(entry.id);
            chunkDataCache.set(entry.id, cached);
            return cached.promise;
        }
        const overlayPath = `chunks/${encodeURIComponent(entry.id)}`;
        const promise = requestStaticAreaJson(overlayPath).catch((err) => {
            chunkDataCache.delete(entry.id);
            throw err;
        });
        chunkDataCache.set(entry.id, { promise, count: entry.count || 0 });
        while (chunkDataCache.size > 1 && getCachedFeatureSum() > MAX_CHUNK_CACHE_FEATURES) {
            const oldestKey = chunkDataCache.keys().next().value;
            if (oldestKey === undefined) break;
            if (oldestKey === entry.id) break;
            chunkDataCache.delete(oldestKey);
        }
        return promise;
    }

    function getFeatureBounds(feature) {
        const L = globalThis.L;
        if (!L || !feature) return null;
        return L.geoJSON(feature).getBounds();
    }

    // Tolerate common paste/typing mistakes: dots, spaces or underscores used
    // instead of dashes, stray punctuation, duplicated dashes, lowercase input.
    function normalizeAreaOverlaySearchQuery(query) {
        return String(query || '')
            .trim()
            .toUpperCase()
            .replace(/[.\s_]+/g, '-')
            .replace(/[^A-Z0-9-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    async function findInCachedChunks(normalizedStem) {
        for (const [chunkId, value] of chunkDataCache) {
            let data;
            try { data = await value.promise; } catch { continue; }
            if (!data || !Array.isArray(data.features)) continue;
            for (const feature of data.features) {
                const props = feature.properties || {};
                const id = String(props.unavailable_id || props.cod_imovel || '').toUpperCase();
                if (id === normalizedStem) {
                    return { chunkId, stem: normalizedStem, feature, bounds: getFeatureBounds(feature) };
                }
            }
        }
        return null;
    }

    async function findViaStaticIndex(normalizedQuery) {
        const stateMatch = /^([A-Z]{2})-.+$/.exec(normalizedQuery);
        if (!stateMatch) throw new Error(INVALID_AREA_OVERLAY_QUERY_MESSAGE);
        const state = stateMatch[1];
        const indexData = await requestStaticAreaJson(
            `stem_index_${state}`,
            { allowNotFound: true },
        );
        if (!indexData) return null;
        const stem = Object.prototype.hasOwnProperty.call(indexData, normalizedQuery)
            ? normalizedQuery
            : Object.keys(indexData)
                .sort((left, right) => left.localeCompare(right))
                .find((candidate) => candidate.toUpperCase().startsWith(normalizedQuery));
        if (!stem) return null;
        const chunkFile = indexData[stem];
        if (!chunkFile) return null;
        const chunkIdMatch = /chunk_(-?\d+_-?\d+)\.geojson$/.exec(chunkFile);
        if (!chunkIdMatch) return null;
        const chunkId = chunkIdMatch[1];
        const overlayPath = `chunks/${encodeURIComponent(chunkId)}`;
        const data = await requestStaticAreaJson(overlayPath);
        if (!data || !Array.isArray(data.features)) return null;
        for (const feature of data.features) {
            const props = feature.properties || {};
            const id = String(props.unavailable_id || props.cod_imovel || '').toUpperCase();
            if (id === stem) {
                return { chunkId, stem, feature, bounds: getFeatureBounds(feature) };
            }
        }
        return null;
    }

    async function resolveOverlayMatch(normalizedQuery) {
        const fromCache = await findInCachedChunks(normalizedQuery);
        if (fromCache) return fromCache;
        return findViaStaticIndex(normalizedQuery);
    }

    async function findAreaOverlayByStem(stem) {
        const normalizedStem = normalizeAreaOverlaySearchQuery(stem);
        if (!normalizedStem) return null;
        const match = await resolveOverlayMatch(normalizedStem);
        if (!match || match.stem !== normalizedStem) return null;
        return { chunkId: match.chunkId, unavailableId: match.stem, feature: match.feature, bounds: match.bounds };
    }

    async function findAreaOverlay(query) {
        const normalizedQuery = normalizeAreaOverlaySearchQuery(query);
        if (!normalizedQuery) return null;
        const match = await resolveOverlayMatch(normalizedQuery);
        if (!match) return null;
        return { chunkId: match.chunkId, unavailableId: match.stem, feature: match.feature, bounds: match.bounds };
    }

    async function focusUnavailable(queryOrUnavailableId) {
        if (!leafletMap) return null;
        const match = await findAreaOverlay(queryOrUnavailableId);
        if (!match) return null;
        const mf = await getManifest();
        if (!mf) return null;
        const chunkEntry = mf.chunks.find((entry) => entry.id === match.chunkId);
        if (visible && chunkEntry && !activeLayers.has(match.chunkId)) {
            const data = await fetchChunk(chunkEntry);
            if (visible && leafletMap) addChunkLayer(match.chunkId, data);
        }
        selectUnavailable(match.unavailableId);
        if (match.bounds && match.bounds.isValid()) {
            leafletMap.fitBounds(match.bounds, { padding: [40, 40], animate: false, maxZoom: 15 });
        }
        return match;
    }

    // farmanalytica extension: collects all loaded properties whose polygon
    // contains the clicked point, sorted by area (smallest first).
    function getUnavailableFeaturesAt(latlng) {
        const results = [];
        const lng = latlng.lng;
        const lat = latlng.lat;
        for (const layer of activeLayers.values()) {
            layer.eachLayer((sub) => {
                const feature = sub.feature;
                if (!feature || !feature.geometry) return;
                const id = feature.properties && feature.properties.unavailable_id;
                if (!id) return;
                let bounds = null;
                try { bounds = sub.getBounds(); } catch (_e) { bounds = null; }
                if (bounds && bounds.isValid && bounds.isValid() && !bounds.contains(latlng)) return;
                if (!pointInPolygonGeom(lng, lat, feature.geometry)) return;
                results.push({ id, feature, areaHa: polygonAreaHa(feature.geometry) });
            });
        }
        results.sort((a, b) => (a.areaHa - b.areaHa) || String(a.id).localeCompare(String(b.id)));
        return results;
    }

    // farmanalytica extension: repeated clicks on the same point cycle between
    // overlapping properties. Calls onSelectUnavailable with meta {index,total}.
    function handleOverlappingClick(latlng, containerPoint, topFeature) {
        let list = getUnavailableFeaturesAt(latlng);
        if (list.length === 0 && topFeature) {
            const id = topFeature.properties && topFeature.properties.unavailable_id;
            if (id) list = [{ id, feature: topFeature, areaHa: 0 }];
        }
        if (list.length === 0) return;

        const ids = list.map((item) => item.id);
        const px = containerPoint ? containerPoint.x : 0;
        const py = containerPoint ? containerPoint.y : 0;
        const sameSpot = clickCycleState.has &&
            Math.abs(px - clickCycleState.x) <= 8 &&
            Math.abs(py - clickCycleState.y) <= 8;
        const sameSet = clickCycleState.ids.length === ids.length &&
            clickCycleState.ids.every((v, i) => v === ids[i]);

        let index = 0;
        if (sameSpot && sameSet && ids.length > 1) {
            index = (clickCycleState.index + 1) % ids.length;
        }
        clickCycleState = { x: px, y: py, ids, index, has: true };

        if (onSelectUnavailable) {
            onSelectUnavailable(ids[index], { index: index + 1, total: ids.length });
        }
    }

    function addChunkLayer(chunkId, geojsonData) {
        if (!leafletMap || activeLayers.has(chunkId)) return;
        const L = globalThis.L;
        if (!L) return;
        const renderer = getChunkRenderer();
        const layer = L.geoJSON(geojsonData, {
            renderer,
            style: styleForFeature,
            interactive: interactionsEnabled,
            bubblingMouseEvents: false,
            onEachFeature(feature, featureLayer) {
                featureLayer.options.interactive = interactionsEnabled;
                featureLayer.on('mouseover', () => {
                    if (!interactionsEnabled) return;
                    const id = feature.properties && feature.properties.unavailable_id;
                    if (!id || id === selectedUnavailableId) return;
                    featureLayer.setStyle(scaleStyle(HOVER_STYLE));
                    const el = featureLayer.getElement();
                    if (el) el.style.cursor = 'pointer';
                });
                featureLayer.on('mouseout', () => {
                    if (!interactionsEnabled) return;
                    if (layer) layer.resetStyle(featureLayer);
                });
                featureLayer.on('click', (event) => {
                    if (!interactionsEnabled) return;
                    if (event && L.DomEvent) L.DomEvent.stopPropagation(event);
                    handleOverlappingClick(event.latlng, event.containerPoint, feature);
                });
            },
        }).addTo(leafletMap);
        activeLayers.set(chunkId, layer);
    }

    function removeChunkLayer(chunkId) {
        const layer = activeLayers.get(chunkId);
        if (!layer || !leafletMap) return;
        leafletMap.removeLayer(layer);
        activeLayers.delete(chunkId);
    }

    async function refreshSectionLayer(bounds, generation) {
        if (!leafletMap) return;
        const L = globalThis.L;
        if (!L) return;

        let sections;
        try {
            sections = await getSections();
        } catch (err) {
            console.error('Unavailable overlay sections failed to load:', err);
            return;
        }
        if (!chunkLoadScheduler.isCurrentGeneration(generation) || !visible || !leafletMap) return;
        if (!Array.isArray(sections) || sections.length === 0) return;

        const center = leafletMap.getCenter();
        const visibleSections = sections
            .filter((section) => bboxIntersects(section.bbox, bounds))
            .sort((a, b) => getChunkDistanceScore(a, center) - getChunkDistanceScore(b, center))
            .slice(0, MAX_SECTION_POLYGONS);

        const featureCollection = {
            type: 'FeatureCollection',
            features: visibleSections.map(sectionToGeoJsonFeature),
        };

        removeSectionLayer();
        sectionLayer = L.geoJSON(featureCollection, {
            style: () => SECTION_STYLE,
            interactive: false,
        }).addTo(leafletMap);
    }

    function removeSectionLayer() {
        if (!sectionLayer || !leafletMap) return;
        leafletMap.removeLayer(sectionLayer);
        sectionLayer = null;
    }

    async function refresh() {
        if (!visible || !leafletMap) return;
        const currentGeneration = chunkLoadScheduler.startGeneration();

        const zoom = leafletMap.getZoom();
        if (zoom < MIN_OVERLAY_ZOOM) {
            removeSectionLayer();
            for (const id of [...activeLayers.keys()]) removeChunkLayer(id);
            chunkDataCache.clear();
            return;
        }

        const bounds = leafletMap.getBounds();

        if (zoom < SECTION_ZOOM_THRESHOLD) {
            removeSectionLayer();
            for (const id of [...activeLayers.keys()]) removeChunkLayer(id);
            chunkDataCache.clear();
            return;
        }

        let mf;
        try {
            mf = await getManifest();
        } catch (err) {
            console.error('Unavailable overlay manifest failed to load:', err);
            return;
        }
        if (!mf) {
            console.error('Unavailable overlay manifest returned empty — check local_chunks/area_overlay/manifest.json');
            return;
        }
        if (!chunkLoadScheduler.isCurrentGeneration(currentGeneration) || !visible || !leafletMap) return;

        removeSectionLayer();

        const center = leafletMap.getCenter();
        const desiredEntries = computeDesiredChunkEntries(mf.chunks, bounds, center, zoom);
        chunkLoadScheduler.setDesiredEntries(desiredEntries, currentGeneration);
        const desiredChunkIds = chunkLoadScheduler.getDesiredChunkIds();

        for (const id of getChunkIdsToUnload(activeLayers.keys(), desiredChunkIds)) {
            removeChunkLayer(id);
        }

        if (shouldUseSectionLayer(zoom, desiredEntries)) {
            removeSectionLayer();
            void refreshSectionLayer(bounds, currentGeneration);
            return;
        }

        chunkLoadScheduler.enqueueAll(desiredEntries, { generation: currentGeneration });
    }

    function removeSelectionHighlight() {
        if (selectionHighlightLayer && leafletMap) leafletMap.removeLayer(selectionHighlightLayer);
        selectionHighlightLayer = null;
        selectionHighlightPending = null;
    }

    function setSelectionHighlight(feature) {
        const L = globalThis.L;
        if (!L || !leafletMap || !feature) return;
        if (selectionHighlightLayer) leafletMap.removeLayer(selectionHighlightLayer);
        ensureHighlightPane();
        selectionHighlightLayer = L.geoJSON(feature, {
            pane: UNAVAILABLE_HIGHLIGHT_PANE,
            style: () => SELECTION_HIGHLIGHT_STYLE,
            interactive: false,
        }).addTo(leafletMap);
    }

    async function updateSelectionHighlight(id) {
        const token = {};
        selectionHighlightPending = token;
        const match = await findAreaOverlayByStem(id);
        if (selectionHighlightPending !== token) return;
        if (match && match.feature) setSelectionHighlight(match.feature);
    }

    function removeFeaturedHighlight() {
        if (featuredHighlightLayer && leafletMap) leafletMap.removeLayer(featuredHighlightLayer);
        featuredHighlightLayer = null;
        featuredHighlightPending = null;
    }

    function setFeaturedHighlightLayer(feature) {
        const L = globalThis.L;
        if (!L || !leafletMap || !feature) return;
        if (featuredHighlightLayer) leafletMap.removeLayer(featuredHighlightLayer);
        ensureFeaturedPane();
        featuredHighlightLayer = L.geoJSON(feature, {
            pane: FEATURED_HIGHLIGHT_PANE,
            style: () => FEATURED_HIGHLIGHT_STYLE,
            interactive: false,
        }).addTo(leafletMap);
    }

    async function highlightFeatured(id) {
        featuredId = id || null;
        removeFeaturedHighlight();
        if (!featuredId) return;
        const token = {};
        featuredHighlightPending = token;
        const match = await findAreaOverlayByStem(featuredId);
        if (featuredHighlightPending !== token) return;
        if (match && match.feature) setFeaturedHighlightLayer(match.feature);
    }

    function selectUnavailable(id) {
        selectedUnavailableId = id;
        for (const layer of activeLayers.values()) layer.setStyle(styleForFeature);
        removeSelectionHighlight();
        if (id) updateSelectionHighlight(id);
    }

    function clearSelection() {
        selectedUnavailableId = null;
        for (const layer of activeLayers.values()) layer.setStyle(styleForFeature);
        removeSelectionHighlight();
    }

    function setVisible(isVisible) {
        visible = Boolean(isVisible);
        if (!leafletMap) return;
        if (!visible) {
            cancelScheduledRefresh();
            chunkLoadScheduler.cancel();
            removeSectionLayer();
            for (const id of [...activeLayers.keys()]) removeChunkLayer(id);
            removeFeaturedHighlight();
            // Selection highlight (orange) deliberately survives hiding the
            // CAR layer — the selected parcel should stay visible on its own.
        } else {
            refresh();
            if (selectedUnavailableId) updateSelectionHighlight(selectedUnavailableId);
            if (featuredId) highlightFeatured(featuredId);
        }
    }

    let refreshDebounceTimer = null;
    function scheduleRefresh() {
        clickCycleState.has = false; // pan/zoom invalidates the cycle point
        if (refreshDebounceTimer !== null) clearTimeout(refreshDebounceTimer);
        refreshDebounceTimer = setTimeout(() => {
            refreshDebounceTimer = null;
            refresh();
        }, 120);
    }
    function cancelScheduledRefresh() {
        if (refreshDebounceTimer !== null) {
            clearTimeout(refreshDebounceTimer);
            refreshDebounceTimer = null;
        }
    }

    function init(map) {
        leafletMap = map;
        leafletMap.on('moveend', scheduleRefresh);
        leafletMap.on('zoomend', scheduleRefresh);
        if (visible) refresh();
    }

    function destroy() {
        if (leafletMap) {
            leafletMap.off('moveend', scheduleRefresh);
            leafletMap.off('zoomend', scheduleRefresh);
        }
        cancelScheduledRefresh();
        chunkLoadScheduler.destroy();
        removeSectionLayer();
        removeSelectionHighlight();
        removeFeaturedHighlight();
        for (const id of [...activeLayers.keys()]) removeChunkLayer(id);
        chunkRenderer = null;
        leafletMap = null;
    }

    return {
        init,
        destroy,
        refresh,
        setVisible,
        setOpacity,
        setInteractive,
        selectUnavailable,
        clearSelection,
        findAreaOverlay,
        focusUnavailable,
        highlightFeatured,
        getSelectedUnavailableId: () => selectedUnavailableId,
        isVisible: () => visible,
    };
}
