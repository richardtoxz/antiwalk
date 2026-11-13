import { fetchJson } from './http';
export interface Place { id?: string; name: string; lat: number; lng: number; kind?: 'bus' | 'metro' | 'address'; stationCode?: string; provider?: 'geoapify' }
export interface NetworkCoverage { state: string; indexed: number; total: number; failed: number; stale: boolean }
export interface JourneyLeg { mode: 'walk' | 'bus' | 'metro'; line?: string; routeId?: number | string; tripId?: number | string; directionId?: number;
  from: Place; to: Place; departureAt: string; arrivalAt: string; source: 'scheduled' | 'realtime' | 'estimated'; headsign?: string;
  distanceMeters?: number; waitMinutes?: number; tightConnection?: boolean; path: [number, number][];
  walkingRoute?: 'geoapify' | 'approximate'; steps?: { instruction: string; distanceMeters: number }[] }
export interface JourneyOption { id: string; durationMinutes: number; arrivalAt: string; transfers: number; walkMeters: number;
  baseFare: number | null; tightConnection: boolean; legs: JourneyLeg[] }
export interface JourneyResponse { options: JourneyOption[]; coverage: NetworkCoverage; notices: string[]; metroAvailable: boolean; calculatedAt: string; departureAt: string;
  walkingStatus?: 'disabled' | 'available' | 'routed' | 'partial' | 'limited' | 'unavailable' | 'approximate' }
export interface Arrival { line: string; routeId: number; tripId: number; headsign: string; source: 'realtime' | 'scheduled';
  arrivalAt: string; minutes: number; vehicleId?: string | number; observedAt?: string }
export interface ArrivalsResponse { arrivals: Arrival[]; realtimeStatus: string; notice: string; calculatedAt: string }
export function getPlaces(q: string, signal?: AbortSignal) {
  return fetchJson<{ places: Place[]; coverage: NetworkCoverage; addressSearch?: { status: 'disabled' | 'idle' | 'available' | 'limited' | 'unavailable' } }>(`/journeys/places?q=${encodeURIComponent(q)}`, { signal });
}
export function getLocationServices(signal?: AbortSignal) {
  return fetchJson<{ addresses: boolean; walking: boolean }>('/journeys/location-services', { signal });
}
export function getArrivals(stopId: number, routeId: number, signal?: AbortSignal) {
  return fetchJson<ArrivalsResponse>(`/stops/${stopId}/arrivals?routeId=${routeId}`, { signal, timeoutMs: 20000 });
}
export function getJourneys(origin: Place, destination: Place, maxWalkMeters: number, signal?: AbortSignal) {
  return fetchJson<JourneyResponse>('/journeys', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin, destination, maxWalkMeters }), signal, timeoutMs: 45000 });
}
export const localTime = (timestamp: string) => new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
