// @ts-nocheck
// Pure helpers for the CAR (SICAR) overlay: static path resolution, fetch,
// section aggregation, and visible-chunk calculation. Extracted from
// areaOverlayLayer.ts with no logic changes — don't depend on the factory's state.

import {
    SECTION_DEG,
    SECTION_ZOOM_THRESHOLD,
    BUILD_SECTIONS_YIELD_EVERY,
    DETAIL_CHUNK_BUDGETS,
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

export function getDetailChunkBudget(zoom) {
    return DETAIL_CHUNK_BUDGETS.find((budget) => zoom >= budget.minZoom) || null;
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

export function computeDesiredChunkEntries(chunks, bounds, center, zoom) {
    const budget = getDetailChunkBudget(zoom);
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
