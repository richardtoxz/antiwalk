import { getOrSetCache } from "./cache";
import { fetchJson } from "./http";
import type {
  MetroScheduleEntry,
  MetroStationsResponse,
  MetroTrainsResponse,
} from "./types";

const ONE_DAY = 24 * 60 * 60 * 1000;

export async function getMetroStations(): Promise<MetroStationsResponse> {
  return getOrSetCache("metro:stations:v1", 7 * ONE_DAY, async () =>
    fetchJson<MetroStationsResponse>("/api/metro/estacoes")
  );
}

export async function getMetroSchedule(): Promise<MetroScheduleEntry[]> {
  return fetchJson<MetroScheduleEntry[]>("/api/metro/schedule");
}

export async function getMetroTrainsByPlatform(
  stationCode: string,
  platform: string
): Promise<MetroTrainsResponse> {
  return fetchJson<MetroTrainsResponse>(
    `/api/metro/trens/${encodeURIComponent(stationCode)}/${encodeURIComponent(platform)}`,
    { timeoutMs: 12000 }
  );
}
