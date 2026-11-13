import type { BusVehicle } from './types';

export type PositionQuality = 'fresh' | 'stale' | 'expired' | 'unknown';
export function positionQuality(vehicle: BusVehicle, now = Date.now()): PositionQuality {
  const observed = vehicle.observedAt ? Date.parse(vehicle.observedAt) : NaN;
  if (!Number.isFinite(observed) || observed > now + 60000) return 'unknown';
  const age = Math.max(0, now - observed);
  return age <= 45000 ? 'fresh' : age <= 120000 ? 'stale' : 'expired';
}
export function positionAgeLabel(vehicle: BusVehicle, now = Date.now()): string {
  if (positionQuality(vehicle, now) === 'unknown') return 'Horário da posição não confirmado';
  const seconds = Math.max(0, Math.floor((now - Date.parse(vehicle.observedAt!)) / 1000));
  return seconds < 60 ? `Posição recebida há ${seconds}s` : `Posição recebida há ${Math.floor(seconds / 60)} min`;
}
export function isUsableRouteCache(entry: unknown, now = Date.now()): boolean {
  if (!entry || typeof entry !== 'object') return false;
  const cached = entry as { expiresAt?: number; data?: { route?: { routeId?: number }; trips?: unknown[] } };
  return typeof cached.expiresAt === 'number' && Number.isFinite(cached.expiresAt) && cached.expiresAt > now
    && Number.isSafeInteger(cached.data?.route?.routeId) && Array.isArray(cached.data?.trips);
}
