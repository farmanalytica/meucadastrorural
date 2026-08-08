// @ts-nocheck
// Ported from conformidaderural/src/lib/kmlExporter.js — no logic changes.

export function sanitizeDownloadStem(stem) {
  return String(stem || 'contorno')
    .trim()
    .replace(/[<>:"/\\|?* -]+/g, '_');
}

function geojsonRingToKmlCoords(ring) {
  return ring.map(([lng, lat]) => `${lng},${lat},0`).join(' ');
}

function geojsonPolygonToKml(coordinates) {
  const [outer, ...holes] = coordinates;
  let kml = `<Polygon><outerBoundaryIs><LinearRing><coordinates>${geojsonRingToKmlCoords(outer)}</coordinates></LinearRing></outerBoundaryIs>`;
  for (const hole of holes) {
    kml += `<innerBoundaryIs><LinearRing><coordinates>${geojsonRingToKmlCoords(hole)}</coordinates></LinearRing></innerBoundaryIs>`;
  }
  return `${kml}</Polygon>`;
}

function geojsonGeometryToKml(geometry) {
  if (!geometry) return '';
  if (geometry.type === 'Polygon') return geojsonPolygonToKml(geometry.coordinates);
  if (geometry.type === 'MultiPolygon') {
    const parts = geometry.coordinates.map((c) => geojsonPolygonToKml(c)).join('');
    return `<MultiGeometry>${parts}</MultiGeometry>`;
  }
  return '';
}

export function buildKml(geojson, name) {
  let geometry = null;
  if (geojson.type === 'Feature') {
    geometry = geojson.geometry;
  } else if (geojson.type === 'FeatureCollection') {
    const fs = geojson.features || [];
    if (fs.length === 1) geometry = fs[0].geometry;
    else if (fs.length > 1) {
      const parts = fs.map((f) => geojsonGeometryToKml(f.geometry)).join('');
      geometry = { _kml: `<MultiGeometry>${parts}</MultiGeometry>` };
    }
  } else {
    geometry = geojson;
  }
  const safeName = String(name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const geomKml = geometry && geometry._kml ? geometry._kml : geojsonGeometryToKml(geometry);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Placemark>\n    <name>${safeName}</name>\n    ${geomKml}\n  </Placemark>\n</kml>`;
}

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Triggers a KML download from a GeoJSON feature.
export function downloadKml(feature, name) {
  const kml = buildKml(feature, name);
  const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
  triggerDownload(blob, `${sanitizeDownloadStem(name)}.kml`);
}

// Triggers a GeoJSON download from a feature.
export function downloadGeoJson(feature, name) {
  const blob = new Blob([JSON.stringify(feature, null, 2)], { type: 'application/geo+json' });
  triggerDownload(blob, `${sanitizeDownloadStem(name)}.geojson`);
}

// Points KML (Field Guide): each sampling point becomes a numbered
// Placemark, ready to open in field GPS apps (Google Earth, Locus,
// Avenza) and walk to each mark.
function escapeKmlText(text) {
  return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildPointsKml(points, name) {
  const placemarks = points
    .map((p) => `<Placemark><name>${p.order}</name><Point><coordinates>${p.lon},${p.lat},0</coordinates></Point></Placemark>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n    <name>${escapeKmlText(name)}</name>\n    ${placemarks}\n  </Document>\n</kml>`;
}

export function downloadPointsKml(points, name) {
  const kml = buildPointsKml(points, name);
  const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
  triggerDownload(blob, `${sanitizeDownloadStem(name)}.kml`);
}

// Points GPX: named waypoints (FG001, FG002...) + one <rte> in the same
// order, for GPS navigation apps (Garmin, OsmAnd, Locus) that prefer GPX
// over KML.
export function buildPointsGpx(points, name) {
  const ordered = [...points].sort((a, b) => a.order - b.order);
  const stemName = (p) => `FG${String(p.order).padStart(3, '0')}`;
  const wpts = ordered
    .map((p) => `<wpt lat="${p.lat}" lon="${p.lon}"><name>${escapeKmlText(stemName(p))}</name></wpt>`)
    .join('');
  const rtepts = ordered
    .map((p) => `<rtept lat="${p.lat}" lon="${p.lon}"><name>${escapeKmlText(stemName(p))}</name></rtept>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="FARM Analytica" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata><name>${escapeKmlText(name)}</name></metadata>\n  ${wpts}\n  <rte><name>${escapeKmlText(name)}</name>${rtepts}</rte>\n</gpx>`;
}

export function downloadPointsGpx(points, name) {
  const gpx = buildPointsGpx(points, name);
  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  triggerDownload(blob, `${sanitizeDownloadStem(name)}.gpx`);
}

// Points CSV: plain order/lat/lon, for spreadsheets and importing into other
// field apps.
export function buildPointsCsv(points, name) {
  const ordered = [...points].sort((a, b) => a.order - b.order);
  const rows = ordered.map((p) => `${p.order},${p.lat},${p.lon}`);
  return `order,lat,lon\n${rows.join('\n')}\n`;
}

export function downloadPointsCsv(points, name) {
  const csv = buildPointsCsv(points, name);
  const blob = new Blob([csv], { type: 'text/csv' });
  triggerDownload(blob, `${sanitizeDownloadStem(name)}.csv`);
}

// Google Maps route: one "/maps/dir/lat,lon/lat,lon/..." link per leg of
// up to `maxStops` points — the Maps URL format accepts many points, but
// shorter legs open more reliably in the mobile app. Each leg repeats the
// previous leg's last point as its starting point, so the route stays
// continuous between legs.
export function buildGoogleMapsRouteUrls(points, maxStops = 10) {
  const ordered = [...points].sort((a, b) => a.order - b.order);
  if (ordered.length < 2) return [];
  const urls = [];
  let start = 0;
  while (start < ordered.length - 1) {
    const end = Math.min(start + maxStops, ordered.length);
    const chunk = ordered.slice(start, end);
    urls.push(`https://www.google.com/maps/dir/${chunk.map((p) => `${p.lat},${p.lon}`).join('/')}`);
    if (end >= ordered.length) break;
    start = end - 1;
  }
  return urls;
}
