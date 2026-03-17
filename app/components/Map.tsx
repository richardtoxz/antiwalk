"use client";

import { useEffect, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "./ThemeProvider";

interface MapProps {
  onMapReady?: (map: maplibregl.Map) => void;
}

export default function Map({ onMapReady }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const { resolvedTheme } = useTheme();

  const getMapStyle = (theme: "light" | "dark") => {
    return theme === "dark"
      ? "https://tiles.openfreemap.org/styles/dark"
      : "https://tiles.openfreemap.org/styles/liberty";
  };

  const initializeMap = useCallback(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: getMapStyle(resolvedTheme),
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
      if (onMapReady && map.current) {
        onMapReady(map.current);
      }
    });
  }, [onMapReady]);

  useEffect(() => {
    initializeMap();

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [initializeMap]);

  // Watch for theme changes and update map style
  useEffect(() => {
    if (map.current) {
      map.current.setStyle(getMapStyle(resolvedTheme));
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
