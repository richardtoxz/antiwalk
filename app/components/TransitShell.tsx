"use client";

import { useQueryClient, useQueries } from "@tanstack/react-query";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Route, X } from 'lucide-react';
import { positionQuality, positionAgeLabel } from '@/lib/transport/quality';
import { usePageVisible, useVisibleClock } from '@/lib/transport/visibility';
import type { Place, JourneyOption } from '@/lib/transport/journeys';
import BottomSheet from "./BottomSheet";
import MapView from "./Map";
import SearchBar from "./SearchBar";
import { useTheme } from "./ThemeProvider";
import { getLineRoutes } from "@/lib/transport/bus";
import {
  getErrorMessage,
  useBusLinesQuery,
  useLineRoutesQuery,
  useMetroScheduleQuery,
  useMetroStationsQuery,
  useMetroTrainsQuery,
  useBusRealtimeData,
  useActiveRoutesDetailsSWR,
} from "@/lib/transport/hooks";
import { transportSocketClient } from "@/lib/transport/websocket";
import type {
  BusRealtimeMessage,
  BusRouteDetailsResponse,
  BusStop,
  BusVehicle,
  MetroRealtimeMode,
  SearchSelection,
  SocketConnectionState,
} from "@/lib/transport/types";
import {
  parseActiveTrains,
  normalizeMetroRealtime,
  getMetroLinesGeoJSON,
  getMetroStationsGeoJSON,
  getMetroTrainsGeoJSON,
  type RawTrainArrival,
} from "@/lib/transport/metro-data";

const JourneyPanel = lazy(() => import('./JourneyPanel'));

const ROUTE_SOURCE_ID = "bus-route-source";
const ROUTE_LAYER_ID = "bus-route-layer";
const STOPS_SOURCE_ID = "bus-stops-source";
const STOPS_LAYER_ID = "bus-stops-layer";
const VEHICLES_SOURCE_ID = "bus-vehicles-source";
const VEHICLES_LAYER_ID = "bus-vehicles-layer";

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
function vehiclePopup(vehicle: BusVehicle & { lineShortName: string }, now: number) {
  const delay = vehicle.delayMinutes;
  const status = delay == null ? 'Atraso não informado' : delay > 0 ? `${delay} min de atraso` : delay < 0 ? `${Math.abs(delay)} min adiantado` : 'No horário informado';
  return `<div class="p-2 text-xs"><strong>Linha ${escapeHtml(vehicle.lineShortName)}</strong><div>Veículo: ${escapeHtml(vehicle.vehicleId)}</div><div>${escapeHtml(status)}</div><div>${escapeHtml(positionAgeLabel(vehicle, now))}</div>${positionQuality(vehicle, now) !== 'fresh' ? '<div>Posição sem confirmação recente.</div>' : ''}</div>`;
}

function isBusRealtimeMessage(payload: unknown): payload is BusRealtimeMessage {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<BusRealtimeMessage>;
  return (
    typeof candidate.topic === "string" &&
    Boolean(candidate.data) &&
    Array.isArray(candidate.data?.vehicles)
  );
}

function latLngToLngLat(lat: number, lng: number): [number, number] {
  return [lng, lat];
}

function createRouteLineFeatureCollection(
  activeBusRoutesData: Record<string, BusRouteDetailsResponse>,
  lineDirections: Record<string, number>,
  staleRoutes: Record<number, boolean>
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];

  Object.entries(activeBusRoutesData).forEach(([line, routeData]) => {
    const selectedDirectionId = lineDirections[line] ?? 0;
    const direction = routeData.directions.find(
      (d) => d.directionId === selectedDirectionId
    );

    if (direction && direction.tripDetails) {
      const coordinates = direction.tripDetails.coordinates
        .map(([lat, lng]) => latLngToLngLat(lat, lng))
        .filter((value) => Number.isFinite(value[0]) && Number.isFinite(value[1]));

      if (coordinates.length >= 2) {
        const isStale = Boolean(staleRoutes[routeData.route.routeId]);
        features.push({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates,
          },
          properties: {
            lineShortName: line,
            directionId: selectedDirectionId,
            color: routeData.route.color ?? "#2563eb",
            isStale,
          },
        });
      }
    }
  });

  return {
    type: "FeatureCollection",
    features,
  };
}

function createStopsFeatureCollection(
  activeBusRoutesData: Record<string, BusRouteDetailsResponse>,
  lineDirections: Record<string, number>
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];

  Object.entries(activeBusRoutesData).forEach(([line, routeData]) => {
    const selectedDirectionId = lineDirections[line] ?? 0;
    const direction = routeData.directions.find(
      (d) => d.directionId === selectedDirectionId
    );

    if (direction && direction.tripDetails) {
      direction.tripDetails.stops.forEach((stop) => {
        features.push({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: latLngToLngLat(stop.lat, stop.lng),
          },
          properties: {
            stopId: stop.stopId,
            name: stop.name,
            lineShortName: line,
            color: routeData.route.color ?? "#2563eb",
          },
        });
      });
    }
  });

  return {
    type: "FeatureCollection",
    features,
  };
}

function createVehicleFeatureCollection(
  vehicles: (BusVehicle & { lineShortName: string })[],
  activeBusRoutesData: Record<string, BusRouteDetailsResponse>, now: number
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: vehicles
      .filter((vehicle) => Number.isFinite(vehicle.lat) && Number.isFinite(vehicle.lng))
      .map((vehicle) => {
        const routeData = activeBusRoutesData[vehicle.lineShortName];
        return {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: latLngToLngLat(vehicle.lat, vehicle.lng),
          },
          properties: {
            vehicleId: vehicle.vehicleId,
            delayMinutes: vehicle.delayMinutes ?? 0,
            delayKnown: vehicle.delayMinutes != null,
            observedAt: vehicle.observedAt,
            quality: positionQuality(vehicle, now),
            heading: vehicle.heading ?? 0,
            lineShortName: vehicle.lineShortName,
            color: routeData?.route.color ?? "#2563eb",
          },
        };
      }),
  };
}

