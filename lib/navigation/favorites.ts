// Favorite lines and stations, kept on this device.
import type { SearchSelection } from "@/lib/transport/types";
import { createSelectionStore } from "./selection-store";

const store = createSelectionStore("antiwalk-favorites", 12);

export const readFavorites = store.read;
export const readFavoritesOnServer = store.readOnServer;
export const subscribeFavorites = store.subscribe;

export function toggleFavorite(item: SearchSelection) {
  const current = store.read();
  store.write(current.some((f) => f.id === item.id) ? current.filter((f) => f.id !== item.id) : [item, ...current]);
}

export function lineSelection(shortName: string, longName?: string): SearchSelection {
  return { id: `line-${shortName}`, type: "line", title: `Linha ${shortName}`, subtitle: longName || "Ônibus DF", shortName };
}

export function stationSelection(code: string, name?: string, line?: string): SearchSelection {
  return { id: `station-${code}`, type: "station", title: name || code, subtitle: line ? `Metrô DF - Linha ${line}` : "Metrô DF", stationCode: code };
}
