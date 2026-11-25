import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouteLineFeatureCollection, createStopsFeatureCollection, createVehicleFeatureCollection, escapeHtml, vehiclePopup } from '../lib/map/features.ts';
import type { BusRouteDetailsResponse } from '../lib/transport/types.ts';

const trip = (coordinates: [number, number][], stops: { stopId: number; name: string; lat: number; lng: number }[]) =>
  ({ tripId: 1, tripName: 'Ida', routeName: 'x', coordinates, stops, tzOffset: -3, price: '5.50' });

const route = {
  route: { routeId: 10, shortName: '0.110', longName: 'Rodoviária / UnB', color: '#449612', textColor: '#fff', price: 3.8, description: null },
  trips: [],
  directions: [
    { directionId: 0, tripId: 1, tripDetails: trip([[-15.79, -47.88], [-15.78, -47.87]], [{ stopId: 5, name: 'A', lat: -15.79, lng: -47.88 }]) },
    { directionId: 1, tripId: 2, tripDetails: trip([[-15.78, -47.87], [-15.79, -47.88], [-15.80, -47.89]], []) },
  ],
} as unknown as BusRouteDetailsResponse;

test('route lines follow the chosen direction and swap to [lng, lat]', () => {
  const ida = createRouteLineFeatureCollection({ '0.110': route }, { '0.110': 0 }, {});
  assert.equal(ida.features.length, 1);
  assert.deepEqual(ida.features[0].geometry.coordinates[0], [-47.88, -15.79]);
  assert.equal(ida.features[0].properties?.color, '#449612');
  const volta = createRouteLineFeatureCollection({ '0.110': route }, { '0.110': 1 }, { 10: true });
  assert.equal(volta.features[0].geometry.coordinates.length, 3);
  assert.equal(volta.features[0].properties?.isStale, true);
});

test('stops carry their line and name', () => {
  const stops = createStopsFeatureCollection({ '0.110': route }, {});
  assert.equal(stops.features.length, 1);
  assert.equal(stops.features[0].properties?.name, 'A');
  assert.equal(stops.features[0].properties?.lineShortName, '0.110');
});

test('vehicles without coordinates are left out and get the route color', () => {
  const now = Date.parse('2026-11-14T12:00:00Z');
  const vehicles = [
    { vehicleId: '1', lat: -15.79, lng: -47.88, heading: 90, observedAt: '2026-11-14T11:59:40Z', lineShortName: '0.110' },
    { vehicleId: '2', lat: Number.NaN, lng: -47.88, lineShortName: '0.110' },
  ];
  const collection = createVehicleFeatureCollection(vehicles as never, { '0.110': route }, now);
  assert.equal(collection.features.length, 1);
  assert.equal(collection.features[0].properties?.color, '#449612');
  assert.equal(collection.features[0].properties?.quality, 'fresh');
});

test('popup text is escaped', () => {
  assert.equal(escapeHtml('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
  const html = vehiclePopup({ vehicleId: '<img onerror=1>', lat: 0, lng: 0, lineShortName: '0.110' } as never, Date.now());
  assert.ok(!html.includes('<img'));
});