function upsertGeoJsonSource(
  map: maplibregl.Map,
  sourceId: string,
  data: GeoJSON.FeatureCollection
): void {
  const existing = map.getSource(sourceId) as GeoJSONSource | undefined;
  if (existing) {
    existing.setData(data);
    return;
  }

  map.addSource(sourceId, {
    type: "geojson",
    data,
  });
}

function removeLayerIfExists(map: maplibregl.Map, layerId: string): void {
  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
  }
}

function removeSourceIfExists(map: maplibregl.Map, sourceId: string): void {
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }
}

function fitMapToRoute(
  map: maplibregl.Map,
  routeData: GeoJSON.FeatureCollection<GeoJSON.LineString>
): void {
  const coordinates = routeData.features.flatMap((feature) => feature.geometry.coordinates);
  if (coordinates.length === 0) {
    return;
  }

  const bounds = coordinates.reduce(
    (acc, coord) => acc.extend(coord as [number, number]),
    new maplibregl.LngLatBounds(
      coordinates[0] as [number, number],
      coordinates[0] as [number, number]
    )
  );

  map.fitBounds(bounds, {
    padding: {
      top: 100,
      right: 80,
      bottom: 180,
      left: 80,
    },
    maxZoom: 14,
    duration: 700,
  });
}

function safelyRunMapOperation(operation: string, task: () => void): void {
  try {
    task();
  } catch (error) {
    console.error(`[map] Failed during ${operation}`, error);
  }
}

