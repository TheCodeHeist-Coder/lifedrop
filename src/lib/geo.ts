import { DELHI_NCR_PLACES, PLACES, type Place } from "./places";

export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// A box that fully contains the circle, so the database can do a cheap range scan
// before the exact distance check.
export function boundingBox(center: LatLng, radiusKm: number) {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.max(Math.cos(toRadians(center.lat)), 0.01));
  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };
}

const namesOf = (place: Place) => [place.name, ...(place.aliases ?? [])];

export function findPlaceByName(text: string): Place | null {
  const wanted = text.trim().toLowerCase();
  if (!wanted) return null;
  return PLACES.find((place) => namesOf(place).some((name) => name.toLowerCase() === wanted)) ?? null;
}

function findIn(places: Place[], text: string): Place | null {
  const candidates = places.flatMap((place) => namesOf(place).map((name) => ({ place, name })));
  candidates.sort((a, b) => b.name.length - a.name.length);
  for (const { place, name } of candidates) {
    const pattern = new RegExp(`\\b${name.replace(/\s+/g, "\\s+")}\\b`, name.length <= 3 ? "" : "i");
    if (pattern.test(text)) return place;
  }
  return null;
}

// The most specific known place mentioned in a block of text. Localities beat
// cities, so "Saket, New Delhi" centres the search on Saket. Within a list the
// longest name wins, so "Greater Noida" is not read as "Noida".
export function findPlaceInText(text: string): Place | null {
  return findIn(DELHI_NCR_PLACES, text) ?? findIn(PLACES, text);
}

// Known places first. Anything else goes to OpenStreetMap, so a request from a town
// that is not on the short list still works.
export async function geocode(text: string): Promise<LatLng | null> {
  const known = findPlaceByName(text);
  if (known) return { lat: known.lat, lng: known.lng };

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", text);
    url.searchParams.set("countrycodes", "in");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    const response = await fetch(url, {
      headers: { "User-Agent": "RaktDoot/0.1 (hackCBS 9.0 project)" },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    const [hit] = (await response.json()) as { lat: string; lon: string }[];
    return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
  } catch {
    return null;
  }
}
