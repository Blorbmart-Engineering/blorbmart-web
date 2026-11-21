/* ═══════════════════════════════════════════════════════════════════════
   Live rider map — where the rider is right now, and where they are going.

   The position comes from order.tracking, which the backend rewrites on
   every rider heartbeat (about every 20s while a trip is on). Nothing here
   polls: the tracking page already streams the order document, so a new
   position arrives as a new prop. The ETA beside it is worked out by the
   backend with Google's Routes API.

   The map is Google Maps' street map, from the same /api/geo/config every
   pin picker uses (Google Map Tiles when the backend has a key, Esri when
   it has not), drawn by Leaflet, which the pin picker already ships.

   Twenty seconds between fixes would make the marker jump, so each new fix
   is glided to over a second and a half. That is presentation only — the
   marker never goes anywhere the rider has not actually reported being.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { LocateFixed } from 'lucide-react'
import { loadMapConfig } from './PinPicker'
import type { LatLng } from '../models/order'

const GLIDE_MS = 1500
const FIT_PADDING = 56

const RIDER_SVG =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>'

const HOME_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>'

const riderIcon = L.divIcon({
  className: 'blorb-map-icon',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  // The halo sits before the disc in the DOM so the disc paints over it.
  html:
    '<div aria-label="Your rider" style="position:relative;width:40px;height:40px">' +
    '<span class="blorb-rider-halo"></span>' +
    '<span style="position:absolute;inset:0;display:grid;place-items:center;' +
    'border-radius:50%;background:var(--color-brand);border:3px solid #fff;' +
    `box-shadow:0 4px 14px rgba(31,119,241,0.45)">${RIDER_SVG}</span></div>`,
})

const destinationIcon = L.divIcon({
  className: 'blorb-map-icon',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  html:
    '<div aria-label="Your delivery address" style="display:grid;place-items:center;width:32px;height:32px;' +
    'border-radius:50%;background:var(--color-appetite);border:3px solid #fff;' +
    `box-shadow:0 4px 12px rgba(255,90,31,0.4)">${HOME_SVG}</div>`,
})

/** Smoothstep, so the glide eases in and out instead of sliding robotically. */
const ease = (t: number) => t * t * (3 - 2 * t)

