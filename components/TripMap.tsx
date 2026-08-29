'use client';

import { useEffect, useRef } from 'react';
import type { Itinerary, Variant } from '@/lib/types';
import { pickFor } from '@/lib/types';
import 'leaflet/dist/leaflet.css';

/**
 * Leaflet map of the route. Client-only (Leaflet touches `window` at import),
 * so it is loaded via next/dynamic with ssr disabled.
 */
export default function TripMap({
  itinerary,
  variant,
  picks,
}: {
  itinerary: Itinerary;
  variant: Variant;
  picks: Record<string, string>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    const el = ref.current;
    if (!el) return;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !ref.current) return;

      // Guard against a double-init from React strict mode.
      if (mapRef.current) return;

      const map = L.map(el, { scrollWheelZoom: true });
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 18,
      }).addTo(map);

      const bounds: [number, number][] = [];

      const dot = (color: string, size = 14) =>
        L.divIcon({
          className: '',
          html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25)"></div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

      const route = itinerary.places.filter((p) => p.kind === 'route' && p.lat != null);
      const trips = itinerary.places.filter((p) => p.kind === 'daytrip' && p.lat != null);

      for (const p of route) {
        const ll: [number, number] = [p.lat!, p.lng!];
        bounds.push(ll);
        L.marker(ll, { icon: dot('#2383e2', 16) })
          .addTo(map)
          .bindPopup(
            `<b>${p.name}</b>${p.mode ? `<br><span style="color:#787774">${p.mode}</span>` : ''}${
              p.blurb ? `<br>${p.blurb}` : ''
            }`
          );
      }

      for (const p of trips) {
        const ll: [number, number] = [p.lat!, p.lng!];
        bounds.push(ll);
        L.marker(ll, { icon: dot('#9b9a97', 11) })
          .addTo(map)
          .bindPopup(`<b>${p.name}</b>${p.blurb ? `<br>${p.blurb}` : ''}`);
      }

      // Chosen accommodation, where we have coordinates for it.
      for (const stay of variant.stays) {
        const pick = pickFor(stay, picks);
        if (pick?.lat != null && pick.lng != null) {
          const ll: [number, number] = [pick.lat, pick.lng];
          bounds.push(ll);
          L.marker(ll, { icon: dot('#0f7a3d', 13) })
            .addTo(map)
            .bindPopup(`<b>${pick.name}</b><br><span style="color:#787774">${stay.city}</span>`);
        }
      }

      if (route.length > 1) {
        L.polyline(
          route.map((p) => [p.lat!, p.lng!] as [number, number]),
          { color: '#2383e2', weight: 2, opacity: 0.6, dashArray: '5,6' }
        ).addTo(map);
      }

      if (bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 9 });
      else map.setView([52.3676, 4.9041], 4);

      setTimeout(() => map.invalidateSize(), 0);
    })();

    return () => {
      cancelled = true;
      const m = mapRef.current as { remove?: () => void } | null;
      if (m?.remove) m.remove();
      mapRef.current = null;
    };
  }, [itinerary, variant, picks]);

  return <div className="mapbox" ref={ref} />;
}
