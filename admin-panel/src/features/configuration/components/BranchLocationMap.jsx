import { Component, useEffect, useRef, useState } from 'react'
import { ArrowUpRight, MapPin } from 'lucide-react'
import { Map, MapControls, MapMarker, MarkerContent, MarkerLabel, useMap } from '@/components/ui/map'
import StatusPill from '../../../components/workspace/StatusPill'
import { geocodeAddress } from '../geocode'

const LOOKUP_DELAY_MS = 1200

// mapcn throws while rendering when the map cannot start (no WebGL, blocked scripts); keep the rest of the form usable.
class MapBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="status" className="mt-3 flex h-56 items-center justify-center rounded-md border border-slate-200 bg-surface-low p-4 text-center text-xs text-on-surface-variant">
        The map could not load. You can still create the branch from the address above.
      </div>
    )
  }
}

// Child of <Map>: turns map clicks into placed pins and glides the view to the pin when it moves.
function PinInteractions({ value, onPlace }) {
  const { map, isLoaded } = useMap()
  const onPlaceRef = useRef(onPlace)
  useEffect(() => {
    onPlaceRef.current = onPlace
  })

  useEffect(() => {
    if (!map || !isLoaded) return undefined
    const handleClick = (event) => onPlaceRef.current({ lat: event.lngLat.lat, lng: event.lngLat.lng })
    map.on('click', handleClick)
    return () => map.off('click', handleClick)
  }, [map, isLoaded])

  const lat = value?.lat
  const lng = value?.lng
  useEffect(() => {
    if (map && isLoaded && lat !== undefined) map.easeTo({ center: [lng, lat], zoom: 15, duration: 800 })
  }, [map, isLoaded, lat, lng])

  return null
}

const formatCoordinates = ({ lat, lng }) => `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`

// Map card for picking a location. `value` is { lat, lng } or null. The pin follows `queries` (address strings,
// most specific first) until the user places or drags it themselves; after that their pin is never overwritten.
export default function BranchLocationMap({ value, onChange, address, queries = [] }) {
  const [lookup, setLookup] = useState('idle')
  const placedByUser = useRef(false)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })
  const queryKey = JSON.stringify(queries)

  useEffect(() => {
    const list = JSON.parse(queryKey)
    if (placedByUser.current || list.length === 0) return undefined
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLookup('searching')
      try {
        const found = await geocodeAddress(list, controller.signal)
        if (controller.signal.aborted || placedByUser.current) return
        if (found) onChangeRef.current(found)
        setLookup(found ? 'found' : 'missing')
      } catch (error) {
        if (error.name !== 'AbortError') setLookup('error')
      }
    }, LOOKUP_DELAY_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [queryKey])

  const place = ({ lat, lng }) => {
    placedByUser.current = true
    setLookup('idle')
    onChange({ lat, lng })
  }
  const note = {
    searching: 'Finding this address on the map…',
    found: 'Pin placed from the address. Drag it to the exact entrance if needed.',
    missing: 'We could not find this address. Click the map to drop the pin yourself.',
    error: 'Address lookup is unavailable right now. Click the map to drop the pin yourself.',
  }[lookup] ?? 'Enter the address and the pin is placed for you, or click the map to drop it yourself.'

  const searchUrl = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-on-surface">Map view</h3>
          <p className="mt-0.5 text-xs leading-4 text-on-surface-variant">
            {address || 'Enter the address above to locate it.'}
            {value && ` · ${formatCoordinates(value)}`}
          </p>
        </div>
        <StatusPill tone={value ? 'success' : 'neutral'}>{value ? 'Draft pin' : 'No pin yet'}</StatusPill>
      </div>

      <MapBoundary>
        <Map className="mt-3 h-56 overflow-hidden rounded-md border border-slate-200" theme="light" center={[78.9629, 20.5937]} zoom={4}>
          <PinInteractions value={value} onPlace={place} />
          {value && (
            <MapMarker longitude={value.lng} latitude={value.lat} draggable onDragEnd={({ lat, lng }) => place({ lat, lng })}>
              <MarkerContent>
                <span className="block size-4 rounded-full border-2 border-white bg-brand shadow-md" />
                <MarkerLabel position="bottom">Branch pin</MarkerLabel>
              </MarkerContent>
            </MapMarker>
          )}
          <MapControls position="top-right" />
        </Map>
      </MapBoundary>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs text-on-surface-variant">
          <MapPin className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
          {note} The pin is a draft and is not saved with the branch yet.
        </p>
        {searchUrl && (
          <a
            href={searchUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 px-3 text-xs font-semibold text-brand hover:bg-surface-lowest"
          >
            Verify location
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  )
}