export default function LiveRiderMap({
  rider,
  destination,
  height = 240,
}: {
  rider: LatLng
  destination: LatLng | null
  height?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const riderMarkerRef = useRef<L.Marker | null>(null)
  const destMarkerRef = useRef<L.Marker | null>(null)
  const glideRef = useRef<number | null>(null)
  const [ready, setReady] = useState(false)

  /**
   * Once the customer pans or zooms, the map stops re-framing itself on
   * every fix — yanking the camera back mid-gesture is the fastest way to
   * make a map feel broken. The recenter button hands control back. State
   * drives the button; the ref is what the map's own callbacks read.
   */
  const [following, setFollowingState] = useState(true)
  const followingRef = useRef(true)
  const setFollowing = (value: boolean) => {
    followingRef.current = value
    setFollowingState(value)
  }

  // What the map frames once its config arrives — a newer position may
  // already have come in by then.
  const latest = useRef({ rider, destination })
  useEffect(() => {
    latest.current = { rider, destination }
  })

  // ── Create the map once ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    let resizeObs: ResizeObserver | null = null
    void loadMapConfig().then((cfg) => {
      const box = containerRef.current
      if (cancelled || !box) return
      const { rider: r, destination: d } = latest.current
      const map = L.map(box, {
        center: [r.lat, r.lng],
        zoom: 15,
        maxZoom: cfg.maxZoom,
        zoomControl: false,
        attributionControl: true,
        // A one-finger drag on a phone should scroll the page, not the map:
        // on phones panning starts after a tap; pinch-zoom always works.
        dragging: !L.Browser.mobile,
        scrollWheelZoom: false,
      })
      map.attributionControl.setPrefix(false)
      const layer = cfg.layers.streets
      const common = { maxZoom: cfg.maxZoom, maxNativeZoom: layer.maxNativeZoom }
      L.tileLayer(layer.url, { ...common, attribution: layer.attribution }).addTo(map)
      layer.overlays.forEach((url, i) => L.tileLayer(url, { ...common, zIndex: 2 + i }).addTo(map))

      // Only a person's drag or zoom stops following; frame() marks the
      // moves it makes itself so they do not count.
      const byPerson = () => {
        if (!selfMoves.has(map)) setFollowing(false)
      }
      map.on('dragstart', byPerson)
      map.on('zoomstart', byPerson)
      map.on('click', () => map.dragging.enable())

      riderMarkerRef.current = L.marker([r.lat, r.lng], { icon: riderIcon, keyboard: false, zIndexOffset: 1000 }).addTo(map)
      if (d) destMarkerRef.current = L.marker([d.lat, d.lng], { icon: destinationIcon, keyboard: false }).addTo(map)

      mapRef.current = map
      frame(map, r, d, false)
      if (typeof ResizeObserver !== 'undefined') {
        resizeObs = new ResizeObserver(() => map.invalidateSize())
        resizeObs.observe(box)
      }
      setReady(true)
    })

    return () => {
      cancelled = true
      resizeObs?.disconnect()
      if (glideRef.current) cancelAnimationFrame(glideRef.current)
      mapRef.current?.remove()
      mapRef.current = null
      riderMarkerRef.current = null
      destMarkerRef.current = null
    }
  }, [])

  // ── Destination pin ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!destination) {
      destMarkerRef.current?.remove()
      destMarkerRef.current = null
      return
    }
    if (!destMarkerRef.current) {
      destMarkerRef.current = L.marker([destination.lat, destination.lng], { icon: destinationIcon, keyboard: false }).addTo(map)
    } else {
      destMarkerRef.current.setLatLng([destination.lat, destination.lng])
    }
  }, [ready, destination?.lat, destination?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Glide the rider to each new fix ───────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    const marker = riderMarkerRef.current
    if (!map || !marker) return

    const from = marker.getLatLng()
    const to = { lng: rider.lng, lat: rider.lat }
    if (from.lng === to.lng && from.lat === to.lat) return

    if (glideRef.current) cancelAnimationFrame(glideRef.current)
    const start = performance.now()
    const step = (t: number) => {
      const k = ease(Math.min(1, (t - start) / GLIDE_MS))
      marker.setLatLng([from.lat + (to.lat - from.lat) * k, from.lng + (to.lng - from.lng) * k])
      if (k < 1) glideRef.current = requestAnimationFrame(step)
      else glideRef.current = null
    }
    glideRef.current = requestAnimationFrame(step)

    if (followingRef.current) frame(map, rider, destination, true)
  }, [rider.lat, rider.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        position: 'relative',
        height,
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        border: '1px solid var(--color-line)',
        boxShadow: 'var(--shadow-sm)',
        background: 'var(--color-surface)',
        isolation: 'isolate',
      }}
    >
      <style>{`
        .blorb-map-icon { background: none; border: 0; }
        .blorb-rider-halo {
          position: absolute; inset: -3px; border-radius: 50%;
          background: rgba(31,119,241,0.35);
          animation: blorb-rider-halo 2s ease-out infinite;
        }
        @keyframes blorb-rider-halo {
          from { transform: scale(1); opacity: 0.9; }
          to   { transform: scale(2.4); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .blorb-rider-halo { animation: none; opacity: 0; }
        }
        .blorb-live-map .leaflet-control-attribution { font-size: 9.5px; background: rgba(255,255,255,.75); }
      `}</style>

      <div ref={containerRef} className="blorb-live-map" style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

      {!following && (
        <button
          type="button"
          onClick={() => {
            setFollowing(true)
            if (mapRef.current) frame(mapRef.current, rider, destination, true)
          }}
          aria-label="Recenter on rider"
          style={{
            position: 'absolute',
            right: 10,
            bottom: 10,
            zIndex: 500,
            display: 'grid',
            placeItems: 'center',
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '1px solid var(--color-line)',
            background: '#fff',
            color: 'var(--color-brand)',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
          }}
        >
          <LocateFixed size={19} aria-hidden />
        </button>
      )}
    </div>
  )
}

/** Maps in the middle of a move frame() started, so it is not taken for a gesture. */
const selfMoves = new WeakSet<L.Map>()

/** Frames the rider and the drop-off together, or just the rider. */
function frame(map: L.Map, rider: LatLng, destination: LatLng | null, animate: boolean) {
  selfMoves.add(map)
  map.once('moveend', () => selfMoves.delete(map))
  // A move to where the map already is fires no moveend; clear it anyway.
  window.setTimeout(() => selfMoves.delete(map), animate ? 1200 : 50)
  if (!destination) {
    map.setView([rider.lat, rider.lng], Math.max(map.getZoom(), 15), { animate })
    return
  }
  map.fitBounds(
    L.latLngBounds([rider.lat, rider.lng], [destination.lat, destination.lng]),
    { padding: [FIT_PADDING, FIT_PADDING], maxZoom: 16, animate },
  )
}
