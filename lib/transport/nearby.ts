import { fetchJson } from "./http";

export interface NearbyPlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: "bus" | "metro" | string;
  stopId?: number;
  stationCode?: string;
  distanceMeters: number;
  lines: string[];
}

/** Bus stops and metro stations around a point, closest first. */
export function getNearbyPlaces(lat: number, lng: number, signal?: AbortSignal) {
  const query = new URLSearchParams({ lat: lat.toFixed(5), lng: lng.toFixed(5), radius: "700", limit: "8", kinds: "bus,metro" });
  return fetchJson<{ places: NearbyPlace[] }>(`/places/nearby?${query}`, { signal });
}

/** Walking time at about 80 m per minute, the usual estimate for city walking. */
export function walkingLabel(meters: number): string {
  if (meters < 60) return "aqui perto";
  const minutes = Math.max(1, Math.round(meters / 80));
  return `${minutes} min a pé`;
}
