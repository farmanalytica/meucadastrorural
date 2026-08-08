// Minimal geographic helpers for the Map page.

type Geometry = {
  type: string
  coordinates?: any
}

// Approximate area (ha) of a Polygon/MultiPolygon geometry,
// equirectangular projection at the centroid. Ported from conformidaderural/src/lib/geo.js.
function ringAreaHa(ring: number[][]): number {
  if (!ring || ring.length < 4) return 0
  const R = 6378137
  const lat0 = (ring.reduce((s, p) => s + p[1], 0) / ring.length) * (Math.PI / 180)
  const cos = Math.cos(lat0)
  let area = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[i + 1]
    const X1 = ((x1 * Math.PI) / 180) * R * cos
    const Y1 = ((y1 * Math.PI) / 180) * R
    const X2 = ((x2 * Math.PI) / 180) * R * cos
    const Y2 = ((y2 * Math.PI) / 180) * R
    area += X1 * Y2 - X2 * Y1
  }
  return Math.abs(area / 2) / 10000
}

export function polygonAreaHa(geometry: Geometry | null | undefined): number {
  if (!geometry) return 0
  if (geometry.type === 'Polygon') {
    return ringAreaHa(geometry.coordinates?.[0])
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates || []).reduce(
      (sum: number, poly: number[][][]) => sum + ringAreaHa(poly?.[0]),
      0,
    )
  }
  return 0
}

// Ray-casting: is the point inside the ring? lng/lat in degrees; ring = [[lng,lat],...].
function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

// Point inside the geometry (respects holes). Polygon/MultiPolygon.
export function pointInPolygonGeom(
  lng: number,
  lat: number,
  geometry: Geometry | null | undefined,
): boolean {
  if (!geometry) return false
  const polys: number[][][][] =
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates
        : []
  for (const poly of polys) {
    if (!poly || !poly.length) continue
    if (!pointInRing(lng, lat, poly[0])) continue
    let inHole = false
    for (let h = 1; h < poly.length; h++) {
      if (pointInRing(lng, lat, poly[h])) {
        inHole = true
        break
      }
    }
    if (!inHole) return true
  }
  return false
}

// Extract bounds [minLng, minLat, maxLng, maxLat] from geometry without GeoJSON parsing overhead.
function extractCoordinates(coords: any[]): Array<[number, number]> {
  const result: Array<[number, number]> = []
  function walk(c: any): void {
    if (!c) return
    if (typeof c[0] === 'number') {
      result.push([c[0], c[1]])
    } else {
      for (const item of c) walk(item)
    }
  }
  walk(coords)
  return result
}

export function geometryBounds(
  geometry: Geometry | null | undefined,
): [number, number, number, number] | null {
  if (!geometry?.coordinates) return null
  const coords = extractCoordinates(geometry.coordinates)
  if (!coords.length) return null
  let minLng = coords[0][0],
    minLat = coords[0][1],
    maxLng = coords[0][0],
    maxLat = coords[0][1]
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  return [minLng, minLat, maxLng, maxLat]
}

const NUM = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
export const fmtNum = (n: number): string => NUM.format(n || 0)
