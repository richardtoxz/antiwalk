"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";
import type * as GeoJSON from "geojson";
import { LocateFixed } from "lucide-react";
import { busIconId } from "@/lib/map/bus-icon";
import { safelyRunMapOperation, upsertGeoJsonSource } from "@/lib/map/features";
import { easeOut, pathBetween, pointAlong, snapToRoute, type LngLat } from "@/lib/map/vehicle-motion";
import { RIDE_TOKEN_PATTERN, remainingText, rideHeadline, ridePositionNote } from "@/lib/transport/rides";
import { useRide } from "@/lib/transport/use-ride";
import { useVisibleClock } from "@/lib/transport/visibility";
import LineChip from "./LineChip";
import MapView from "./Map";

const ROUTE_SOURCE = "ride-route-source";
const STOP_SOURCE = "ride-stop-source";
const BUS_SOURCE = "ride-bus-source";
const ROUTE_LAYER = "ride-route-layer";
const STOP_LAYER = "ride-stop-layer";
const STOP_LABEL_LAYER = "ride-stop-label-layer";
const BUS_LAYER = "ride-bus-layer";
const MOVE_MS = 1200;
const PRIMARY = "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground";
const SECONDARY = "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-foreground px-3 text-sm font-semibold hover:bg-accent";

interface Shown {
  point: LngLat;
  heading: number;
  along?: number;
}

function busFrame(shown: Shown | null, color: string): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: shown ? [{ type: "Feature", geometry: { type: "Point", coordinates: shown.point }, properties: { heading: shown.heading, icon: busIconId(color) } }] : [],
  };
}

// Room the card takes over the map, so framing keeps the bus and the stop out from under it.
function cardPadding(card: HTMLElement | null) {
  const box = card?.getBoundingClientRect();
  if (window.innerWidth >= 768) return { top: 60, bottom: 60, left: (box?.right ?? 400) + 40, right: 60 };
  return { top: (box?.bottom ?? 280) + 40, bottom: 60, left: 40, right: 40 };
}

