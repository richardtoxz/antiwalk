import { BACKEND_BASE_URL } from "./config";
import { fetchJson, HttpError } from "./http";
import type { Ride, RideDetails, StartedRide } from "./rides";

export interface RideStart {
  routeId: number;
  tripId: number;
  vehicleId: string;
  alightStopId: number | null;
}

export function startRide(start: RideStart): Promise<StartedRide> {
  return fetchJson<StartedRide>("/rides", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(start),
    timeoutMs: 20000,
  });
}

export function getRide(shareToken: string): Promise<RideDetails> {
  return fetchJson<RideDetails>(`/rides/${encodeURIComponent(shareToken)}`);
}

export function endRide(shareToken: string, ownerToken: string): Promise<{ ride: Ride }> {
  return fetchJson<{ ride: Ride }>(`/rides/${encodeURIComponent(shareToken)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
}

export function rideStreamUrl(shareToken: string): string {
  return `${BACKEND_BASE_URL}/rides/${encodeURIComponent(shareToken)}/stream`;
}

/** The server's own explanation when it refused, which is written for people. */
export function rideErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpError) {
    if (error.status === 0) return "Sem conexão com o servidor. Tente de novo em instantes.";
    const message = (error.details as { error?: unknown } | null)?.error;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}
