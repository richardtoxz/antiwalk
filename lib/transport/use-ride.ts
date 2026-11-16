"use client";

import { useEffect, useState } from "react";
import { HttpError } from "./http";
import { getRide, rideStreamUrl } from "./rides-api";
import type { Ride, RideTrip } from "./rides";

export type RideState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "failed" }
  | { kind: "ready"; ride: Ride; trip: RideTrip };

/**
 * A ride and its trip, kept up to date by the server's stream while the ride lasts. The
 * stream closes once the ride ends; a ride the server no longer knows is "missing".
 */
export function useRide(shareToken: string | null): RideState {
  const [state, setState] = useState<{ token: string | null; value: RideState }>({ token: null, value: { kind: "loading" } });

  useEffect(() => {
    if (!shareToken) return;
    let closed = false;
    let source: EventSource | null = null;
    let retry: number | undefined;

    const connect = () => {
      const stream = new EventSource(rideStreamUrl(shareToken));
      source = stream;
      stream.onmessage = (event) => {
        let ride: Ride;
        try { ride = JSON.parse(event.data) as Ride; } catch { return; }
        setState((current) => (current.token === shareToken && current.value.kind === "ready"
          ? { token: shareToken, value: { ...current.value, ride } } : current));
        if (ride.status !== "active") stream.close();
      };
      stream.onerror = () => {
        // A dropped connection is retried by the browser; a refused one stays closed, so
        // ask again later, which also tells a forgotten ride from a network failure.
        if (stream.readyState === EventSource.CLOSED && !closed) retry = window.setTimeout(load, 10000);
      };
    };

    const load = async () => {
      try {
        const { ride, trip } = await getRide(shareToken);
        if (closed) return;
        setState({ token: shareToken, value: { kind: "ready", ride, trip } });
        if (ride.status === "active") connect();
      } catch (error) {
        if (closed) return;
        if (error instanceof HttpError && error.status === 404) {
          setState({ token: shareToken, value: { kind: "missing" } });
          return;
        }
        setState((current) => (current.token === shareToken && current.value.kind === "ready"
          ? current : { token: shareToken, value: { kind: "failed" } }));
        retry = window.setTimeout(load, 15000);
      }
    };

    void load();
    return () => {
      closed = true;
      source?.close();
      window.clearTimeout(retry);
    };
  }, [shareToken]);

  return shareToken && state.token === shareToken ? state.value : { kind: "loading" };
}
