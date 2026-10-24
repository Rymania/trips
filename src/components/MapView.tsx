import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import type { ActivityResult, Category, LatLng } from '../domain/types';
import { t } from '../i18n';

/** Icon glyph per category so type is never conveyed by colour alone. */
const GLYPH: Record<Category, string> = {
  Outdoor: '🌳',
  Sports: '⚽',
  Museums: '🏛',
  Entertainment: '🎡',
  'Food & Dining': '🍴',
  Shopping: '🛍',
  'Water Activities': '🌊',
  'Parks & Nature': '🌿',
  'Historical Sites': '🏰',
  Educational: '📚',
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

interface Props {
  results: ActivityResult[];
  origin: LatLng;
  onOpen: (id: string) => void;
}

export default function MapView({ results, origin, onOpen }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { keyboard: true }).setView([origin.lat, origin.lng], 10);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    const group = layer.current;
    if (!m || !group) return;
    group.clearLayers();
    const cluster = L.markerClusterGroup();
    results.forEach(({ activity: a }) => {
      const glyph = GLYPH[a.categories[0] ?? 'Outdoor'];
      const marker = L.marker([a.location.lat, a.location.lng], {
        title: a.name,
        alt: `${a.name}, ${a.categories.join(', ')}`,
        icon: L.divIcon({
          className: 'pin',
          html: `<span aria-hidden="true">${glyph}</span>`,
          iconSize: [32, 32],
        }),
      });
      const box = document.createElement('div');
      box.innerHTML = `<strong>${esc(a.name)}</strong><br>${esc(a.categories.join(', '))}<br>`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'link';
      btn.textContent = t.details;
      btn.onclick = () => onOpen(a.id);
      box.appendChild(btn);
      marker.bindPopup(box);
      cluster.addLayer(marker);
    });
    group.addLayer(cluster);
    const you = L.marker([origin.lat, origin.lng], {
      title: t.yourLocation,
      icon: L.divIcon({
        className: 'pin you',
        html: '<span aria-hidden="true">📍</span>',
        iconSize: [32, 32],
      }),
    });
    group.addLayer(you);
    const bounds = L.latLngBounds([
      [origin.lat, origin.lng],
      ...results.map((r) => [r.activity.location.lat, r.activity.location.lng] as [number, number]),
    ]);
    m.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
  }, [results, origin, onOpen]);

  return <div ref={el} className="map" role="region" aria-label={t.mapLabel} tabIndex={-1} />;
}
