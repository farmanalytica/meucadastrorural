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

// Budgets above were sized for a ~1920x1080 (Full HD) viewport. Canvas
// rasterization cost scales with viewport CSS-pixel area — a 4K screen at
// 100% OS scale has ~4x the area of 1080p even though devicePixelRatio is
// still 1 — so budgets are scaled down for larger viewports. Clamped so
// small screens don't get an unbounded boost either.
export const VIEWPORT_REFERENCE_AREA = 1920 * 1080;
export const VIEWPORT_BUDGET_SCALE_MIN = 0.25;
export const VIEWPORT_BUDGET_SCALE_MAX = 1.5;

// Touch-primary devices (phones/tablets) have weaker CPU/GPU than desktop
// even when their viewport area is small, so they get a flat extra cut on
// top of the viewport-area scale above.
export const MOBILE_BUDGET_FACTOR = 0.6;

// Cellular connections (common for field use in rural areas) pay per byte
// for every chunk fetched — cut budgets further on slow/metered connections
// so the overlay doesn't burn a data plan pulling parcels the user pans past.
export const SAVE_DATA_BUDGET_FACTOR = 0.5;
export const SLOW_2G_BUDGET_FACTOR = 0.4;
export const EFFECTIVE_3G_BUDGET_FACTOR = 0.7;

// Fetch concurrency on mobile/slow connections — fewer parallel requests so
// a single weak link doesn't queue-stall everything behind it.
export const MOBILE_MAX_CONCURRENT_CHUNK_FETCHES = 2;

// Leaflet's canvas `padding` option is a ratio of the *viewport* size, not
// an absolute pixel margin — the backing buffer is (1+2*padding)^2 times
// the viewport's own pixel area. A fixed padding of 0.5 was sized for a
// 1080p viewport (~a 960px pan buffer); on a 4K viewport that same ratio
// produces a buffer 4x bigger in each dimension, so the canvas backing
// surface ends up ~16x the pixel count it was on Full HD. These constants
// keep the buffer roughly constant in absolute pixels instead.
export const CHUNK_RENDERER_TARGET_BUFFER_PX = 250;
export const CHUNK_RENDERER_MIN_PADDING = 0.1;
export const CHUNK_RENDERER_MAX_PADDING = 0.5;

// Number of manifest chunks processed before yielding the event loop.
export const BUILD_SECTIONS_YIELD_EVERY = 4000;

// Idle (unselected, unhovered) parcels render outline-only — no fill call
// at all, not just a near-invisible one. `fill: false` skips the canvas
// fill draw entirely (fillOpacity: 0 alone still issues the fill call at
// zero alpha), which matters here since this is the style applied to every
// visible parcel by default.
export const DEFAULT_STYLE = {
    color: '#3b82f6',
    weight: 1.5,
    opacity: 0.75,
    fill: false,
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
    fill: false,
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
