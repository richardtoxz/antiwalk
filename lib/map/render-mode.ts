// How buses are drawn: "light" uses flat icons, "full" uses the 3D models.
// "auto" picks full only on devices that look able to keep it smooth, and
// drops to light for good if the map turns out to render too slowly.

export type BusRenderMode = "auto" | "light" | "full";

const MODE_KEY = "antiwalk-bus-mode";
const SLOW_KEY = "antiwalk-slow-3d";

export function readBusRenderMode(): BusRenderMode {
  try {
    const value = localStorage.getItem(MODE_KEY);
    return value === "light" || value === "full" ? value : "auto";
  } catch {
    return "auto";
  }
}

export function writeBusRenderMode(mode: BusRenderMode) {
  try {
    if (mode === "auto") localStorage.removeItem(MODE_KEY);
    else localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Storage can be unavailable (private mode); the choice then lasts for the session.
  }
}

export function markSlow3D() {
  try { localStorage.setItem(SLOW_KEY, "1"); } catch { /* see writeBusRenderMode */ }
}

function isMarkedSlow(): boolean {
  try { return localStorage.getItem(SLOW_KEY) === "1"; } catch { return false; }
}

interface DeviceHints {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  connection?: { saveData?: boolean };
}

let capability: boolean | null = null;

/**
 * Signals available before rendering anything. Browsers that do not report a value are not penalized.
 * Computed once per page: each probe creates a WebGL context, and browsers keep only about 16 alive,
 * dropping the oldest one (the map's) when that limit is passed.
 */
export function deviceLooksCapable(): boolean {
  if (capability === null) capability = probeDevice();
  return capability;
}

function probeDevice(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & DeviceHints;
  if (nav.connection?.saveData) return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return false;
  if (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency < 4) return false;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    // Free the probe context right away instead of waiting for garbage collection.
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

export function resolveUses3D(mode: BusRenderMode): boolean {
  if (mode === "full") return true;
  if (mode === "light") return false;
  return !isMarkedSlow() && deviceLooksCapable();
}
