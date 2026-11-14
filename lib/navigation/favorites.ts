// Favorite lines and stations, kept on this device.
import type { SearchSelection } from "@/lib/transport/types";

const KEY = "antiwalk-favorites";
const EVENT = "antiwalk-favorites";
const MAX = 12;

function isSelection(value: unknown): value is SearchSelection {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SearchSelection>;
  if (typeof item.id !== "string" || typeof item.title !== "string" || typeof item.subtitle !== "string") return false;
  return (item.type === "line" && typeof item.shortName === "string") || (item.type === "station" && typeof item.stationCode === "string");
}

let cache: { raw: string | null; list: SearchSelection[] } = { raw: null, list: [] };

/** Stable snapshot for useSyncExternalStore: the same array until the stored value changes. */
export function readFavorites(): SearchSelection[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { return cache.list; }
  if (raw === cache.raw) return cache.list;
  let list: SearchSelection[] = [];
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    list = Array.isArray(parsed) ? parsed.filter(isSelection).slice(0, MAX) : [];
  } catch {
    list = [];
  }
  cache = { raw, list };
  return list;
}

const EMPTY: SearchSelection[] = [];
export const readFavoritesOnServer = () => EMPTY;

export function subscribeFavorites(notify: () => void) {
  window.addEventListener(EVENT, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(EVENT, notify);
    window.removeEventListener("storage", notify);
  };
}

export function toggleFavorite(item: SearchSelection) {
  const current = readFavorites();
  const next = current.some((f) => f.id === item.id) ? current.filter((f) => f.id !== item.id) : [item, ...current].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(EVENT));
}

export function lineSelection(shortName: string, longName?: string): SearchSelection {
  return { id: `line-${shortName}`, type: "line", title: `Linha ${shortName}`, subtitle: longName || "Ônibus DF", shortName };
}

export function stationSelection(code: string, name?: string, line?: string): SearchSelection {
  return { id: `station-${code}`, type: "station", title: name || code, subtitle: line ? `Metrô DF - Linha ${line}` : "Metrô DF", stationCode: code };
}
