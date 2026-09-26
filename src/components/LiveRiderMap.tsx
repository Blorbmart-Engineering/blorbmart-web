/* ═══════════════════════════════════════════════════════════════════════
   Live rider map — where the rider is right now, and where they are going.

   The position comes from order.tracking, which the backend rewrites on
   every rider heartbeat (about every 20s while a trip is on). Nothing here
   polls: the tracking page already streams the order document, so a new
   position arrives as a new prop.

   Twenty seconds between fixes would make the marker jump, so each new fix
   is glided to over a second and a half. That is presentation only — the
   marker never goes anywhere the rider has not actually reported being.

   Loaded lazily by TrackOrder: mapbox-gl is heavy, and nobody should pay for
   it before a rider is actually on the road.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { LocateFixed } from 'lucide-react'
import { MAPBOX_TOKEN } from '../lib/config'
import type { LatLng } from '../models/order'

const GLIDE_MS = 1500
const FIT_PADDING = 56

const RIDER_SVG =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>'

const HOME_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>'

function riderElement(): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('aria-label', 'Your rider')
  el.style.cssText = 'position:relative;width:40px;height:40px'
  // The halo sits before the disc in the DOM so the disc paints over it.
  el.innerHTML =
    '<span class="blorb-rider-halo"></span>' +
    '<span style="position:absolute;inset:0;display:grid;place-items:center;' +
    'border-radius:50%;background:var(--color-brand);border:3px solid #fff;' +
    `box-shadow:0 4px 14px rgba(31,119,241,0.45)">${RIDER_SVG}</span>`
  return el
}

function destinationElement(): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('aria-label', 'Your delivery address')
  el.style.cssText = [
    'display:grid',
    'place-items:center',
    'width:32px',
    'height:32px',
    'border-radius:50%',
    'background:var(--color-appetite)',
    'border:3px solid #fff',
    'box-shadow:0 4px 12px rgba(255,90,31,0.4)',
  ].join(';')
  el.innerHTML = HOME_SVG
  return el
}

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
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const riderMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const destMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const glideRef = useRef<number | null>(null)

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
  const [failed, setFailed] = useState(false)

  // What the map's 'load' callback frames — it fires after mount, by which
  // time a newer position may already have arrived.
  const latest = useRef({ rider, destination })
  useEffect(() => {
    latest.current = { rider, destination }
  })

  // ── Create the map once ───────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN) return

    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [rider.lng, rider.lat],
      zoom: 14.5,
      attributionControl: false,
      // A one-finger drag on a phone should scroll the page, not the map.
      cooperativeGestures: true,
      pitchWithRotate: false,
      dragRotate: false,
    })
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left')

    // Only a person's gesture carries an originalEvent; our own fitBounds
    // and easeTo calls do not, and must not switch following off.
    const stopFollowing = (e: object) => {
      if ('originalEvent' in e && e.originalEvent) setFollowing(false)
    }
    map.on('dragstart', stopFollowing)
    map.on('zoomstart', stopFollowing)

    map.on('error', (e) => {
      // A bad or URL-restricted token fails the style load. Drop the map
      // rather than show a grey rectangle; the ETA card still says it all.
      const status = (e.error as { status?: number } | undefined)?.status
      if (status === 401 || status === 403) setFailed(true)
    })

    riderMarkerRef.current = new mapboxgl.Marker({ element: riderElement() })
      .setLngLat([rider.lng, rider.lat])
      .addTo(map)

    mapRef.current = map
    map.once('load', () => frame(map, latest.current.rider, latest.current.destination, false))

    return () => {
      if (glideRef.current) cancelAnimationFrame(glideRef.current)
      map.remove()
      mapRef.current = null
      riderMarkerRef.current = null
      destMarkerRef.current = null
    }
    // The map is built once; later positions arrive through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      destMarkerRef.current = new mapboxgl.Marker({ element: destinationElement() })
        .setLngLat([destination.lng, destination.lat])
        .addTo(map)
    } else {
      destMarkerRef.current.setLngLat([destination.lng, destination.lat])
    }
  }, [destination?.lat, destination?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Glide the rider to each new fix ───────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    const marker = riderMarkerRef.current
    if (!map || !marker) return

    const from = marker.getLngLat()
    const to = { lng: rider.lng, lat: rider.lat }
    if (from.lng === to.lng && from.lat === to.lat) return

    if (glideRef.current) cancelAnimationFrame(glideRef.current)
    const start = performance.now()
    const step = (t: number) => {
      const k = ease(Math.min(1, (t - start) / GLIDE_MS))
      marker.setLngLat([from.lng + (to.lng - from.lng) * k, from.lat + (to.lat - from.lat) * k])
      if (k < 1) glideRef.current = requestAnimationFrame(step)
      else glideRef.current = null
    }
    glideRef.current = requestAnimationFrame(step)

    if (followingRef.current) frame(map, rider, destination, true)
  }, [rider.lat, rider.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!MAPBOX_TOKEN || failed) return null

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
      }}
    >
      <style>{`
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
      `}</style>

      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

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

/** Frames the rider and the drop-off together, or just the rider. */
function frame(map: mapboxgl.Map, rider: LatLng, destination: LatLng | null, animate: boolean) {
  if (!destination) {
    map.easeTo({ center: [rider.lng, rider.lat], duration: animate ? 800 : 0 })
    return
  }
  const bounds = new mapboxgl.LngLatBounds([rider.lng, rider.lat], [rider.lng, rider.lat])
  bounds.extend([destination.lng, destination.lat])
  map.fitBounds(bounds, {
    padding: FIT_PADDING,
    maxZoom: 16,
    duration: animate ? 800 : 0,
  })
}
