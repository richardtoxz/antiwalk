"use client";

import { useEffect, useRef, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre 6 looks for its worker next to its own module file, which no longer
// holds once the bundler moves that file. Bundle the worker and point to it.
import bundledWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import rawWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

// In development Vite injects its reload client into bundled workers, and that client
// needs a document, which workers lack. The raw module works there; builds use the bundle.
const maplibreWorkerUrl = import.meta.env.DEV ? rawWorkerUrl : bundledWorkerUrl;
import { Protocol } from "pmtiles";
import { buildMapStyle } from "@/lib/map/style";
import { BUS_ICON_PREFIX, drawBusIcon } from "@/lib/map/bus-icon";
import { useTheme } from "./ThemeProvider";

// Lets MapLibre read tiles straight from a PMTiles archive with range requests.
let pmtilesRegistered = false;
function registerPmtiles() {
  if (pmtilesRegistered) return;
  maplibregl.addProtocol("pmtiles", new Protocol().tile);
  pmtilesRegistered = true;
}

interface MapProps {
  onMapReady?: (map: maplibregl.Map) => void;
}

export default function Map({ onMapReady }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const { resolvedTheme } = useTheme();
  const themeRef = useRef(resolvedTheme);
  themeRef.current = resolvedTheme;
  const readyRef = useRef(onMapReady);
  readyRef.current = onMapReady;

  const currentThemeRef = useRef(resolvedTheme);

  const initializeMap = useCallback(() => {
    if (map.current || !mapContainer.current) return;

    registerPmtiles();
    const initialStyle = buildMapStyle(themeRef.current);
    currentThemeRef.current = themeRef.current;

    maplibregl.setWorkerUrl(maplibreWorkerUrl);

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: initialStyle,
      center: [-47.8822, -15.7942],
      zoom: 12,
      maxZoom: 18,
      maxBounds: [
        [-48.342125, -16.161104],
        [-47.282869, -15.426097],
      ],
      pitchWithRotate: false,
      dragRotate: false,
      touchZoomRotate: true,
      attributionControl: false,
    });

    map.current.on("styleimagemissing", (event) => {
      if (!map.current || map.current.hasImage(event.id)) {
        return;
      }

      if (event.id.startsWith(BUS_ICON_PREFIX)) {
        const icon = drawBusIcon(event.id.slice(BUS_ICON_PREFIX.length));
        if (icon) {
          map.current.addImage(event.id, { width: icon.width, height: icon.height, data: icon.data }, { pixelRatio: icon.pixelRatio });
          return;
        }
      }

      const size = 2;
      const transparentPixelData = new Uint8Array(size * size * 4);
      map.current.addImage(event.id, {
        width: size,
        height: size,
        data: transparentPixelData,
      });
    });

    // Add navigation controls for accessibility
    map.current.addControl(
      new maplibregl.NavigationControl({
        showCompass: false,
        visualizePitch: false,
      }),
      "bottom-right"
    );

    // Add geolocation control
    map.current.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
        },
        trackUserLocation: true,
      }),
      "bottom-right"
    );

    // Attribution control in a better position
    map.current.addControl(
      new maplibregl.AttributionControl({
        compact: true,
      }),
      "bottom-left"
    );

    map.current.on("load", () => {
      console.log("[Map] Map 'load' event fired. Style is loaded:", map.current?.isStyleLoaded());
      if (readyRef.current && map.current) {
        console.log("[Map] Calling onMapReady");
        readyRef.current(map.current);
      }
    });

    map.current.on("style.load", () => {
      console.log("[Map] Style loaded event fired. Style URL:", map.current?.getStyle()?.name || "unknown");
    });
  }, []);

  useEffect(() => {
    initializeMap();

    return () => {
      console.log("[Map] Cleaning up map instance");
      map.current?.remove();
      map.current = null;
    };
  }, [initializeMap]);

  // Watch for theme changes and update map style
  useEffect(() => {
    if (map.current) {
      if (resolvedTheme !== currentThemeRef.current) {
        currentThemeRef.current = resolvedTheme;
        map.current.setStyle(buildMapStyle(resolvedTheme));
      }
    }
  }, [resolvedTheme]);

  return (
    <div
      ref={mapContainer}
      className="w-full h-full min-h-dvh touch-pan-x touch-pan-y"
      role="application"
      aria-label="Mapa interativo de transporte público"
      tabIndex={0}
    />
  );
}
