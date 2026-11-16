// Geometry for animating vehicles between GPS fixes along their route.
// Coordinates are [lng, lat]. Distances use an equirectangular approximation,
// which is accurate to well under a meter at city scale.

export type LngLat = [number, number];

const EARTH_RADIUS_M = 6371000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Local planar offset of b from a, in meters (east, north). */
function offset(a: LngLat, b: LngLat): [number, number] {
  const x = toRad(b[0] - a[0]) * Math.cos(toRad((a[1] + b[1]) / 2)) * EARTH_RADIUS_M;
  const y = toRad(b[1] - a[1]) * EARTH_RADIUS_M;
  return [x, y];
}

export function distanceMeters(a: LngLat, b: LngLat): number {
  const [x, y] = offset(a, b);
  return Math.hypot(x, y);
}

/** Compass bearing from a to b, 0 = north, clockwise, in [0, 360). */
export function bearing(a: LngLat, b: LngLat): number {
  const [x, y] = offset(a, b);
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}

export interface LinePosition {
  /** Index of the segment start vertex. */
  index: number;
  /** Position inside the segment, 0..1. */
  t: number;
  /** Distance from the point to the line, meters. */
  distance: number;
  /** Distance along the line from its start, meters. */
  along: number;
  point: LngLat;
}

/** Nearest position on a polyline. Returns null for lines with fewer than two vertices. */
export function locateOnLine(line: LngLat[], p: LngLat): LinePosition | null {
  if (line.length < 2) return null;
  let best: LinePosition | null = null;
  let walked = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const [bx, by] = offset(a, b);
    const [px, py] = offset(a, p);
    const length2 = bx * bx + by * by;
    const t = length2 > 0 ? Math.max(0, Math.min(1, (px * bx + py * by) / length2)) : 0;
    const distance = Math.hypot(px - t * bx, py - t * by);
    const segment = Math.sqrt(length2);
    if (!best || distance < best.distance) {
      best = {
        index: i,
        t,
        distance,
        along: walked + t * segment,
        point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
      };
    }
    walked += segment;
  }
  return best;
}

export interface RouteSnap {
  /** The fix moved onto the route. */
  point: LngLat;
  /** Direction of travel of the route at that point, 0 = north. */
  heading: number;
  /** Distance along the route from its start, meters. */
  along: number;
  /** How far the fix was from the route, meters. */
  distance: number;
}

/**
 * Where a GPS fix sits on its route: the nearest point within `maxMeters`, and the
 * direction the route runs there. GPS drifts a few meters sideways and the reported
 * heading is often off, while the route is drawn along the street, so both come from
 * the route. When the route passes the same place twice (loops, or a street used both
 * ways), the pass that continues from `previousAlong` wins over the nearest one.
 */
export function snapToRoute(
  line: LngLat[],
  p: LngLat,
  { maxMeters = 50, previousAlong }: { maxMeters?: number; previousAlong?: number } = {},
): RouteSnap | null {
  if (line.length < 2) return null;
  // Best position of each stretch of route that comes within maxMeters of the fix.
  const passes: (LinePosition & { heading: number })[] = [];
  let pass: (LinePosition & { heading: number }) | null = null;
  let walked = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const [bx, by] = offset(a, b);
    const segment = Math.hypot(bx, by);
    if (segment === 0) continue;
    const [px, py] = offset(a, p);
    const t = Math.max(0, Math.min(1, (px * bx + py * by) / (segment * segment)));
    const distance = Math.hypot(px - t * bx, py - t * by);
    if (distance <= maxMeters) {
      if (!pass || distance < pass.distance) {
        pass = {
          index: i, t, distance, along: walked + t * segment,
          point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
          heading: bearing(a, b),
        };
      }
    } else if (pass) {
      passes.push(pass);
      pass = null;
    }
    walked += segment;
  }
  if (pass) passes.push(pass);
  if (!passes.length) return null;

  // Without history the nearest pass wins. With it, going backwards costs a lot and
  // jumping far ahead a little, so a bus keeps following the pass it was on.
  const cost = (candidate: LinePosition) => {
    if (previousAlong === undefined) return candidate.distance;
    const progress = candidate.along - previousAlong;
    return candidate.distance + (progress < -50 ? 1000 : Math.abs(progress) * 0.05);
  };
  const best = passes.reduce((a, b) => (cost(b) < cost(a) ? b : a));
  return { point: best.point, heading: best.heading, along: best.along, distance: best.distance };
}

export interface PathOptions {
  /** Points farther than this from the line are not snapped to it. */
  maxSnapMeters?: number;
  /** Longer stretches along the line fall back to a straight move. */
  maxAlongMeters?: number;
}

/**
 * Path a vehicle follows from `from` to `to`. When both points sit on the route
 * and the vehicle moves forward along it, the path follows the route's vertices;
 * otherwise it is a straight segment.
 */
export function pathBetween(line: LngLat[] | undefined, from: LngLat, to: LngLat, options: PathOptions = {}): LngLat[] {
  const { maxSnapMeters = 60, maxAlongMeters = 3000 } = options;
  if (!line || line.length < 2) return [from, to];
  const a = locateOnLine(line, from);
  const b = locateOnLine(line, to);
  if (!a || !b || a.distance > maxSnapMeters || b.distance > maxSnapMeters) return [from, to];
  const along = b.along - a.along;
  if (along <= 0 || along > maxAlongMeters) return [from, to];
  const path: LngLat[] = [from];
  for (let i = a.index + 1; i <= b.index; i++) path.push(line[i]);
  path.push(to);
  return path;
}

export function pathLength(path: LngLat[]): number {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) total += distanceMeters(path[i], path[i + 1]);
  return total;
}

/** Point and travel direction at a fraction (0..1) of the path length. */
export function pointAlong(path: LngLat[], fraction: number): { point: LngLat; heading: number | null } {
  if (path.length === 1) return { point: path[0], heading: null };
  const total = pathLength(path);
  if (total === 0) return { point: path[path.length - 1], heading: null };
  let target = Math.max(0, Math.min(1, fraction)) * total;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const segment = distanceMeters(a, b);
    if (target <= segment || i === path.length - 2) {
      const t = segment > 0 ? Math.min(1, target / segment) : 1;
      return {
        point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
        heading: segment > 0 ? bearing(a, b) : null,
      };
    }
    target -= segment;
  }
  return { point: path[path.length - 1], heading: null };
}

/** Ease-out cubic: fast start, gentle arrival. */
export const easeOut = (k: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
