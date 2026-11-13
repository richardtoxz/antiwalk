"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { sseTransportClient } from './sse';
import { getRouteVehicles } from './bus';
import { usePageVisible } from './visibility';
import type { BusRouteDetailsResponse, BusVehicle, BusRealtimeMessage } from './types';

type Vehicle = BusVehicle & { lineShortName: string; tripId: string | number };
export type BusDataStatus = 'waiting' | 'available' | 'unavailable';
export function useBusRealtimeData(selectedLines: string[], routeData: Record<string, BusRouteDetailsResponse>) {
  const [busVehiclesByTrip, setVehicles] = useState<Record<string, Vehicle[]>>({});
  const [isFallback, setIsFallback] = useState(false);
  const [statusByLine, setStatus] = useState<Record<string, BusDataStatus>>({});
  const [updatesByLine, setUpdates] = useState<Record<string, string>>({});
  const visible = usePageVisible();
  const current = useRef(routeData); current.current = routeData;
  const ids = useMemo(() => selectedLines.flatMap(line => routeData[line] ? [routeData[line].route.routeId] : []), [selectedLines, routeData]);
  const idsKey = ids.join(',');
  useEffect(() => sseTransportClient.onFallbackChange(setIsFallback), []);
  useEffect(() => {
    sseTransportClient.setMonitoredRoutes(visible ? ids : []);
    return () => sseTransportClient.setMonitoredRoutes([]);
    // idsKey keeps the subscription stable between GPS messages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, visible]);

  useEffect(() => {
    if (!visible) return;
    return sseTransportClient.subscribe((payload: BusRealtimeMessage | { topic?: string; data?: { routeId?: number; status?: string }; identifier?: string; error?: string }) => {
      if (!payload || typeof payload !== 'object') return;
      const topic = payload.topic || '';
      const data = payload.data;
      const routeId = topic.startsWith('mobilibus:') ? Number(topic.split(':')[2]) : Number('identifier' in payload ? payload.identifier : NaN);
      const line = Object.keys(current.current).find(key => current.current[key].route.routeId === routeId);
      if (!line) return;
      if (topic.startsWith('mobilibus:status:') || ('error' in payload && payload.error)) {
        const status = data && 'status' in data ? data.status : 'unavailable';
        setStatus(prev => ({ ...prev, [line]: status === 'available' ? 'available' : 'unavailable' }));
        return;
      }
      if (!data || !('vehicles' in data) || !Array.isArray(data.vehicles)) return;
      const groups = Array.isArray(data.trips) ? data.trips : [{ tripId: data.tripId, vehicles: data.vehicles }];
      setVehicles(prev => {
        const next = { ...prev };
        for (const key of Object.keys(next)) if (key.startsWith(`${line}:`)) delete next[key];
        for (const group of groups) {
          if (group.tripId == null) continue;
          next[`${line}:${group.tripId}`] = group.vehicles.map(v => ({ ...v, tripId: String(group.tripId), lineShortName: line }));
        }
        return next;
      });
      setStatus(prev => ({ ...prev, [line]: 'available' }));
      setUpdates(prev => ({ ...prev, [line]: data.timestamp || new Date().toISOString() }));
    });
  }, [visible]);

  const queries = useQueries({ queries: ids.map(routeId => ({
    queryKey: ['bus', 'fallback-vehicles', routeId], queryFn: () => getRouteVehicles(routeId),
    enabled: visible && isFallback, refetchInterval: visible && isFallback ? 15000 : false,
    staleTime: 10000, retry: 1,
  })) });
  const signature = queries.map(q => `${q.dataUpdatedAt}:${q.errorUpdatedAt}`).join(',');
  useEffect(() => {
    if (!isFallback || !visible) return;
    queries.forEach((query, index) => {
      const line = Object.keys(current.current).find(key => current.current[key].route.routeId === ids[index]);
      if (!line) return;
      if (query.error) { setStatus(prev => ({ ...prev, [line]: 'unavailable' })); return; }
      if (!query.data) return;
      setVehicles(prev => {
        const next = { ...prev };
        for (const key of Object.keys(next)) if (key.startsWith(`${line}:`)) delete next[key];
        for (const vehicle of query.data!.vehicles) {
          if (vehicle.tripId == null) continue;
          const key = `${line}:${vehicle.tripId}`;
          next[key] ??= [];
          next[key].push({ ...vehicle, tripId: vehicle.tripId, lineShortName: line });
        }
        return next;
      });
      setStatus(prev => ({ ...prev, [line]: 'available' }));
      setUpdates(prev => ({ ...prev, [line]: new Date(query.dataUpdatedAt).toISOString() }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, isFallback, visible]);
  useEffect(() => {
    setVehicles(prev => Object.fromEntries(Object.entries(prev).filter(([key]) => selectedLines.includes(key.slice(0, key.lastIndexOf(':'))))));
    setStatus(prev => Object.fromEntries(Object.entries(prev).filter(([key]) => selectedLines.includes(key))));
    setUpdates(prev => Object.fromEntries(Object.entries(prev).filter(([key]) => selectedLines.includes(key))));
  }, [selectedLines]);
  return { busVehiclesByTrip, isFallback, statusByLine, updatesByLine };
}
