// Address -> coordinates through OpenStreetMap Nominatim (free, no key). Its usage policy allows about one request
// a second, so callers debounce. Each query is tried in turn, most specific first, and the first hit wins.
const ENDPOINT = 'https://nominatim.openstreetmap.org/search'

async function lookup(query, signal) {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '1', countrycodes: 'in' })
  const response = await fetch(`${ENDPOINT}?${params}`, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Geocoding failed (${response.status})`)
  const [hit] = await response.json()
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null
}

export async function geocodeAddress(queries, signal) {
  for (const query of queries) {
    const found = await lookup(query, signal)
    if (found) return found
  }
  return null
}
