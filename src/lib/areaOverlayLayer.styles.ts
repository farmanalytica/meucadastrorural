// @ts-nocheck
// Configuration and style constants for the CAR (SICAR) overlay.
// Extracted from areaOverlayLayer.ts with no value changes.

export const INVALID_AREA_OVERLAY_QUERY_MESSAGE = 'A busca no overlay deve comecar com o codigo do estado, por exemplo GO- ou MT-.';

// Zoom level below which section overview is shown instead of individual parcels.
export const SECTION_ZOOM_THRESHOLD = 11;
// Hard floor — below this zoom, the overlay renders nothing at all and the
// 13.4 MB manifest is never parsed.
export const MIN_OVERLAY_ZOOM = 5;
// Size of each overview section in degrees.
export const SECTION_DEG = 1.0;
export const MAX_CONCURRENT_CHUNK_FETCHES = 4;
export const MAX_SECTION_POLYGONS = 1500;
export const MAX_CHUNK_CACHE_FEATURES = 12000;
export const DETAIL_CHUNK_BUDGETS = [
    { minZoom: 13, maxChunks: 24, maxFeatures: 6000 },
    { minZoom: 12, maxChunks: 8, maxFeatures: 2000 },
    { minZoom: 11, maxChunks: 4, maxFeatures: 800 },
];

// Number of manifest chunks processed before yielding the event loop.
export const BUILD_SECTIONS_YIELD_EVERY = 4000;

export const DEFAULT_STYLE = {
    color: '#3b82f6',
    weight: 1.5,
    opacity: 0.75,
    fillColor: '#3b82f6',
    fillOpacity: 0.06,
};

export const HOVER_STYLE = {
    color: '#3b82f6',
    weight: 2.5,
    opacity: 0.9,
    fillColor: '#3b82f6',
    fillOpacity: 0.12,
};

export const SELECTED_STYLE = {
    color: '#1d4ed8',
    weight: 2.5,
    opacity: 0.85,
    fillColor: '#1d4ed8',
    fillOpacity: 0,
};

// Dedicated selection highlight — shown in its own top layer regardless of zoom.
export const SELECTION_HIGHLIGHT_STYLE = {
    color: '#f97316',
    weight: 4,
    opacity: 1,
    fillColor: '#f97316',
    fillOpacity: 0,
    interactive: false,
};

export const FEATURED_HIGHLIGHT_STYLE = {
    color: '#eab308',
    weight: 4,
    opacity: 1,
    fillColor: '#eab308',
    fillOpacity: 0.12,
    dashArray: '7 5',
    interactive: false,
};

export const SECTION_STYLE = {
    color: '#3b82f6',
    weight: 0.7,
    opacity: 0.35,
    fillColor: '#3b82f6',
    fillOpacity: 0.03,
};
