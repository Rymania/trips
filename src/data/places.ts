import type { LatLng } from '../domain/types';

export interface Place {
  label: string;
  location: LatLng;
}

/** Small offline gazetteer so location search works without a paid geocoder. */
export const PLACES: Place[] = [
  { label: 'London', location: { lat: 51.5074, lng: -0.1278 } },
  { label: 'Brighton', location: { lat: 50.8225, lng: -0.1372 } },
  { label: 'Oxford', location: { lat: 51.752, lng: -1.2577 } },
  { label: 'Cambridge', location: { lat: 52.2053, lng: 0.1218 } },
  { label: 'Reading', location: { lat: 51.4543, lng: -0.9781 } },
  { label: 'Guildford', location: { lat: 51.2362, lng: -0.5704 } },
  { label: 'Windsor', location: { lat: 51.4816, lng: -0.6044 } },
  { label: 'Richmond', location: { lat: 51.4613, lng: -0.3037 } },
  { label: 'Greenwich', location: { lat: 51.4826, lng: 0.0077 } },
  { label: 'Manchester', location: { lat: 53.4808, lng: -2.2426 } },
  { label: 'Birmingham', location: { lat: 52.4862, lng: -1.8904 } },
  { label: 'Bristol', location: { lat: 51.4545, lng: -2.5879 } },
];

/** Resolves free text (city name, "lat,lng" coordinates) to places. Postcodes need a geocoder source. */
export function searchPlaces(input: string): Place[] {
  const text = input.trim();
  if (!text) return [];
  const coords = /^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/.exec(text);
  if (coords) {
    const lat = Number(coords[1]);
    const lng = Number(coords[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180)
      return [{ label: `${lat}, ${lng}`, location: { lat, lng } }];
    return [];
  }
  const q = text.toLowerCase();
  return PLACES.filter((p) => p.label.toLowerCase().startsWith(q)).slice(0, 6);
}
