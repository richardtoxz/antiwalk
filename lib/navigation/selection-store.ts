// A small list of search selections kept in localStorage, readable with useSyncExternalStore.
import type { SearchSelection } from "@/lib/transport/types";

export function isSelection(value: unknown): value is SearchSelection {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SearchSelection>;
  if (typeof item.id !== "string" || typeof item.title !== "string" || typeof item.subtitle !== "string") return false;
  return (item.type === "line" && typeof item.shortName === "string") || (item.type === "station" && typeof item.stationCode === "string");
}

const EMPTY: SearchSelection[] = [];

export function createSelectionStore(key: string, max: number) {
  const event = `selection-store:${key}`;
  let cache: { raw: string | null; list: SearchSelection[] } = { raw: null, list: EMPTY };

  /** Returns the same array until the stored value changes, as useSyncExternalStore requires. */
  const read = (): SearchSelection[] => {
    let raw: string | null;
    try { raw = localStorage.getItem(key); } catch { return cache.list; }
    if (raw === cache.raw) return cache.list;
    let list: SearchSelection[] = EMPTY;
    try {
      const parsed: unknown = JSON.parse(raw ?? "[]");
      if (Array.isArray(parsed)) list = parsed.filter(isSelection).slice(0, max);
    } catch {
      list = EMPTY;
    }
    cache = { raw, list };
    return list;
  };

  const write = (list: SearchSelection[]) => {
    try { localStorage.setItem(key, JSON.stringify(list.slice(0, max))); } catch { return; }
    window.dispatchEvent(new Event(event));
  };

  const subscribe = (notify: () => void) => {
    window.addEventListener(event, notify);
    window.addEventListener("storage", notify);
    return () => {
      window.removeEventListener(event, notify);
      window.removeEventListener("storage", notify);
    };
  };

  return { read, write, subscribe, readOnServer: () => EMPTY };
}

export const recentsStore = createSelectionStore("transporte-df-recent-searches", 6);

export function rememberSearch(item: SearchSelection) {
  recentsStore.write([item, ...recentsStore.read().filter((r) => r.id !== item.id)]);
}
