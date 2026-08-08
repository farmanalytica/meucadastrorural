// Location lookup for the map search box: parse literal coordinates first, and
// fall back to address geocoding (OpenStreetMap Nominatim) when the text is not
// a coordinate pair.

export interface GeoPoint {
  lat: number
  lng: number
  /** Human-readable label when the point came from geocoding an address. */
  label?: string
}

function validLatLng(lat: number, lng: number): GeoPoint | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

/**
 * Parse "lat, lng" in decimal degrees or DMS. Accepts commas or whitespace as
 * separators and optional N/S/E/W (or Portuguese L/O) hemisphere suffixes, which
 * override sign. Returns null when the text is not a valid coordinate pair.
 */
export function parseCoords(text: string): GeoPoint | null {
  const cleaned = text.trim().replace(/\s+/g, ' ')
  if (!cleaned) return null

  // DMS: 16°40'48"S 49°15'00"W  (also accepts spaces / decimal seconds)
  const dms = /(\d+(?:\.\d+)?)[°\s]+(\d+(?:\.\d+)?)['′\s]+(\d+(?:\.\d+)?)["″]?\s*([NSLOEW])/gi
  const dmsMatches = [...cleaned.matchAll(dms)]
  if (dmsMatches.length === 2) {
    const toDeg = (m: RegExpMatchArray): number => {
      const deg = Number(m[1]) + Number(m[2]) / 60 + Number(m[3]) / 3600
      const hemi = m[4].toUpperCase()
      return hemi === 'S' || hemi === 'W' || hemi === 'O' ? -deg : deg
    }
    const a = toDeg(dmsMatches[0])
    const b = toDeg(dmsMatches[1])
    const aIsLat = /[NS]/i.test(dmsMatches[0][4])
    const [lat, lng] = aIsLat ? [a, b] : [b, a]
    return validLatLng(lat, lng)
  }

  // Decimal with hemisphere letters: "16.68 S, 49.25 W"
  const hemi = /(-?\d+(?:\.\d+)?)\s*([NSLOEW])/gi
  const hemiMatches = [...cleaned.matchAll(hemi)]
  if (hemiMatches.length === 2) {
    const toDeg = (m: RegExpMatchArray): number => {
      const v = Math.abs(Number(m[1]))
      const h = m[2].toUpperCase()
      return h === 'S' || h === 'W' || h === 'O' ? -v : v
    }
    const a = toDeg(hemiMatches[0])
    const b = toDeg(hemiMatches[1])
    const aIsLat = /[NS]/i.test(hemiMatches[0][2])
    const [lat, lng] = aIsLat ? [a, b] : [b, a]
    return validLatLng(lat, lng)
  }

  // Plain decimal pair: "-16.68, -49.25" or "-16.68 -49.25". Require an explicit
  // separator so a lone number or an address with digits is not misread.
  if (/^-?\d+(?:\.\d+)?\s*[, ]\s*-?\d+(?:\.\d+)?$/.test(cleaned)) {
    const nums = cleaned.match(/-?\d+(?:\.\d+)?/g)
    if (nums && nums.length === 2) return validLatLng(Number(nums[0]), Number(nums[1]))
  }
  return null
}

// A SICAR CAR code looks like "UF-9999999-<hex…>" (state prefix, IBGE municipio,
// long hash). Detect code-like input so the unified search can offer a CAR
// lookup instead of geocoding it as an address.
export function looksLikeCarCode(text: string): boolean {
  const t = text.trim()
  if (!t || /\s/.test(t)) return false
  return /^[A-Za-z]{2}-?\d/.test(t) || /[0-9a-fA-F]{16,}/.test(t)
}

export interface AddressSuggestion {
  label: string
  lat: number
  lng: number
}

// Photon (Komoot) is a free, key-less geocoder tuned for as-you-type search.
// Returns up to `limit` address suggestions, optionally biased toward a map
// centre. Errors bubble to the caller (the UI shows nothing on failure).
export async function autocompleteAddress(
  query: string,
  opts: { limit?: number; bias?: { lat: number; lng: number }; signal?: AbortSignal } = {},
): Promise<AddressSuggestion[]> {
  const q = query.trim()
  if (q.length < 3) return []
  const url = new URL('https://photon.komoot.io/api/')
  url.searchParams.set('q', q)
  url.searchParams.set('limit', String(opts.limit ?? 6))
  // Photon only supports default/en/de/fr; 'pt' returns 400. Use the default.
  if (opts.bias) {
    url.searchParams.set('lat', String(opts.bias.lat))
    url.searchParams.set('lon', String(opts.bias.lng))
  }
  const res = await fetch(url.toString(), { signal: opts.signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`autocomplete-failed-${res.status}`)
  const data = (await res.json()) as {
    features?: Array<{ geometry?: { coordinates?: [number, number] }; properties?: Record<string, unknown> }>
  }
  const out: AddressSuggestion[] = []
  for (const f of data.features ?? []) {
    const c = f.geometry?.coordinates
    const point = c && validLatLng(c[1], c[0])
    if (!point) continue
    out.push({ label: formatPhotonLabel(f.properties ?? {}), lat: point.lat, lng: point.lng })
  }
  return out
}

function formatPhotonLabel(p: Record<string, unknown>): string {
  const s = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : '')
  const head = [s('name') || s('street'), s('housenumber')].filter(Boolean).join(', ')
  const tail = [s('city') || s('county'), s('state')].filter(Boolean).join(' — ')
  return [head, tail].filter(Boolean).join(' · ') || s('name') || 'Local'
}

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
}

/**
 * Geocode a free-text address via OpenStreetMap Nominatim. Biased to Brazil.
 * Returns the best match or null when nothing is found. Throws on network error.
 */
export async function geocodeAddress(query: string): Promise<GeoPoint | null> {
  const q = query.trim()
  if (!q) return null
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'json')
  url.searchParams.set('q', q)
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'br')
  url.searchParams.set('addressdetails', '0')

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`geocode-failed-${res.status}`)
  const data = (await res.json()) as NominatimResult[]
  if (!Array.isArray(data) || data.length === 0) return null
  const point = validLatLng(Number(data[0].lat), Number(data[0].lon))
  return point ? { ...point, label: data[0].display_name } : null
}

/**
 * Resolve a search box query to a point: literal coordinates when parseable,
 * otherwise a geocoded address. Returns null when nothing resolves.
 */
export async function resolveLocation(query: string): Promise<GeoPoint | null> {
  const coords = parseCoords(query)
  if (coords) return coords
  return geocodeAddress(query)
}
