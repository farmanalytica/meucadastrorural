// @ts-nocheck
// Pure helpers for the CAR (SICAR) overlay: static path resolution, fetch,
// section aggregation, and visible-chunk calculation. Extracted from
// areaOverlayLayer.ts with no logic changes — don't depend on the factory's state.

import {
    SECTION_DEG,
    SECTION_ZOOM_THRESHOLD,
    BUILD_SECTIONS_YIELD_EVERY,
    DETAIL_CHUNK_BUDGETS,
    VIEWPORT_REFERENCE_AREA,
    VIEWPORT_BUDGET_SCALE_MIN,
    VIEWPORT_BUDGET_SCALE_MAX,
    MOBILE_BUDGET_FACTOR,
    SAVE_DATA_BUDGET_FACTOR,
    SLOW_2G_BUDGET_FACTOR,
    EFFECTIVE_3G_BUDGET_FACTOR,
    MOBILE_MAX_CONCURRENT_CHUNK_FETCHES,
    CHUNK_RENDERER_TARGET_BUFFER_PX,
    CHUNK_RENDERER_MIN_PADDING,
    CHUNK_RENDERER_MAX_PADDING,
} from './areaOverlayLayer.styles';

// Resolves the layer's logical overlay path to a static file path under a given prefix.
export function resolveStaticPath(overlayPath, prefix) {
    if (overlayPath === 'manifest') {
        return `${prefix}/manifest.json`;
    }
    if (overlayPath === 'sections') {
        return `${prefix}/sections.json`;
    }
    const chunkMatch = /^chunks\/(-?\d+_-?\d+)$/.exec(overlayPath);
    if (chunkMatch) {
        return `${prefix}/chunks/chunk_${chunkMatch[1]}.geojson`;
    }
    const indexMatch = /^stem_index_([A-Z]{2})$/.exec(overlayPath);
    if (indexMatch) {
        return `${prefix}/stem_index_${indexMatch[1]}.json`;
    }
    return null;
}

// Fetches manifest or chunk GeoJSON from static files only — no API involved.
export async function requestStaticAreaJson(overlayPath, { allowNotFound = false } = {}) {
    const S3_URL = 'https://dados-car-963200076509-us-east-2-an.s3.us-east-2.amazonaws.com'
    const prefixes = [`${S3_URL}/local_chunks/area_overlay`];

    for (const prefix of prefixes) {
        const url = resolveStaticPath(overlayPath, prefix);
        if (!url) continue;
        try {
            const response = await fetch(url);
            if (allowNotFound && response.status === 404) continue;
            if (response.ok) return await response.json();
        } catch (_err) {
            // try next prefix
        }
    }
    return null;
}

// ─── APP overlay (per-parcel, on-demand) ──────────────────────────────────────
// Same bucket as area_overlay, separate prefix. Unlike area_overlay this is
// never fetched map-wide — only for a single selected cod_imovel at a time,
// so there's no chunk manifest/scheduler here, just a direct static fetch.
export const S3_URL = 'https://dados-car-963200076509-us-east-2-an.s3.us-east-2.amazonaws.com';
export const APPS_OVERLAY_PREFIX = `${S3_URL}/local_chunks/apps_overlay`;

// Generic static-file JSON fetch (used by the APP overlay's index/bucket
// lookups, which — unlike area_overlay — address files by a fully-formed
// relative path rather than a logical overlayPath needing resolution).
export async function fetchStaticJson(url, { allowNotFound = false } = {}) {
    try {
        const response = await fetch(url);
        if (allowNotFound && response.status === 404) return null;
        if (response.ok) return await response.json();
    } catch (_err) {
        // caller treats a failed fetch the same as "no data"
    }
    return null;
}

// ─── Section helpers ──────────────────────────────────────────────────────────
export async function buildSectionsAsync(mf) {
    const sectionMap = new Map();
    let i = 0;
    for (const entry of mf.chunks) {
        const [minLon, minLat, maxLon, maxLat] = entry.bbox;
        const colStart = Math.floor(minLon / SECTION_DEG);
        const colEnd = Math.floor((maxLon - 1e-9) / SECTION_DEG);
        const rowStart = Math.floor(minLat / SECTION_DEG);
        const rowEnd = Math.floor((maxLat - 1e-9) / SECTION_DEG);
        for (let sCol = colStart; sCol <= colEnd; sCol++) {
            for (let sRow = rowStart; sRow <= rowEnd; sRow++) {
                const sId = `${sCol}_${sRow}`;
                if (!sectionMap.has(sId)) {
                    sectionMap.set(sId, {
                        id: sId,
                        bbox: [
                            sCol * SECTION_DEG,
                            sRow * SECTION_DEG,
                            (sCol + 1) * SECTION_DEG,
                            (sRow + 1) * SECTION_DEG,
                        ],
                        count: 0,
                    });
                }
                sectionMap.get(sId).count += entry.count;
            }
        }
        i += 1;
        if (i % BUILD_SECTIONS_YIELD_EVERY === 0) {
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    }
    return [...sectionMap.values()];
}

export function sectionToGeoJsonFeature(section) {
    const [minLon, minLat, maxLon, maxLat] = section.bbox;
    return {
        type: 'Feature',
        geometry: {
            type: 'Polygon',
            coordinates: [[
                [minLon, minLat],
                [maxLon, minLat],
                [maxLon, maxLat],
                [minLon, maxLat],
                [minLon, minLat],
            ]],
        },
        properties: { sectionId: section.id, bbox: section.bbox },
    };
}

export function bboxIntersects(bbox, bounds) {
    return (
        bbox[2] >= bounds.getWest() &&
        bbox[0] <= bounds.getEast() &&
        bbox[3] >= bounds.getSouth() &&
        bbox[1] <= bounds.getNorth()
    );
}

// True on phones/tablets — devices whose primary input is a coarse (touch)
// pointer, regardless of viewport size (a touch laptop docked to a big
// monitor stays "fine").
export function isCoarsePointerDevice() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(pointer: coarse)').matches;
}

