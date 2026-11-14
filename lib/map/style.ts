import { layers, namedFlavor, type Flavor } from "@protomaps/basemaps";
import type { StyleSpecification } from "maplibre-gl";

// Vector tiles of the Distrito Federal in a single PMTiles archive.
export const MAP_TILES_URL = process.env.NEXT_PUBLIC_MAP_TILES_URL || "/map/df.pmtiles";
// Fonts and icons published by the Protomaps basemaps project.
const MAP_ASSETS_URL = "https://protomaps.github.io/basemaps-assets";

export type MapTheme = "light" | "dark";

interface MapPalette {
  land: string; water: string; green: string; landuse: string; buildings: string;
  roadMinor: string; roadMajor: string; roadHighway: string; roadCasing: string;
  rail: string; boundary: string; label: string; labelHalo: string;
}

// The basemap uses the interface palette, so the map reads as part of the app.
const PALETTES: Record<MapTheme, MapPalette> = {
  light: {
    land: "#E9E4D8", water: "#BEC8C3", green: "#D3D8BF", landuse: "#E1DBCD", buildings: "#D9D2C2",
    roadMinor: "#F6F2E9", roadMajor: "#FFFDF8", roadHighway: "#FFFDF8", roadCasing: "#CFC7B6",
    rail: "#B5AD9C", boundary: "#A39B8B", label: "#3A352D", labelHalo: "#E9E4D8",
  },
  dark: {
    land: "#141311", water: "#000000", green: "#181A13", landuse: "#181714", buildings: "#1C1A17",
    roadMinor: "#2A2823", roadMajor: "#3B372F", roadHighway: "#4D483D", roadCasing: "#0A0A09",
    rail: "#3B372F", boundary: "#5F584C", label: "#B5AD9C", labelHalo: "#141311",
  },
};

function paletteFlavor(theme: MapTheme): Flavor {
  const p = PALETTES[theme];
  const flavor: Record<string, unknown> = { ...namedFlavor(theme) };
  for (const key of Object.keys(flavor)) {
    if (typeof flavor[key] !== "string") continue;
    if (key.includes("label")) flavor[key] = key.endsWith("halo") ? p.labelHalo : p.label;
    else if (key.includes("casing")) flavor[key] = p.roadCasing;
    else if (key.endsWith("highway")) flavor[key] = p.roadHighway;
    else if (key.endsWith("major") || key.endsWith("link")) flavor[key] = p.roadMajor;
    else if (key.includes("minor") || key.endsWith("other") || key === "runway" || key === "pier") flavor[key] = p.roadMinor;
    else if (/^(park|wood|scrub)_/.test(key) || key === "zoo") flavor[key] = p.green;
    else if (["hospital", "industrial", "school", "pedestrian", "military", "aerodrome", "sand", "beach", "glacier"].includes(key)) flavor[key] = p.landuse;
  }
  Object.assign(flavor, { background: p.land, earth: p.land, water: p.water, buildings: p.buildings, railway: p.rail, boundaries: p.boundary });
  return flavor as unknown as Flavor;
}

export function buildMapStyle(theme: MapTheme): StyleSpecification {
  const tilesUrl = new URL(MAP_TILES_URL, window.location.href).href;
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
    layers: layers("protomaps", paletteFlavor(theme), { lang: "pt" }),
  };
}
