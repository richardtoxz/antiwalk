import { layers, namedFlavor } from "@protomaps/basemaps";
import type { StyleSpecification } from "maplibre-gl";

// Vector tiles of the Distrito Federal in a single PMTiles archive.
export const MAP_TILES_PATH = "/map/df.pmtiles";
// Fonts and icons published by the Protomaps basemaps project.
const MAP_ASSETS_URL = "https://protomaps.github.io/basemaps-assets";

export type MapTheme = "light" | "dark";

export function buildMapStyle(theme: MapTheme): StyleSpecification {
  const tilesUrl = new URL(MAP_TILES_PATH, window.location.href).href;
  return {
    version: 8,
    glyphs: `${MAP_ASSETS_URL}/fonts/{fontstack}/{range}.pbf`,
    sprite: `${MAP_ASSETS_URL}/sprites/v4/${theme}`,
    sources: {
      protomaps: {
        type: "vector",
        url: `pmtiles://${tilesUrl}`,
        attribution: '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
      },
    },
    layers: layers("protomaps", namedFlavor(theme), { lang: "pt" }),
  };
}