function getNetworkInfo() {
    if (typeof navigator === 'undefined') return null;
    return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
}

// Multiplier for slow/metered connections (data-saver, 2G/3G) — independent
// of device type, since a desktop tethered to a phone hotspot pays the same
// per-byte cost as the phone itself.
export function getConnectionBudgetFactor() {
    const conn = getNetworkInfo();
    if (!conn) return 1;
    if (conn.saveData) return SAVE_DATA_BUDGET_FACTOR;
    if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') return SLOW_2G_BUDGET_FACTOR;
    if (conn.effectiveType === '3g') return EFFECTIVE_3G_BUDGET_FACTOR;
    return 1;
}

// Combines viewport-area scale (bigger screen → smaller budget, since
// canvas rasterization cost scales with CSS-pixel area) with device/network
// cuts (touch-primary hardware, slow/metered connections).
export function getBudgetScale(viewportArea) {
    const areaScale = viewportArea
        ? Math.min(VIEWPORT_BUDGET_SCALE_MAX, Math.max(VIEWPORT_BUDGET_SCALE_MIN, VIEWPORT_REFERENCE_AREA / viewportArea))
        : 1;
    const mobileFactor = isCoarsePointerDevice() ? MOBILE_BUDGET_FACTOR : 1;
    const connectionFactor = getConnectionBudgetFactor();
    return areaScale * mobileFactor * connectionFactor;
}

// Converts a fixed pixel-margin target into the ratio Leaflet's canvas
// `padding` option expects, so the actual backing-buffer margin stays
// roughly constant across viewport sizes instead of compounding with them.
export function getAdaptiveCanvasPadding(viewportSize) {
    if (!viewportSize || !viewportSize.x || !viewportSize.y) return CHUNK_RENDERER_MAX_PADDING;
    const smallestDimension = Math.min(viewportSize.x, viewportSize.y);
    const raw = CHUNK_RENDERER_TARGET_BUFFER_PX / smallestDimension;
    return Math.min(CHUNK_RENDERER_MAX_PADDING, Math.max(CHUNK_RENDERER_MIN_PADDING, raw));
}

export function getRecommendedConcurrency(baseConcurrency) {
    if (isCoarsePointerDevice() || getConnectionBudgetFactor() < 1) {
        return Math.min(baseConcurrency, MOBILE_MAX_CONCURRENT_CHUNK_FETCHES);
    }
    return baseConcurrency;
}

export function getDetailChunkBudget(zoom, viewportArea) {
    const base = DETAIL_CHUNK_BUDGETS.find((budget) => zoom >= budget.minZoom) || null;
    if (!base) return null;
    const scale = getBudgetScale(viewportArea);
    if (scale === 1) return base;
    return {
        minZoom: base.minZoom,
        maxChunks: Math.max(2, Math.round(base.maxChunks * scale)),
        maxFeatures: Math.max(300, Math.round(base.maxFeatures * scale)),
    };
}

export function getChunkCenter(entry) {
    const [minLon, minLat, maxLon, maxLat] = entry.bbox;
    return {
        lng: (minLon + maxLon) / 2,
        lat: (minLat + maxLat) / 2,
    };
}

export function getChunkDistanceScore(entry, center) {
    const chunkCenter = getChunkCenter(entry);
    const dx = chunkCenter.lng - center.lng;
    const dy = chunkCenter.lat - center.lat;
    return (dx * dx) + (dy * dy);
}

export function computeDesiredChunkEntries(chunks, bounds, center, zoom, viewportArea) {
    const budget = getDetailChunkBudget(zoom, viewportArea);
    if (!budget || !bounds || !center) return [];

    const visibleEntries = chunks
        .filter((entry) => bboxIntersects(entry.bbox, bounds))
        .sort((left, right) => {
            const distanceDelta = getChunkDistanceScore(left, center) - getChunkDistanceScore(right, center);
            if (distanceDelta !== 0) return distanceDelta;
            return left.count - right.count;
        });

    const desiredEntries = [];
    let featureBudget = 0;

    for (const entry of visibleEntries) {
        if (desiredEntries.length >= budget.maxChunks) break;
        const nextFeatureBudget = featureBudget + entry.count;
        if (desiredEntries.length > 0 && nextFeatureBudget > budget.maxFeatures) break;
        desiredEntries.push(entry);
        featureBudget = nextFeatureBudget;
    }

    return desiredEntries;
}

export function getChunkIdsToUnload(activeChunkIds, desiredChunkIds) {
    return [...activeChunkIds].filter((id) => !desiredChunkIds.has(id));
}

export function shouldUseSectionLayer(zoom, desiredChunkEntries) {
    return zoom < SECTION_ZOOM_THRESHOLD || desiredChunkEntries.length === 0;
}

export function shouldAddResolvedChunkLayer({
    force = false,
    visible,
    hasMap,
    chunkId,
    desiredChunkIds,
    requestGeneration,
    activeGeneration,
}) {
    if (!visible || !hasMap) return false;
    if (force) return true;
    if (requestGeneration !== activeGeneration) return false;
    return desiredChunkIds.has(chunkId);
}
