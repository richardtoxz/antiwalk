import test from 'node:test';
import assert from 'node:assert/strict';
import { bearing, distanceMeters, easeOut, locateOnLine, pathBetween, pathLength, pointAlong, snapToRoute, type LngLat } from '../lib/map/vehicle-motion.ts';

// A route in Brasília going east, then north (about 100 m per leg).
const line: LngLat[] = [[-47.9000, -15.8000], [-47.8990, -15.8000], [-47.8990, -15.7990]];

test('distances and bearings follow the compass', () => {
  assert.ok(Math.abs(distanceMeters(line[0], line[1]) - 107) < 2);
  assert.ok(Math.abs(bearing(line[0], line[1]) - 90) < 0.5);
  assert.ok(Math.abs(bearing(line[1], line[2]) - 0) < 0.5);
  assert.ok(Math.abs(bearing(line[1], line[0]) - 270) < 0.5);
});

test('a point is located on the nearest segment', () => {
  const at = locateOnLine(line, [-47.8995, -15.79998])!;
  assert.equal(at.index, 0);
  assert.ok(at.distance < 5);
  assert.ok(Math.abs(at.along - 53.5) < 2);
  assert.equal(locateOnLine([line[0]], line[0]), null);
});

test('forward moves follow the route around corners', () => {
  const from: LngLat = [-47.8995, -15.8000];
  const to: LngLat = [-47.8990, -15.7995];
  const path = pathBetween(line, from, to);
  assert.deepEqual(path, [from, line[1], to]);
  assert.ok(pathLength(path) > distanceMeters(from, to));
});

test('backward, off-route and very long moves go straight', () => {
  const ahead: LngLat = [-47.8990, -15.7995];
  const behind: LngLat = [-47.8995, -15.8000];
  assert.deepEqual(pathBetween(line, ahead, behind), [ahead, behind]);
  const offRoute: LngLat = [-47.8950, -15.8050];
  assert.deepEqual(pathBetween(line, behind, offRoute), [behind, offRoute]);
  assert.deepEqual(pathBetween(line, behind, ahead, { maxAlongMeters: 10 }), [behind, ahead]);
  assert.deepEqual(pathBetween(undefined, behind, ahead), [behind, ahead]);
});

test('points along a path carry the travel direction', () => {
  const path: LngLat[] = [line[0], line[1], line[2]];
  const start = pointAlong(path, 0);
  assert.deepEqual(start.point, line[0]);
  assert.ok(Math.abs(start.heading! - 90) < 0.5);
  const end = pointAlong(path, 1);
  assert.deepEqual(end.point, line[2]);
  assert.ok(Math.abs(end.heading! - 0) < 0.5);
  assert.equal(pointAlong([line[0], line[0]], 0.5).heading, null);
});

test('easing stays within bounds', () => {
  assert.equal(easeOut(0), 0);
  assert.equal(easeOut(1), 1);
  assert.equal(easeOut(2), 1);
  assert.ok(easeOut(0.5) > 0.5);
});

test('a fix beside the route is moved onto it and takes the street direction', () => {
  // About 12 m north of the eastbound leg, as GPS drift often reports.
  const snap = snapToRoute(line, [-47.8995, -15.79989])!;
  assert.ok(snap.distance > 10 && snap.distance < 14);
  assert.ok(Math.abs(snap.point[1] - -15.8) < 1e-9);
  assert.ok(Math.abs(snap.heading - 90) < 0.5);
  assert.equal(snapToRoute(line, [-47.8950, -15.8050]), null);
  assert.equal(snapToRoute([line[0]], line[0]), null);
});

test('on a street used both ways the bus stays on the pass it was following', () => {
  // Out along a street and back on the same street, 6 m apart.
  const outAndBack: LngLat[] = [[-47.9000, -15.8000], [-47.8980, -15.8000], [-47.8980, -15.80005], [-47.9000, -15.80005]];
  const fix: LngLat = [-47.8990, -15.80003];
  const out = snapToRoute(outAndBack, fix, { previousAlong: 50 })!;
  assert.ok(Math.abs(out.heading - 90) < 0.5);
  const back = snapToRoute(outAndBack, fix, { previousAlong: 300 })!;
  assert.ok(Math.abs(back.heading - 270) < 0.5);
  assert.ok(back.along > out.along);
});