/** The page a shared ride's link opens: the bus on its route, live, and when it reaches the stop. */
export default function RideView({ token }: { token: string }) {
  const valid = RIDE_TOKEN_PATTERN.test(token);
  const live = useRide(valid ? token : null);
  // A mistyped or cut link can never become a ride.
  const state = valid ? live : { kind: "missing" as const };
  const now = useVisibleClock(5000);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const ride = state.kind === "ready" ? state.ride : null;
  const trip = state.kind === "ready" ? state.trip : null;
  const line = useMemo(() => trip?.coordinates.map(([lat, lng]) => [lng, lat] as LngLat) ?? [], [trip]);
  const color = ride?.color ?? "#F5A300";
  const stop = ride?.alightStop ?? null;
  const stopLng = stop?.lng;
  const stopLat = stop?.lat;
  const stopName = stop?.name;
  const position = ride?.position ?? null;
  const busLng = position?.lng;
  const busLat = position?.lat;
  const observedAt = position?.observedAt;
  const shownRef = useRef<Shown | null>(null);
  // The camera keeps the bus, and the stop when there is one, in view until the person moves the map.
  const followRef = useRef(true);
  const framedRef = useRef(false);
  const cardRef = useRef<HTMLElement>(null);
  const frame = (point: LngLat, animate: boolean) => {
    if (!map) return;
    if (stopLng !== undefined && stopLat !== undefined) {
      map.fitBounds(new maplibregl.LngLatBounds(point, point).extend([stopLng, stopLat]),
        { padding: cardPadding(cardRef.current), maxZoom: 16, duration: animate ? MOVE_MS : 0 });
    } else if (animate) {
      map.easeTo({ center: point, duration: MOVE_MS });
    } else {
      map.jumpTo({ center: point, zoom: 15 });
    }
  };
  const frameRef = useRef(frame);
  useEffect(() => { frameRef.current = frame; });

  useEffect(() => {
    if (!map) return;
    const stopFollowing = () => { followRef.current = false; };
    map.on("dragstart", stopFollowing);
    return () => { map.off("dragstart", stopFollowing); };
  }, [map]);

  // Route, stop and bus layers, drawn again when a theme change replaces the map style.
  useEffect(() => {
    if (!map || line.length < 2) return;
    const draw = () => safelyRunMapOperation("draw-shared-ride", () => {
      upsertGeoJsonSource(map, ROUTE_SOURCE, { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "LineString", coordinates: line }, properties: {} }] });
      upsertGeoJsonSource(map, STOP_SOURCE, { type: "FeatureCollection", features: stopLng !== undefined && stopLat !== undefined
        ? [{ type: "Feature", geometry: { type: "Point", coordinates: [stopLng, stopLat] }, properties: { name: stopName ?? "" } }] : [] });
      upsertGeoJsonSource(map, BUS_SOURCE, busFrame(shownRef.current, color));
      if (!map.getLayer(ROUTE_LAYER)) {
        map.addLayer({ id: ROUTE_LAYER, type: "line", source: ROUTE_SOURCE, layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": color, "line-width": 5, "line-opacity": 0.85 } });
      }
      if (!map.getLayer(STOP_LAYER)) {
        map.addLayer({ id: STOP_LAYER, type: "circle", source: STOP_SOURCE,
          paint: { "circle-radius": 8, "circle-color": "#ffffff", "circle-stroke-width": 4, "circle-stroke-color": color } });
      }
      if (!map.getLayer(STOP_LABEL_LAYER)) {
        map.addLayer({ id: STOP_LABEL_LAYER, type: "symbol", source: STOP_SOURCE,
          layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Medium"], "text-size": 12, "text-offset": [0, 1.4], "text-anchor": "top" },
          paint: { "text-color": "#141414", "text-halo-color": "#F6F2E9", "text-halo-width": 2 } });
      }
      if (!map.getLayer(BUS_LAYER)) {
        map.addLayer({ id: BUS_LAYER, type: "symbol", source: BUS_SOURCE,
          layout: { "icon-image": ["get", "icon"], "icon-rotate": ["to-number", ["get", "heading"], 0], "icon-rotation-alignment": "map",
            "icon-pitch-alignment": "map", "icon-allow-overlap": true, "icon-ignore-placement": true,
            "icon-size": ["interpolate", ["linear"], ["zoom"], 10, 1, 14, 1.15, 17, 1.5] } });
      }
    });
    draw();
    map.on("style.load", draw);
    return () => { map.off("style.load", draw); };
  }, [map, line, color, stopLng, stopLat, stopName]);

  // Each new position: the bus glides there along the route, as on the app's map.
  useEffect(() => {
    if (!map || busLng === undefined || busLat === undefined) return;
    const raw: LngLat = [busLng, busLat];
    const previous = shownRef.current;
    const snapped = snapToRoute(line, raw, { maxMeters: 60, previousAlong: previous?.along });
    const target: Shown = snapped ? { point: snapped.point, heading: snapped.heading, along: snapped.along } : { point: raw, heading: previous?.heading ?? 0 };
    const draw = (shown: Shown) => (map.getSource(BUS_SOURCE) as GeoJSONSource | undefined)?.setData(busFrame(shown, color));
    let animation = 0;
    if (!previous || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      shownRef.current = target;
      draw(target);
    } else {
      const path = pathBetween(line, previous.point, target.point);
      const started = performance.now();
      const step = (time: number) => {
        const k = easeOut((time - started) / MOVE_MS);
        const at = pointAlong(path, k);
        shownRef.current = k >= 1 ? target : { point: at.point, heading: at.heading ?? target.heading, along: previous.along };
        draw(shownRef.current);
        if (k < 1) animation = requestAnimationFrame(step);
      };
      animation = requestAnimationFrame(step);
    }
    if (!framedRef.current) {
      framedRef.current = true;
      frameRef.current(target.point, false);
    } else if (followRef.current) {
      frameRef.current(target.point, true);
    }
    return () => cancelAnimationFrame(animation);
  }, [map, line, color, busLng, busLat, observedAt]);

  const recenter = () => {
    followRef.current = true;
    if (shownRef.current) frame(shownRef.current.point, true);
  };

  let content;
  if (state.kind === "loading") {
    content = <p className="text-sm">Carregando a viagem…</p>;
  } else if (state.kind === "failed") {
    content = <p className="text-sm">Não foi possível carregar a viagem. Tentando de novo…</p>;
  } else if (state.kind === "missing" || !ride) {
    content = (
      <>
        <h1 className="text-base font-semibold">Este link não está mais ativo</h1>
        <p className="mt-1 text-sm text-muted-foreground">A viagem terminou ou o link expirou. Peça um novo a quem compartilhou.</p>
        <div className="mt-3 flex"><Link href="/" className={PRIMARY}>Abrir o Antiwalk</Link></div>
      </>
    );
  } else {
    const note = ridePositionNote(ride, now);
    const remaining = ride.status === "active" ? remainingText(ride.remainingMeters) : null;
    content = (
      <>
        <div className="flex items-center gap-2">
          <LineChip line={ride.line} color={ride.color} textColor={ride.textColor} />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold">Viagem compartilhada</h1>
            <p className="truncate text-xs text-muted-foreground">{ride.routeName}</p>
          </div>
        </div>
        <p className="mt-3 text-base font-semibold">{rideHeadline(ride, now)}</p>
        {(remaining || note) && <p className="mt-1 text-sm text-muted-foreground">{[remaining && `${remaining[0].toUpperCase()}${remaining.slice(1)}.`, note].filter(Boolean).join(" ")}</p>}
        {ride.status !== "active" && <p className="mt-1 text-sm text-muted-foreground">Este link parou de atualizar.</p>}
        <div className="mt-3 flex gap-2">
          {ride.status === "active" && position && (
            <button type="button" onClick={recenter} className={SECONDARY}><LocateFixed className="h-4 w-4" aria-hidden />Ver o ônibus</button>
          )}
          <Link href="/" className={PRIMARY}>Abrir o Antiwalk</Link>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Ônibus {ride.vehicleId}, seguido pelo GPS da própria linha. A localização de quem compartilhou não é enviada.</p>
      </>
    );
  }

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <div className="absolute inset-0 z-0">
        <MapView onMapReady={setMap} />
      </div>
      <section ref={cardRef} aria-live="polite" className="absolute left-4 right-4 top-4 z-10 rounded-lg border border-border bg-card p-4 shadow-lg md:right-auto md:w-96">
        {content}
      </section>
    </main>
  );
}
