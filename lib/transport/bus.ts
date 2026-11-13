import { getOrSetCache } from "./cache";
import { fetchJson } from "./http";
import type {
  BusLineRoutesResponse,
  BusLinesResponse,
  BusRouteDetailsResponse,
  MonitorRouteResponse,
  BusVehicle,
} from "./types";

const ONE_DAY = 24 * 60 * 60 * 1000;

export async function getBusLines(): Promise<BusLinesResponse> {
  return getOrSetCache("bus:lines:v1", ONE_DAY, async () =>
    fetchJson<BusLinesResponse>("/lines")
  );
}

export async function getLineRoutes(line: string): Promise<BusLineRoutesResponse> {
  return getOrSetCache(`bus:line-routes:${line}:v1`, ONE_DAY, async () =>
    fetchJson<BusLineRoutesResponse>(`/lines/${encodeURIComponent(line)}/routes`)
  );
}

export async function getRouteDetails(
  routeId: number
): Promise<BusRouteDetailsResponse> {
  return getOrSetCache(`bus:route-details:${routeId}:v1`, 7 * ONE_DAY, async () =>
    fetchJson<BusRouteDetailsResponse>(`/routes/${routeId}`, { timeoutMs: 20000 })
  );
}

export async function startRouteMonitoring(
  routeId: number
): Promise<MonitorRouteResponse> {
  return fetchJson<MonitorRouteResponse>(`/monitor/${routeId}`, {
    method: "POST",
  });
}

export async function getRouteVehicles(
  routeId: number
): Promise<{ routeId: number; total: number; vehicles: BusVehicle[] }> {
  return fetchJson<{ routeId: number; total: number; vehicles: BusVehicle[] }>(
    `/routes/${routeId}/vehicles`
  );
}

export async function getStopTimes(
  stopId: string | number
): Promise<{ stopId: string; total: number; stoptimes: any[] }> {
  return fetchJson<{ stopId: string; total: number; stoptimes: any[] }>(
    `/stops/${stopId}/stoptimes`
  );
}
