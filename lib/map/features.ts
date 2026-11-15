// Pure helpers that turn transit data into map sources, shared by the map view.
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type * as GeoJSON from "geojson";
import { positionQuality, positionAgeLabel } from "../transport/quality.ts";
import type { BusRouteDetailsResponse, BusVehicle } from "@/lib/transport/types";

export const ROUTE_SOURCE_ID = "bus-route-source";
export const ROUTE_LAYER_ID = "bus-route-layer";
export const STOPS_SOURCE_ID = "bus-stops-source";
export const STOPS_LAYER_ID = "bus-stops-layer";
export const VEHICLES_SOURCE_ID = "bus-vehicles-source";
export const VEHICLES_LAYER_ID = "bus-vehicles-layer";

export function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
export function vehiclePopup(vehicle: BusVehicle & { lineShortName: string }, now: number) {
  const delay = vehicle.delayMinutes;
  const status = delay == null ? 'Atraso não informado' : delay > 0 ? `${delay} min de atraso` : delay < 0 ? `${Math.abs(delay)} min adiantado` : 'No horário informado';
  return `<div class="p-2 text-xs"><strong>Linha ${escapeHtml(vehicle.lineShortName)}</strong><div>Veículo: ${escapeHtml(vehicle.vehicleId)}</div><div>${escapeHtml(status)}</div><div>${escapeHtml(positionAgeLabel(vehicle, now))}</div>${positionQuality(vehicle, now) !== 'fresh' ? '<div>Posição sem confirmação recente.</div>' : ''}</div>`;
}

export function latLngToLngLat(lat: number, lng: number): [number, number] {
  return [lng, lat];
}

export function createRouteLineFeatureCollection(
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
            color: routeData.route.color ?? "#F5A300",
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

export function createStopsFeatureCollection(
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
      const stops = direction.tripDetails.stops;
      stops.forEach((stop, index) => {
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
            // First and last stops stay on the map at every zoom.
            isEdge: index === 0 || index === stops.length - 1,
            color: routeData.route.color ?? "#F5A300",
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

export function createVehicleFeatureCollection(
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
            color: routeData?.route.color ?? "#F5A300",
          },
        };
      }),
  };
}

export function upsertGeoJsonSource(
  map: MapLibreMap,
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

export function safelyRunMapOperation(operation: string, task: () => void): void {
  try {
    task();
  } catch (error) {
    console.error(`[map] Failed during ${operation}`, error);
  }
}
