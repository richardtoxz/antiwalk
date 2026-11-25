// Shared rides: a passenger says which bus they are on and gets a link that follows that bus
// by its own GPS. Everything here works without the network, so it can be tested alone.
import { snapToRoute, type LngLat } from "../map/vehicle-motion.ts";
import { positionAgeLabel, positionQuality } from "./quality.ts";
import type { BusVehicle } from "./types";

export type RideEndReason = "owner" | "arrived" | "trip-finished" | "signal-lost" | "expired";

export interface RideStop {
  stopId: number;
  name: string;
  lat: number;
  lng: number;
}

export interface Ride {
  status: "active" | "ended";
  endedReason: RideEndReason | null;
  endedAt: string | null;
  line: string;
  routeName: string;
  color: string | null;
  textColor: string | null;
  vehicleId: string;
  headsign: string;
  position: { lat: number; lng: number; observedAt: string | null; source: string } | null;
  alightStop: RideStop | null;
  arrivalAt: string | null;
  remainingMeters: number | null;
  offRoute: boolean;
  createdAt: string;
  expiresAt: string;
  updatedAt: string;
}

export interface RideTrip {
  /** Drawn shape as [lat, lng], like route details. */
  coordinates: [number, number][];
  stops: RideStop[];
}

export interface RideDetails {
  ride: Ride;
  trip: RideTrip;
}

export interface StartedRide extends RideDetails {
  shareToken: string;
  ownerToken: string;
}

export const RIDE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

/** Address of the page that follows a ride. */
export function rideLink(shareToken: string, origin: string): string {
  return `${origin}/viagem/${shareToken}`;
}

/** The ride this device shares, kept so it can still be followed and ended after a reload. */
export interface OwnRide {
  shareToken: string;
  ownerToken: string;
  line: string;
  directionId: number;
  vehicleId: string;
}

export function parseOwnRide(raw: string | null): OwnRide | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<OwnRide>;
    if (!RIDE_TOKEN_PATTERN.test(String(value.shareToken)) || !RIDE_TOKEN_PATTERN.test(String(value.ownerToken))) return null;
    if (typeof value.line !== "string" || typeof value.vehicleId !== "string") return null;
    return {
      shareToken: value.shareToken!, ownerToken: value.ownerToken!, line: value.line, vehicleId: value.vehicleId,
      directionId: Number.isInteger(value.directionId) ? value.directionId! : 0,
    };
  } catch {
    return null;
  }
}

const OWN_RIDE_KEY = "antiwalk-own-ride";
const OWN_RIDE_EVENT = "antiwalk-own-ride-change";
// Where the ride is kept when the browser refuses storage (some private windows).
let memoryRide: OwnRide | null = null;
let storageWorks = true;
let ownCache: { raw: string | null; ride: OwnRide | null } = { raw: null, ride: null };

/** Same object until the stored value changes, as useSyncExternalStore requires. */
export function readOwnRide(): OwnRide | null {
  if (!storageWorks) return memoryRide;
  let raw: string | null;
  try { raw = localStorage.getItem(OWN_RIDE_KEY); } catch { return memoryRide; }
  if (raw !== ownCache.raw) ownCache = { raw, ride: parseOwnRide(raw) };
  return ownCache.ride;
}

export const readOwnRideOnServer = (): OwnRide | null => null;

export function saveOwnRide(ride: OwnRide | null) {
  memoryRide = ride;
  try {
    if (ride) localStorage.setItem(OWN_RIDE_KEY, JSON.stringify(ride));
    else localStorage.removeItem(OWN_RIDE_KEY);
    storageWorks = true;
  } catch {
    storageWorks = false;
  }
  window.dispatchEvent(new Event(OWN_RIDE_EVENT));
}

export function subscribeOwnRide(notify: () => void) {
  window.addEventListener(OWN_RIDE_EVENT, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(OWN_RIDE_EVENT, notify);
    window.removeEventListener("storage", notify);
  };
}

/**
 * Stops still ahead of the bus on the line it runs ([lng, lat]), in trip order. Stops are
 * placed walking forward, so the last stop of a loop is not taken for its first. When the
 * bus is off the line every stop is offered and the server decides.
 */
export function stopsAhead(line: LngLat[], stops: RideStop[], bus: LngLat): RideStop[] {
  const busAt = snapToRoute(line, bus, { maxMeters: 100 });
  if (!busAt) return stops;
  const ahead: RideStop[] = [];
  let previous: number | undefined;
  for (const stop of stops) {
    const at = snapToRoute(line, [stop.lng, stop.lat], { maxMeters: 80, previousAlong: previous });
    if (!at) continue;
    previous = at.along;
    if (at.along > busAt.along + 30) ahead.push(stop);
  }
  return ahead;
}

const clock = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/** Whole minutes until the forecast arrival (at least 0), or null without a forecast. */
export function minutesUntil(arrivalAt: string | null, now: number): number | null {
  const at = arrivalAt ? Date.parse(arrivalAt) : NaN;
  return Number.isFinite(at) ? Math.max(0, Math.ceil((at - now) / 60000)) : null;
}

export function endedText(ride: Ride): string {
  switch (ride.endedReason) {
    case "arrived": return ride.alightStop ? `Chegou em ${ride.alightStop.name}` : "Chegou ao destino";
    case "trip-finished": return "O ônibus terminou a viagem";
    case "signal-lost": return "O GPS do ônibus parou de responder";
    case "expired": return "O compartilhamento passou de 3 horas e terminou";
    default: return "A viagem foi encerrada por quem compartilhou";
  }
}

/** Main line of a ride's status: where it goes and when it gets there. */
export function rideHeadline(ride: Ride, now: number): string {
  if (ride.status === "ended") return endedText(ride);
  if (!ride.alightStop) return `Sentido ${ride.headsign}`;
  const minutes = minutesUntil(ride.arrivalAt, now);
  if (minutes === null) return `A caminho de ${ride.alightStop.name}`;
  if (minutes <= 1) return `Chegando em ${ride.alightStop.name}`;
  return `Chega em ${ride.alightStop.name} em ${minutes} min, por volta de ${clock.format(Date.parse(ride.arrivalAt!))}`;
}

/** A warning about the position, or null while it is fresh. */
export function ridePositionNote(ride: Ride, now: number): string | null {
  if (ride.status !== "active") return null;
  if (!ride.position) return "Aguardando a posição do ônibus.";
  if (ride.offRoute) return "O ônibus está fora do trajeto previsto, então não há previsão agora.";
  const vehicle = { observedAt: ride.position.observedAt } as BusVehicle;
  return positionQuality(vehicle, now) === "fresh" ? null : `${positionAgeLabel(vehicle, now)}.`;
}

/** "faltam 2,1 km" or "faltam 350 m" to the stop, or null without one. */
export function remainingText(meters: number | null): string | null {
  if (meters === null || !Number.isFinite(meters)) return null;
  if (meters >= 1000) return `faltam ${(meters / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
  return `faltam ${Math.max(10, Math.round(meters / 10) * 10)} m`;
}

export function rideShareText(ride: Pick<Ride, "line" | "vehicleId" | "alightStop">): string {
  const destination = ride.alightStop ? `, indo para ${ride.alightStop.name}` : "";
  return `Estou no ônibus ${ride.line} (veículo ${ride.vehicleId})${destination}. Acompanhe por aqui:`;
}
