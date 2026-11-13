"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { get, set } from "idb-keyval";
import {
  getBusLines,
  getLineRoutes,
  getRouteDetails,
  startRouteMonitoring,
  getStopTimes,
} from "./bus";
import { HttpError, fetchJson } from "./http";
import { isUsableRouteCache } from "./quality";
import { usePageVisible } from "./visibility";
import type { BusRouteDetailsResponse } from "./types";
import {
  getMetroSchedule,
  getMetroStations,
  getMetroTrainsByPlatform,
} from "./metro";

export function useMetroStationsQuery() {
  return useQuery({
    queryKey: ["metro", "stations"],
    queryFn: getMetroStations,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });
}

export function useMetroScheduleQuery() {
  return useQuery({
    queryKey: ["metro", "schedule"],
    queryFn: getMetroSchedule,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMetroTrainsQuery(
  stationCode?: string,
  platform?: string,
  refetchInterval: number | false = false
) {
  return useQuery({
    queryKey: ["metro", "trains", stationCode, platform],
    queryFn: () => getMetroTrainsByPlatform(stationCode!, platform!),
    enabled: Boolean(stationCode && platform),
    staleTime: 5000,
    refetchInterval,
  });
}

export function useBusLinesQuery() {
  return useQuery({
    queryKey: ["bus", "lines"],
    queryFn: getBusLines,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });
}

export function useLineRoutesQuery(line?: string) {
  return useQuery({
    queryKey: ["bus", "line-routes", line],
    queryFn: () => getLineRoutes(line!),
    enabled: Boolean(line),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useRouteDetailsQuery(routeId?: number) {
  return useQuery({
    queryKey: ["bus", "route", routeId],
    queryFn: () => getRouteDetails(routeId!),
    enabled: typeof routeId === "number",
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useStartRouteMonitorMutation() {
  return useMutation({
    mutationFn: (routeId: number) => startRouteMonitoring(routeId),
  });
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof HttpError) {
    if (error.status === 404) {
      return "Não encontramos dados para esta consulta.";
    }

    if (error.status === 408) {
      return "A requisição demorou demais. Tente novamente.";
    }

    if (error.status === 503) return "Os dados de transporte estão temporariamente indisponíveis. Tentaremos novamente.";
    return "Não foi possível consultar os dados agora.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Erro inesperado ao consultar dados de transporte.";
}

export function useStopTimesQuery(
  stopId?: string | number,
  refetchInterval: number | false = false
) {
  return useQuery({
    queryKey: ["bus", "stoptimes", stopId],
    queryFn: () => getStopTimes(stopId!),
    enabled: Boolean(stopId),
    refetchInterval,
  });
}

export { useBusRealtimeData } from "./realtime";

export function useActiveRoutesDetailsSWR(activeRouteIds: number[]) {
  const [routesData, setRoutesData] = useState<Record<number, BusRouteDetailsResponse>>({});
  const [staleRoutes, setStaleRoutes] = useState<Record<number, boolean>>({});
  const [loadingRoutes, setLoadingRoutes] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [revision, setRevision] = useState(0);
  const visible = usePageVisible();
  const retry = () => setRevision(value => value + 1);
  useEffect(() => {
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, []);

  useEffect(() => {
    if (activeRouteIds.length === 0) {
      setRoutesData((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      setStaleRoutes((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      setLoadingRoutes((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      setErrors((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }
    if (!visible) return;

    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => activeRouteIds.includes(Number(id)))));
    let active = true;
    const controller = new AbortController();

    activeRouteIds.forEach(async (routeId) => {
      const cacheKey = `bus:route-details:${routeId}:v2`;

      if (active) {
        setLoadingRoutes((prev) => ({ ...prev, [routeId]: true }));
      }

      // 1. Load from IndexedDB instantly
      let cachedData: BusRouteDetailsResponse | null = null;
      try {
        const entry = await get<{ data: BusRouteDetailsResponse; expiresAt: number }>(cacheKey);
        if (entry && isUsableRouteCache(entry)) {
          cachedData = entry.data;
          if (active) {
            setRoutesData((prev) => ({ ...prev, [routeId]: cachedData! }));
            setStaleRoutes((prev) => ({ ...prev, [routeId]: true }));
            setLoadingRoutes((prev) => ({ ...prev, [routeId]: false }));
          }
        }
      } catch (err) {
        console.warn(`[SWR] Failed to read IndexedDB for route ${routeId}:`, err);
      }

      // 2. Fetch fresh data from network in background
      try {
        const freshData = await fetchJson<BusRouteDetailsResponse>(`/routes/${routeId}`, { timeoutMs: 20000, signal: controller.signal });
        if (active) {
          setErrors(prev => { const next = { ...prev }; delete next[routeId]; return next; });
          setRoutesData((prev) => ({ ...prev, [routeId]: freshData }));
          setStaleRoutes((prev) => ({ ...prev, [routeId]: false }));
          setLoadingRoutes((prev) => ({ ...prev, [routeId]: false }));
          
          // Write to IndexedDB
          const ttlMs = 7 * 24 * 60 * 60 * 1000;
          await set(cacheKey, {
            data: freshData,
            expiresAt: Date.now() + ttlMs,
          }).catch(err => console.warn('[SWR] Não foi possível salvar o itinerário:', err));
        }
      } catch (err: unknown) {
        console.error(`[SWR] Network fetch failed for route ${routeId}:`, err);
        if (active) {
          setLoadingRoutes((prev) => ({ ...prev, [routeId]: false }));
          if (!cachedData) {
            setErrors((prev) => ({ ...prev, [routeId]: getErrorMessage(err) }));
          }
        }
      }
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [activeRouteIds, revision, visible]);

  return {
    routesData,
    staleRoutes,
    loadingRoutes,
    errors,
    retry,
  };
}