export default function TransitShell() {
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const visible = usePageVisible();
  const now = useVisibleClock();
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [picking, setPicking] = useState<'origin' | 'destination' | null>(null);
  const [journey, setJourney] = useState<JourneyOption | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<number | null>(null);
  const [routeOverrides, setRouteOverrides] = useState<Record<string, number>>({});
  const closePlanner = useCallback(() => setPlannerOpen(false), []);

  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);

  useEffect(() => {
    console.log("[TransitShell] mapInstance changed:", mapInstance ? "DEFINED" : "NULL", "styleLoaded:", mapInstance?.isStyleLoaded());
  }, [mapInstance]);

  const [selectedStationCode, setSelectedStationCode] = useState<string | null>(null);
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [focusedLine, setFocusedLine] = useState<string | null>(null);
  const [lineDirections, setLineDirections] = useState<Record<string, number>>({});

  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [allMetroTrains, setAllMetroTrains] = useState<RawTrainArrival[]>([]);
  const [socketState, setSocketState] =
    useState<SocketConnectionState>("idle");
  const [metroRealtimeMode, setMetroRealtimeMode] =
    useState<MetroRealtimeMode>("probing");

  const metroWatchdogRef = useRef<number | null>(null);
  const busPopupRef = useRef<{ popup: maplibregl.Popup; key: string } | null>(null);

  const stationsQuery = useMetroStationsQuery();
  const scheduleQuery = useMetroScheduleQuery();
  const linesQuery = useBusLinesQuery();

  // 1. Fetch line routes for all selected lines in parallel
  const lineRoutesQueries = useQueries({
    queries: selectedLines.map((line) => ({
      queryKey: ["bus", "line-routes", line],
      queryFn: () => getLineRoutes(line),
      staleTime: 24 * 60 * 60 * 1000,
    })),
  });

  // Extract the active routeId (first routeId) for each selected line
  const activeRouteIds = useMemo(() => {
    return lineRoutesQueries
      .map((query, i) => routeOverrides[selectedLines[i]] ?? query.data?.routes?.[0]?.routeId)
      .filter((id): id is number => typeof id === "number");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLines, routeOverrides, lineRoutesQueries.map((q) => q.data?.routes?.[0]?.routeId).join(",")]);

  // 2. Fetch full route details from IndexedDB (SWR)
  const {
    routesData,
    staleRoutes,
    loadingRoutes,
    errors: detailErrors,
    retry: retryRouteDetails,
  } = useActiveRoutesDetailsSWR(activeRouteIds);

  // Compile active bus routes details response mapping
  // Uses a stable serialization of lineRoutesQueries data to avoid recalculating
  // on every render (lineRoutesQueries is a new array reference each time from useQueries)
  const lineRoutesDataKey = selectedLines
    .map((line, i) => routeOverrides[line] ?? lineRoutesQueries[i]?.data?.routes?.[0]?.routeId ?? "")
    .join(",");

  const activeBusRoutesData = useMemo(() => {
    const dataMap: Record<string, BusRouteDetailsResponse> = {};

    selectedLines.forEach((line, index) => {
      const routesQuery = lineRoutesQueries[index];
      const activeRouteId = routeOverrides[line] ?? routesQuery?.data?.routes?.[0]?.routeId;
      if (typeof activeRouteId !== "number") return;

      const details = routesData[activeRouteId];
      if (details) {
        dataMap[line] = details;
      }
    });

    return dataMap;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLines, lineRoutesDataKey, routesData, routeOverrides]);

  // 3. Connect to Realtime SSE with Fallback
  const {
    busVehiclesByTrip,
    isFallback: isSseFallback,
    statusByLine,
    updatesByLine,
  } = useBusRealtimeData(selectedLines, activeBusRoutesData);
  const busLastUpdate = focusedLine ? updatesByLine[focusedLine] || null : null;
  const busDataQuality = useMemo(() => {
    if (!focusedLine || !statusByLine[focusedLine]) return 'waiting';
    if (statusByLine[focusedLine] === 'unavailable') return 'unavailable';
    const vehicles = Object.values(busVehiclesByTrip).flat().filter(v => v.lineShortName === focusedLine);
    if (!vehicles.length) return 'empty';
    const qualities = vehicles.map(v => positionQuality(v, now));
    if (qualities.includes('fresh')) return qualities.every(q => q === 'fresh') ? 'fresh' : 'mixed';
    if (qualities.includes('stale')) return 'stale';
    if (qualities.includes('unknown')) return 'unknown';
    return 'expired';
  }, [focusedLine, statusByLine, busVehiclesByTrip, now]);

  // Synchronize lineDirections with actual available directions from API
  useEffect(() => {
    setLineDirections((prev) => {
      let changed = false;
      const next = { ...prev };

      Object.entries(activeBusRoutesData).forEach(([line, routeData]) => {
        const directions = routeData.directions || [];
        if (directions.length === 0) return;

        const currentDirId = next[line];
        const isValid = directions.some((d) => d.directionId === currentDirId);

        if (!isValid) {
          next[line] = directions[0].directionId;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [activeBusRoutesData]);

  // Aggregate loading and error states for active queries
  const isBusLoading = useMemo(() => {
    const index = selectedLines.indexOf(focusedLine || '');
    const routeId = focusedLine ? activeBusRoutesData[focusedLine]?.route.routeId ?? routeOverrides[focusedLine] ?? lineRoutesQueries[index]?.data?.routes?.[0]?.routeId : undefined;
    return Boolean(lineRoutesQueries[index]?.isLoading || (routeId && loadingRoutes[routeId] && !routesData[routeId]));
  }, [selectedLines, focusedLine, activeBusRoutesData, routeOverrides, lineRoutesQueries, loadingRoutes, routesData]);

  const busError = useMemo(() => {
    const index = selectedLines.indexOf(focusedLine || '');
    const errQuery = lineRoutesQueries[index];
    if (errQuery?.error) {
      return getErrorMessage(errQuery.error);
    }
    const routeId = focusedLine ? activeBusRoutesData[focusedLine]?.route.routeId ?? routeOverrides[focusedLine] ?? errQuery?.data?.routes?.[0]?.routeId : undefined;
    const firstDetailError = routeId ? detailErrors[routeId] : null;
    if (firstDetailError) {
      return firstDetailError;
    }
    return null;
  }, [selectedLines, focusedLine, activeBusRoutesData, routeOverrides, lineRoutesQueries, detailErrors]);

  const selectedStation = selectedStationCode
    ? stationsQuery.data?.[selectedStationCode]
    : undefined;

  const metroTrainsQuery = useMetroTrainsQuery(
    selectedStationCode ?? undefined,
    selectedPlatform ?? undefined,
    visible && metroRealtimeMode === "polling" ? 20000 : false
  );

  // Map tripId -> directionId for every active bus line
  const tripToDirectionMap = useMemo(() => {
    const mapping: Record<string, number> = {}; // key: "line:tripId" -> directionId

    Object.entries(activeBusRoutesData).forEach(([line, routeData]) => {
      routeData.trips.forEach((trip) => {
        mapping[`${line}:${trip.tripId}`] = trip.directionId;
      });
      routeData.directions.forEach((dir) => {
        mapping[`${line}:${dir.tripId}`] = dir.directionId;
      });
    });

    return mapping;
  }, [activeBusRoutesData]);

  // Filter vehicles by their trip's directionId matching user selection
  const filteredBusVehicles = useMemo(() => {
    const list: (BusVehicle & { lineShortName: string; tripId: string | number })[] = [];

    Object.entries(busVehiclesByTrip).forEach(([key, vehicles]) => {
      const lastColonIndex = key.lastIndexOf(":");
      const line = key.slice(0, lastColonIndex);
      const tripId = key.slice(lastColonIndex + 1);

      const selectedDirectionId = lineDirections[line] ?? 0;
      const directionId = tripToDirectionMap[`${line}:${tripId}`];

      if (directionId === selectedDirectionId) {
        list.push(...vehicles.filter(v => positionQuality(v, now) !== 'expired'));
      }
    });

    return list;
  }, [busVehiclesByTrip, lineDirections, tripToDirectionMap, now]);

  const routeLineFeatures = useMemo(
    () => createRouteLineFeatureCollection(activeBusRoutesData, lineDirections, staleRoutes),
    [activeBusRoutesData, lineDirections, staleRoutes]
  );
  const vehiclesRef = useRef(filteredBusVehicles);
  vehiclesRef.current = filteredBusVehicles;
  useEffect(() => {
    const active = busPopupRef.current;
    if (!active) return;
    const vehicle = filteredBusVehicles.find(v => `${v.lineShortName}:${v.vehicleId}` === active.key);
    if (!vehicle) { active.popup.remove(); busPopupRef.current = null; return; }
    active.popup.setLngLat([vehicle.lng, vehicle.lat]).setHTML(vehiclePopup(vehicle, now));
  }, [filteredBusVehicles, now]);

  const routeStopsFeatures = useMemo(
    () => createStopsFeatureCollection(activeBusRoutesData, lineDirections),
    [activeBusRoutesData, lineDirections]
  );

  const busVehicleFeatures = useMemo(
    () => createVehicleFeatureCollection(filteredBusVehicles, activeBusRoutesData, now),
    [filteredBusVehicles, activeBusRoutesData, now]
  );

  const [throttledBusVehicleFeatures, setThrottledBusVehicleFeatures] = useState(busVehicleFeatures);
  const lastUpdateTimeRef = useRef<number>(0);
  const nextUpdateTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const now = Date.now();
    const elapsed = now - lastUpdateTimeRef.current;
    const throttleInterval = 900;

    if (nextUpdateTimeoutRef.current) {
      window.clearTimeout(nextUpdateTimeoutRef.current);
      nextUpdateTimeoutRef.current = null;
    }

    if (elapsed >= throttleInterval) {
      setThrottledBusVehicleFeatures(busVehicleFeatures);
      lastUpdateTimeRef.current = now;
    } else {
      const remaining = throttleInterval - elapsed;
      nextUpdateTimeoutRef.current = window.setTimeout(() => {
        setThrottledBusVehicleFeatures(busVehicleFeatures);
        lastUpdateTimeRef.current = Date.now();
      }, remaining);
    }

    return () => {
      if (nextUpdateTimeoutRef.current) {
        window.clearTimeout(nextUpdateTimeoutRef.current);
      }
    };
  }, [busVehicleFeatures]);

  const activeMetroTrains = useMemo(() => {
    return parseActiveTrains(allMetroTrains.filter(t => t.fetchedAt && now - Date.parse(t.fetchedAt) <= 45000));
  }, [allMetroTrains, now]);

  const metroTrainsGeoJSON = useMemo(() => {
    return getMetroTrainsGeoJSON(activeMetroTrains);
  }, [activeMetroTrains]);

  const clearMetroWatchdog = useCallback(() => {
    if (metroWatchdogRef.current) {
      window.clearTimeout(metroWatchdogRef.current);
      metroWatchdogRef.current = null;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = transportSocketClient.onConnectionStateChange((state) => {
      setSocketState(state);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!selectedStation) {
      setSelectedPlatform(null);
      return;
    }

    const platforms = Object.keys(selectedStation.plataformas);
    if (platforms.length === 0) {
      setSelectedPlatform(null);
      return;
    }

    setSelectedPlatform((previous) => {
      if (previous && platforms.includes(previous)) {
        return previous;
      }
      return platforms[0] ?? null;
    });
  }, [selectedStation]);

  // Real-time bus positions are managed via useBusRealtimeData hook

  // Global Metrô train positions real-time updater
  useEffect(() => {
    if (!visible) return;
    const handleGlobalMetroTrains = (payload: any) => {
      if (payload && Array.isArray(payload.data)) {
        setAllMetroTrains(normalizeMetroRealtime(payload.data));
      }
    };

    transportSocketClient.subscribe("metro:trains", handleGlobalMetroTrains);

    return () => {
      transportSocketClient.unsubscribe("metro:trains", handleGlobalMetroTrains);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || !selectedStationCode || !selectedPlatform) {
      clearMetroWatchdog();
      setMetroRealtimeMode("probing");
      return;
    }

    setMetroRealtimeMode("probing");

    const scheduleFallbackToPolling = (waitMs: number) => {
      clearMetroWatchdog();
      metroWatchdogRef.current = window.setTimeout(() => {
        setMetroRealtimeMode("polling");
      }, waitMs);
    };

    scheduleFallbackToPolling(15000);

    const handleMetroRealtimeSignal = (payload: any) => {
      setMetroRealtimeMode("ws");
      scheduleFallbackToPolling(25000);
      if (payload && Array.isArray(payload.data)) {
        setAllMetroTrains(normalizeMetroRealtime(payload.data));
      }
      queryClient.invalidateQueries({
        queryKey: ["metro", "trains", selectedStationCode, selectedPlatform],
      });
    };

    transportSocketClient.subscribe("metro:trains", handleMetroRealtimeSignal);

    return () => {
      transportSocketClient.unsubscribe("metro:trains", handleMetroRealtimeSignal);
      clearMetroWatchdog();
    };
  }, [
    clearMetroWatchdog,
    queryClient,
    selectedPlatform,
    selectedStationCode,
    visible,
  ]);

  // Draw Bus route lines and stops on the map
  useEffect(() => {
    if (!mapInstance) return;

    const drawLayers = () => {
      if (!mapInstance.getStyle()) return;

      safelyRunMapOperation("draw-bus-route-layers", () => {
        upsertGeoJsonSource(mapInstance, ROUTE_SOURCE_ID, routeLineFeatures);
        upsertGeoJsonSource(mapInstance, STOPS_SOURCE_ID, routeStopsFeatures);

        if (!mapInstance.getLayer(ROUTE_LAYER_ID)) {
          mapInstance.addLayer({
            id: ROUTE_LAYER_ID,
            type: "line",
            source: ROUTE_SOURCE_ID,
            paint: {
              "line-color": ["get", "color"],
              "line-width": 4,
              "line-opacity": [
                "case",
                ["get", "isStale"],
                0.4,
                0.85
              ],
            },
          });
        } else {
          mapInstance.setPaintProperty(ROUTE_LAYER_ID, "line-color", ["get", "color"]);
          mapInstance.setPaintProperty(ROUTE_LAYER_ID, "line-opacity", [
            "case",
            ["get", "isStale"],
            0.4,
            0.85
          ]);
        }

        if (!mapInstance.getLayer(STOPS_LAYER_ID)) {
          mapInstance.addLayer({
            id: STOPS_LAYER_ID,
            type: "circle",
            source: STOPS_SOURCE_ID,
            paint: {
              "circle-radius": 3.5,
              "circle-color": "#ffffff",
              "circle-stroke-width": 2,
              "circle-stroke-color": ["get", "color"],
            },
          });
        } else {
          mapInstance.setPaintProperty(STOPS_LAYER_ID, "circle-stroke-color", ["get", "color"]);
        }
      });
    };

    if (mapInstance.getStyle()) {
      drawLayers();
    }

    mapInstance.on("style.load", drawLayers);

    return () => {
      mapInstance.off("style.load", drawLayers);
    };
  }, [mapInstance, routeLineFeatures, routeStopsFeatures]);

  // Fit map bounds to the focused line's route geometry when it changes
  useEffect(() => {
    if (!mapInstance || !focusedLine || journey) return;

    const routeData = activeBusRoutesData[focusedLine];
    if (!routeData) return;

    const selectedDirectionId = lineDirections[focusedLine] ?? 0;
    const direction = routeData.directions.find(
      (d) => d.directionId === selectedDirectionId
    );
    if (!direction || !direction.tripDetails) return;

    const coordinates = direction.tripDetails.coordinates.map(([lat, lng]) =>
      latLngToLngLat(lat, lng)
    );
    if (coordinates.length === 0) return;

    const bounds = coordinates.reduce(
      (acc, coord) => acc.extend(coord as [number, number]),
      new maplibregl.LngLatBounds(
        coordinates[0] as [number, number],
        coordinates[0] as [number, number]
      )
    );

    mapInstance.fitBounds(bounds, {
      padding: {
        top: 100,
        right: 80,
        bottom: 260,
        left: 80,
      },
      maxZoom: 14,
      duration: 700,
    });
  }, [mapInstance, focusedLine, activeBusRoutesData, lineDirections, journey]);

  // Draw static Metro network layers (background tracks & station circles)
  useEffect(() => {
    if (!mapInstance) return;

    const drawLayers = () => {
      if (!mapInstance.getStyle()) return;

      safelyRunMapOperation("draw-metro-base-layers", () => {
        const linesGeoJSON = getMetroLinesGeoJSON();
        upsertGeoJsonSource(mapInstance, "metro-lines-source", linesGeoJSON);

        if (!mapInstance.getLayer("metro-lines-layer")) {
          mapInstance.addLayer({
            id: "metro-lines-layer",
            type: "line",
            source: "metro-lines-source",
            paint: {
              "line-color": ["get", "lineColor"],
              "line-width": [
                "interpolate",
                ["exponential", 1.5],
                ["zoom"],
                10, 2,
                14, 4.5,
                18, 7.5
              ],
              "line-opacity": 0.75
            },
            layout: {
              "line-join": "round",
              "line-cap": "round"
            }
          });
        } else {
          mapInstance.setPaintProperty(
            "metro-lines-layer",
            "line-opacity",
            0.75
          );
        }

        const stationsGeoJSON = getMetroStationsGeoJSON();
        upsertGeoJsonSource(mapInstance, "metro-stations-source", stationsGeoJSON);

        if (!mapInstance.getLayer("metro-stations-layer")) {
          mapInstance.addLayer({
            id: "metro-stations-layer",
            type: "circle",
            source: "metro-stations-source",
            paint: {
              "circle-radius": [
                "interpolate",
                ["exponential", 1.5],
                ["zoom"],
                10, 3,
                14, 5.5,
                18, 8
              ],
              "circle-color": "#ffffff",
              "circle-stroke-width": [
                "interpolate",
                ["exponential", 1.5],
                ["zoom"],
                10, 1.5,
                14, 2.5,
                18, 3.5
              ],
              "circle-stroke-color": [
                "match",
                ["get", "linha"],
                "Ceilândia", "#ff6b09",
                "Samambaia", "#00b074",
                "#2563eb"
              ],
              "circle-opacity": 1.0,
              "circle-stroke-opacity": 1.0
            }
          });
        } else {
          mapInstance.setPaintProperty(
            "metro-stations-layer",
            "circle-opacity",
            1.0
          );
          mapInstance.setPaintProperty(
            "metro-stations-layer",
            "circle-stroke-opacity",
            1.0
          );
        }

        if (!mapInstance.getLayer("metro-stations-text-layer")) {
          mapInstance.addLayer({
            id: "metro-stations-text-layer",
            type: "symbol",
            source: "metro-stations-source",
            minzoom: 12.5,
            layout: {
              "text-field": ["get", "name"],
              "text-font": ["Noto Sans Regular"],
              "text-size": 11,
              "text-offset": [0, 1.2],
              "text-anchor": "top"
            },
            paint: {
              "text-color": resolvedTheme === "dark" ? "#f3f4f6" : "#1f2937",
              "text-halo-color": resolvedTheme === "dark" ? "#111827" : "#ffffff",
              "text-halo-width": 1.5
            }
          });
        } else {
          mapInstance.setPaintProperty(
            "metro-stations-text-layer",
            "text-color",
            resolvedTheme === "dark" ? "#f3f4f6" : "#1f2937"
          );
          mapInstance.setPaintProperty(
            "metro-stations-text-layer",
            "text-halo-color",
            resolvedTheme === "dark" ? "#111827" : "#ffffff"
          );
        }
      });
    };

    if (mapInstance.getStyle()) {
      drawLayers();
    }

    mapInstance.on("style.load", drawLayers);

    return () => {
      mapInstance.off("style.load", drawLayers);
    };
  }, [mapInstance, resolvedTheme]);

  // Draw real-time Metro trains on the map
  useEffect(() => {
    if (!mapInstance) return;

    const drawLayers = () => {
      if (!mapInstance.getStyle()) return;

      safelyRunMapOperation("draw-metro-trains", () => {
        upsertGeoJsonSource(mapInstance, "metro-trains-source", metroTrainsGeoJSON);

        if (!mapInstance.getLayer("metro-trains-layer")) {
          mapInstance.addLayer({
            id: "metro-trains-layer",
            type: "circle",
            source: "metro-trains-source",
            paint: {
              "circle-radius": [
                "interpolate",
                ["exponential", 1.5],
                ["zoom"],
                10, 4.5,
                14, 7,
                18, 9
              ],
              "circle-color": [
                "match",
                ["get", "linha"],
                "Ceilândia", "#ff6b09",
                "Samambaia", "#00b074",
                "#2563eb"
              ],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff"
            }
          });
        }

        if (!mapInstance.getLayer("metro-trains-text-layer")) {
          mapInstance.addLayer({
            id: "metro-trains-text-layer",
            type: "symbol",
            source: "metro-trains-source",
            layout: {
              "text-field": ["get", "id"],
              "text-font": ["Noto Sans Bold"],
              "text-size": 9,
              "text-anchor": "center"
            },
            paint: {
              "text-color": "#ffffff",
              "text-halo-color": "#000000",
              "text-halo-width": 0.5
            }
          });
        }
      });
    };

    if (mapInstance.getStyle()) {
      drawLayers();
    }

    mapInstance.on("style.load", drawLayers);

    return () => {
      mapInstance.off("style.load", drawLayers);
    };
  }, [mapInstance, metroTrainsGeoJSON]);

  // Draw real-time Bus vehicles on the map
  useEffect(() => {
    if (!mapInstance) return;

    const drawLayers = () => {
      if (!mapInstance.getStyle()) return;

      safelyRunMapOperation("draw-bus-vehicle-layer", () => {
        upsertGeoJsonSource(mapInstance, VEHICLES_SOURCE_ID, throttledBusVehicleFeatures);

        // 1. Bus background circle
        if (!mapInstance.getLayer(VEHICLES_LAYER_ID)) {
          mapInstance.addLayer({
            id: VEHICLES_LAYER_ID,
            type: "circle",
            source: VEHICLES_SOURCE_ID,
            paint: {
              "circle-radius": 9.5,
              "circle-color": ["get", "color"],
              "circle-opacity": ["case", ["==", ["get", "quality"], "fresh"], 1, 0.55],
              "circle-stroke-width": 2.5,
              "circle-stroke-color": [
                "case",
                ["any", ["!=", ["get", "quality"], "fresh"], ["!", ["get", "delayKnown"]]],
                "#94a3b8",
                [">", ["coalesce", ["get", "delayMinutes"], 0], 5],
                "#ef4444",
                "#10b981"
              ]
            }
          });
        } else {
          mapInstance.setPaintProperty(VEHICLES_LAYER_ID, "circle-color", ["get", "color"]);
          mapInstance.setPaintProperty(VEHICLES_LAYER_ID, "circle-opacity", ["case", ["==", ["get", "quality"], "fresh"], 1, 0.55]);
          mapInstance.setPaintProperty(VEHICLES_LAYER_ID, "circle-stroke-color", [
            "case",
            ["any", ["!=", ["get", "quality"], "fresh"], ["!", ["get", "delayKnown"]]],
            "#94a3b8",
            [">", ["coalesce", ["get", "delayMinutes"], 0], 5],
            "#ef4444",
            "#10b981"
          ]);
        }

        // 2. Bus direction indicator arrow (▲ rotated by heading)
        if (!mapInstance.getLayer("bus-vehicles-direction-layer")) {
          mapInstance.addLayer({
            id: "bus-vehicles-direction-layer",
            type: "symbol",
            source: VEHICLES_SOURCE_ID,
            layout: {
              "text-field": "▲",
              "text-font": ["Noto Sans Regular"],
              "text-size": 7.5,
              "text-rotate": ["to-number", ["get", "heading"], 0],
              "text-keep-upright": false,
              "text-anchor": "center"
            },
            paint: {
              "text-color": "#ffffff"
            }
          });
        }

        // 3. Bus line text label (e.g. "366.1") displayed above
        if (!mapInstance.getLayer("bus-vehicles-text-layer")) {
          mapInstance.addLayer({
            id: "bus-vehicles-text-layer",
            type: "symbol",
            source: VEHICLES_SOURCE_ID,
            layout: {
              "text-field": ["get", "lineShortName"],
              "text-font": ["Noto Sans Regular"],
              "text-size": 10.5,
              "text-offset": [0, -1.3],
              "text-anchor": "bottom"
            },
            paint: {
              "text-color": "#1f2937",
              "text-halo-color": "#ffffff",
              "text-halo-width": 2
            }
          });
        }
      });
    };

    if (mapInstance.getStyle()) {
      drawLayers();
    }

    mapInstance.on("style.load", drawLayers);

    return () => {
      mapInstance.off("style.load", drawLayers);
    };
  }, [mapInstance, throttledBusVehicleFeatures]);

  // Click listeners & Hover pointer behaviors for interactive map layers
  useEffect(() => {
    if (!mapInstance) return;

    // Station clicks select them in the UI
    const handleStationClick = (e: any) => {
      if (picking) return;
      const feature = e.features?.[0];
      if (feature) {
        const { code } = feature.properties;
        setSelectedStationCode(code);
        setFocusedLine(null);
        setSelectedPlatform("1");
      }
    };

    // Bus stop click shows stop name popup
    const handleStopClick = (e: any) => {
      if (picking) return;
      const feature = e.features?.[0];
      if (feature) {
        const { name, stopId, lineShortName } = feature.properties;
        setFocusedLine(lineShortName);
        setSelectedStopId(Number(stopId));
        new maplibregl.Popup({ closeButton: false })
          .setLngLat(e.lngLat)
          .setText(String(name))
          .addTo(mapInstance);
      }
    };

    // Bus vehicle click shows details popup
    const handleBusVehicleClick = (e: any) => {
      if (picking) return;
      const feature = e.features?.[0];
      if (feature) {
        const key = `${feature.properties.lineShortName}:${feature.properties.vehicleId}`;
        const vehicle = vehiclesRef.current.find(v => `${v.lineShortName}:${v.vehicleId}` === key);
        if (!vehicle) return;
        busPopupRef.current?.popup.remove();
        const popup = new maplibregl.Popup().setLngLat(e.lngLat).setHTML(vehiclePopup(vehicle, Date.now())).addTo(mapInstance);
        busPopupRef.current = { popup, key };
        popup.on('close', () => { if (busPopupRef.current?.popup === popup) busPopupRef.current = null; });
      }
    };

    // Metro train click shows train details popup
    const handleMetroTrainClick = (e: any) => {
      if (picking) return;
      const feature = e.features?.[0];
      if (feature) {
        const { id, linha, sentido, destino_final, minutesToArrival } = feature.properties;
        const etaText = minutesToArrival === 0 
          ? `<span class="text-emerald-500 font-bold">Na estação</span>`
          : `Chega em <span class="font-bold text-blue-600">${minutesToArrival} min</span>`;

        new maplibregl.Popup({ closeButton: false })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div class="p-2 text-xs font-sans text-gray-800">
              <div class="font-bold text-sm mb-1 text-gray-900">Trem ${escapeHtml(id)} (${escapeHtml(linha)})</div>
              <div>Sentido: <span class="font-medium">${escapeHtml(sentido)}</span></div>
              <div>Destino: <span class="font-medium text-gray-700">${escapeHtml(destino_final)}</span></div>
              <div class="mt-1.5 pt-1 border-t border-gray-100">${etaText}</div>
              <div class="mt-1">Posição estimada pela previsão de chegada.</div>
            </div>
          `)
          .addTo(mapInstance);
      }
    };

    mapInstance.on("click", "metro-stations-layer", handleStationClick);
    mapInstance.on("click", "bus-stops-layer", handleStopClick);
    mapInstance.on("click", "bus-vehicles-layer", handleBusVehicleClick);
    mapInstance.on("click", "metro-trains-layer", handleMetroTrainClick);

    const interactiveLayers = ["metro-stations-layer", "bus-stops-layer", "bus-vehicles-layer", "metro-trains-layer"];

    const handleMouseEnter = () => {
      mapInstance.getCanvas().style.cursor = "pointer";
    };

    const handleMouseLeave = () => {
      mapInstance.getCanvas().style.cursor = "";
    };

    interactiveLayers.forEach(layer => {
      mapInstance.on("mouseenter", layer, handleMouseEnter);
      mapInstance.on("mouseleave", layer, handleMouseLeave);
    });

    return () => {
      mapInstance.off("click", "metro-stations-layer", handleStationClick);
      mapInstance.off("click", "bus-stops-layer", handleStopClick);
      mapInstance.off("click", "bus-vehicles-layer", handleBusVehicleClick);
      mapInstance.off("click", "metro-trains-layer", handleMetroTrainClick);

      interactiveLayers.forEach(layer => {
        mapInstance.off("mouseenter", layer, handleMouseEnter);
        mapInstance.off("mouseleave", layer, handleMouseLeave);
      });
    };
  }, [mapInstance, setSelectedStationCode, setFocusedLine, setSelectedPlatform, picking]);

  useEffect(() => {
    return () => {
      clearMetroWatchdog();
    };
  }, [clearMetroWatchdog]);

  const handleResultSelect = useCallback((result: SearchSelection) => {
    if (result.type === "station") {
      setSelectedStationCode(result.stationCode);
      setFocusedLine(null);
      setSelectedPlatform("1");
    } else if (result.type === "line") {
      setSelectedLines((prev) => {
        if (prev.includes(result.shortName)) return prev;
        return [...prev, result.shortName];
      });
      setFocusedLine(result.shortName);
      setLineDirections((prev) => {
        if (prev[result.shortName] !== undefined) return prev;
        return { ...prev, [result.shortName]: 0 };
      });
    }
  }, []);

  const handleRemoveLine = useCallback((line: string) => {
    setSelectedLines((prev) => prev.filter((l) => l !== line));
    setLineDirections((prev) => {
      const next = { ...prev };
      delete next[line];
      return next;
    });
    setFocusedLine((prev) => {
      if (prev === line) {
        const remaining = selectedLines.filter((l) => l !== line);
        return remaining.length > 0 ? remaining[remaining.length - 1] : null;
      }
      return prev;
    });
  }, [selectedLines]);

  const metroError = useMemo(() => {
    if (!selectedStationCode) {
      return null;
    }

    if (metroTrainsQuery.error) {
      return getErrorMessage(metroTrainsQuery.error);
    }
    if (metroTrainsQuery.data?.fetchedAt && now - Date.parse(metroTrainsQuery.data.fetchedAt) > 45000) return 'Previsões antigas. Aguardando uma atualização.';

    return null;
  }, [metroTrainsQuery.error, metroTrainsQuery.data, selectedStationCode, now]);

  useEffect(() => {
    if (!mapInstance || !picking) return;
    const pick = (event: maplibregl.MapMouseEvent) => {
      const place: Place = { name: picking === 'origin' ? 'Origem escolhida no mapa' : 'Destino escolhido no mapa', lat: event.lngLat.lat, lng: event.lngLat.lng };
      if (picking === 'origin') setOrigin(place); else setDestination(place);
      setPicking(null); setPlannerOpen(true);
    };
    mapInstance.getCanvas().style.cursor = 'crosshair';
    mapInstance.on('click', pick);
    return () => { mapInstance.off('click', pick); mapInstance.getCanvas().style.cursor = ''; };
  }, [mapInstance, picking]);

  useEffect(() => {
    if (!mapInstance || !journey) return;
    const draw = () => {
      mapInstance.off('idle', draw);
      // A mudança de enquadramento pode carregar novos blocos do mapa antes de desenhar o percurso.
      if (!mapInstance.isStyleLoaded()) {
        mapInstance.once('idle', draw);
        return;
      }
      const features: GeoJSON.Feature<GeoJSON.LineString>[] = journey.legs.filter(l => l.path.length >= 2).map(l => ({
        type: 'Feature', geometry: { type: 'LineString', coordinates: l.path }, properties: { mode: l.mode }
      }));
      upsertGeoJsonSource(mapInstance, 'journey-source', { type: 'FeatureCollection', features });
      if (!mapInstance.getLayer('journey-layer')) mapInstance.addLayer({ id: 'journey-layer', type: 'line', source: 'journey-source',
        paint: { 'line-width': 5, 'line-opacity': 0.75, 'line-color': ['match', ['get', 'mode'], 'walk', '#64748b', 'metro', '#16a34a', '#2563eb'] } });
    };
    draw(); mapInstance.on('style.load', draw);
    return () => { mapInstance.off('style.load', draw); mapInstance.off('idle', draw); if (mapInstance.getLayer('journey-layer')) mapInstance.removeLayer('journey-layer'); if (mapInstance.getSource('journey-source')) mapInstance.removeSource('journey-source'); };
  }, [mapInstance, journey]);

  const selectJourney = useCallback((option: JourneyOption) => {
    setJourney(option); setPlannerOpen(false);
    const buses = option.legs.filter(l => l.mode === 'bus');
    setSelectedLines([...new Set(buses.map(l => l.line!))]);
    setRouteOverrides(Object.fromEntries(buses.map(l => [l.line!, Number(l.routeId)])));
    setLineDirections(Object.fromEntries(buses.map(l => [l.line!, l.directionId ?? 0])));
    setFocusedLine(buses[0]?.line || null);
    const metro = option.legs.find(l => l.mode === 'metro');
    if (metro?.from.id?.startsWith('metro:')) setSelectedStationCode(metro.from.id.split(':')[1]);
    const points = option.legs.flatMap(l => l.path);
    if (points.length && mapInstance) {
      const bounds = new maplibregl.LngLatBounds(points[0], points[0]);
      points.forEach(p => bounds.extend(p));
      mapInstance.fitBounds(bounds, { padding: { top: 120, bottom: 180, left: 45, right: 45 }, maxZoom: 15,
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 600 });
    }
  }, [mapInstance]);

  return (
    <main className="relative w-full h-dvh overflow-hidden bg-background">
      <a
        href="#bottom-sheet"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg"
      >
        Pular para o conteúdo principal
      </a>

      <div className="absolute inset-0 z-0">
        <MapView onMapReady={setMapInstance} />
      </div>

      <SearchBar
        lines={linesQuery.data?.lines ?? []}
        stations={stationsQuery.data}
        isLoading={linesQuery.isLoading || stationsQuery.isLoading}
        onSelectResult={handleResultSelect}
        selectedLines={selectedLines}
        onRemoveLine={handleRemoveLine}
      />

      <button type="button" onClick={() => setPlannerOpen(true)} className={`absolute right-4 z-30 flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg ${selectedLines.length ? 'top-32' : 'top-24'}`}>
        <Route className="h-4 w-4" />Planejar viagem
      </button>
      {picking && <div className="absolute left-4 right-4 top-44 z-30 flex items-center justify-between gap-2 rounded-xl bg-card p-3 shadow-lg"><p className="text-sm">Toque no mapa para escolher {picking === 'origin' ? 'a origem' : 'o destino'}.</p><button type="button" className="h-11 w-11" aria-label="Cancelar seleção no mapa" onClick={() => { setPicking(null); setPlannerOpen(true); }}><X /></button></div>}
      {journey && !picking && <div className="absolute right-4 top-48 z-20 max-w-[220px] rounded-xl bg-card p-3 text-xs shadow-lg"><p className="font-semibold">Percurso de cerca de {journey.durationMinutes} min</p>
        <p className="mt-1 text-muted-foreground">{journey.legs.some(l => l.mode === 'walk' && l.walkingRoute !== 'geoapify') ? 'Há caminhadas aproximadas. Confira os acessos a pé.' : 'Tempos estimados. Traçados do transporte aproximados.'}</p>
        {journey.legs.some(l => l.walkingRoute === 'geoapify') && <p className="mt-2 text-muted-foreground">Caminhos a pé: <a className="underline" href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a> / <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a></p>}
        <button type="button" onClick={() => setJourney(null)} className="mt-1 min-h-11 text-primary">Limpar percurso</button></div>}
      {plannerOpen && <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-background">Abrindo planejamento…</div>}>
        <JourneyPanel origin={origin} destination={destination} onOrigin={setOrigin} onDestination={setDestination} onClose={closePlanner} onSelect={selectJourney}
          onPick={field => { setPicking(field); setPlannerOpen(false); }} />
      </Suspense>}

      {/* Floating Status Badges */}
      {(isSseFallback || Object.values(staleRoutes).some((v) => v)) && selectedLines.length > 0 && (
        <div className={`fixed left-1/2 -translate-x-1/2 z-20 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-md pointer-events-none transition-all duration-300 ${selectedLines.length > 0 ? "top-[7.5rem]" : "top-20"}`}>
          {isSseFallback && (
            <div className="flex items-center gap-2 bg-amber-500/15 backdrop-blur-md border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold px-3 py-2 rounded-lg shadow-sm w-full transition-all duration-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span>Reconectando. Consultando posições a cada 15s.</span>
            </div>
          )}
          {Object.values(staleRoutes).some((v) => v) && (
            <div className="flex items-center gap-2 bg-blue-500/15 backdrop-blur-md border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-semibold px-3 py-2 rounded-lg shadow-sm w-full transition-all duration-300">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              <span>Itinerário salvo. A confirmação de atualização ainda está pendente.</span>
            </div>
          )}
        </div>
      )}

      <div id="bottom-sheet">
        <BottomSheet
          selectedStation={selectedStation}
          selectedPlatform={selectedPlatform}
          onSelectPlatform={setSelectedPlatform}
          metroTrains={metroTrainsQuery.data}
          metroStatus={scheduleQuery.data?.find(s => s.dt_afetada_alteracao?.slice(0, 10) === new Date(now - 10800000).toISOString().slice(0, 10)) ?? scheduleQuery.data?.find(s => Number(s.id_dia_semana) % 7 === new Date(now - 10800000).getUTCDay())}
          metroRealtimeMode={metroRealtimeMode}
          isMetroLoading={metroTrainsQuery.isLoading}
          metroError={metroError}
          isBusLoading={isBusLoading}
          busError={busError}
          onRetryBus={() => { retryRouteDetails(); lineRoutesQueries[selectedLines.indexOf(focusedLine || '')]?.refetch(); }}
          busLastUpdate={busLastUpdate}
          busDataQuality={busDataQuality}
          now={now}
          selectedStopId={selectedStopId}
          onSelectStop={setSelectedStopId}
          socketState={socketState}
          selectedLines={selectedLines}
          focusedLine={focusedLine}
          onSelectFocusedLine={setFocusedLine}
          onRemoveLine={handleRemoveLine}
          selectedStationCode={selectedStationCode}
          onSelectStationCode={setSelectedStationCode}
          lineDirections={lineDirections}
          onChangeLineDirection={(line, dir) =>
            setLineDirections((prev) => ({ ...prev, [line]: dir }))
          }
          activeBusRoutesData={activeBusRoutesData}
          busVehicles={filteredBusVehicles}
        />
      </div>
    </main>
  );
}
