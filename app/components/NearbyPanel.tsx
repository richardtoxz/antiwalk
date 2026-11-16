"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bus, Loader2, LocateFixed, TrainFront } from "lucide-react";
import { getNearbyPlaces, walkingLabel, type NearbyPlace } from "@/lib/transport/nearby";
import { getErrorMessage } from "@/lib/transport/hooks";
import { usePageVisible } from "@/lib/transport/visibility";
import { cn } from "@/lib/utils";

type Position = { lat: number; lng: number };
type LocateState = "idle" | "locating" | "denied" | "unavailable" | "ready";

const MAX_LINES_SHOWN = 6;

/**
 * Stops and stations around the person. Location is requested only when they ask for it,
 * unless the browser already has permission from an earlier visit.
 */
export default function NearbyPanel({ onOpenLine, onOpenStation }: {
  onOpenLine: (line: string, stopId?: number) => void;
  onOpenStation: (code: string, name: string) => void;
}) {
  const [state, setState] = useState<LocateState>("idle");
  const [position, setPosition] = useState<Position | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const visible = usePageVisible();

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState("unavailable");
      return;
    }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition({ lat: result.coords.latitude, lng: result.coords.longitude });
        setState("ready");
      },
      (error) => setState(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  // Someone who already allowed location does not need to tap again.
  useEffect(() => {
    let cancelled = false;
    navigator.permissions?.query({ name: "geolocation" as PermissionName })
      .then((status) => { if (!cancelled && status.state === "granted") locate(); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [locate]);

  // Rounded so small GPS jitter does not trigger new requests.
  const key = position ? [position.lat.toFixed(3), position.lng.toFixed(3)] : null;
  const query = useQuery({
    queryKey: ["nearby", key],
    queryFn: ({ signal }) => getNearbyPlaces(position!.lat, position!.lng, signal),
    enabled: Boolean(position) && visible,
    staleTime: 60000,
    refetchInterval: visible ? 120000 : false,
  });

  const places = query.data?.places ?? [];
  const shown: NearbyPlace[] = [
    ...places.filter((p) => p.kind === "metro").slice(0, 2),
    ...places.filter((p) => p.kind === "bus").slice(0, 5),
  ].sort((a, b) => a.distanceMeters - b.distanceMeters);

  return (
    <section className="mt-5" aria-label="Perto de você">
      <h3 className="text-xs font-medium text-muted-foreground">Perto de você</h3>

      {state !== "ready" && (
        <div className="mt-2">
          {state === "denied" ? (
            <p className="text-sm text-muted-foreground">A localização está bloqueada para este site. Libere nas configurações do navegador para ver as paradas próximas.</p>
          ) : state === "unavailable" ? (
            <p className="text-sm text-muted-foreground">Não foi possível obter sua localização agora.</p>
          ) : null}
          {state !== "denied" && (
            <button
              type="button"
              onClick={locate}
              disabled={state === "locating"}
              className="mt-1 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-foreground px-3 text-sm font-semibold hover:bg-accent disabled:opacity-60"
            >
              {state === "locating" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LocateFixed className="h-4 w-4" aria-hidden />}
              {state === "locating" ? "Localizando…" : state === "unavailable" ? "Tentar de novo" : "Ver paradas perto de mim"}
            </button>
          )}
        </div>
      )}

      {state === "ready" && query.isLoading && (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Procurando paradas…</p>
      )}
      {state === "ready" && query.error && <p role="status" className="mt-2 text-sm text-muted-foreground">{getErrorMessage(query.error)}</p>}
      {state === "ready" && query.data && shown.length === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">Nenhuma parada a até 700 m daqui.</p>
      )}

      {shown.length > 0 && (
        <ul className="mt-1 divide-y divide-border">
          {shown.map((place) => {
            const isMetro = place.kind === "metro";
            const isOpen = expanded === place.id;
            const lines = isOpen ? place.lines : place.lines.slice(0, MAX_LINES_SHOWN);
            return (
              <li key={place.id} className="py-2">
                <button
                  type="button"
                  onClick={() => (isMetro && place.stationCode ? onOpenStation(place.stationCode, place.name) : onOpenLine(place.lines[0], place.stopId))}
                  className="flex min-h-11 w-full items-center gap-3 text-left"
                >
                  {isMetro ? <TrainFront className="h-4 w-4 shrink-0" aria-hidden /> : <Bus className="h-4 w-4 shrink-0" aria-hidden />}
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm font-medium">{place.name}</span>
                    <span className="block text-xs text-muted-foreground">{walkingLabel(place.distanceMeters)}{isMetro ? ", estação de metrô" : ""}</span>
                  </span>
                </button>
                {!isMetro && place.lines.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5 pl-7" role="group" aria-label={`Linhas em ${place.name}`}>
                    {lines.map((line) => (
                      <button
                        key={line}
                        type="button"
                        onClick={() => onOpenLine(line, place.stopId)}
                        className="min-h-8 rounded-md border border-border px-2 text-xs font-semibold tabular-nums hover:bg-accent"
                      >
                        {line}
                      </button>
                    ))}
                    {place.lines.length > MAX_LINES_SHOWN && (
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : place.id)}
                        className={cn("min-h-8 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-accent")}
                      >
                        {isOpen ? "Menos" : `+${place.lines.length - MAX_LINES_SHOWN}`}
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
