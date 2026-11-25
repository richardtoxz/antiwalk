import test from 'node:test';
import assert from 'node:assert/strict';
import type { LngLat } from '../lib/map/vehicle-motion.ts';
import { START_RIDE_ATTRIBUTE, vehiclePopup } from '../lib/map/features.ts';
import {
  endedText, minutesUntil, parseOwnRide, remainingText, rideHeadline, rideLink, ridePositionNote, rideShareText, stopsAhead,
  type Ride,
} from '../lib/transport/rides.ts';

const TOKEN = 'abcdefghijklmnopqrstuv';
const OWNER = 'ABCDEFGHIJKLMNOPQRSTUV';

function ride(overrides: Partial<Ride> = {}): Ride {
  return {
    status: 'active', endedReason: null, endedAt: null, line: '0.110', routeName: 'UnB', color: '#123456', textColor: '#FFFFFF',
    vehicleId: '12345', headsign: 'Terminal Sul', position: null, alightStop: null, arrivalAt: null, remainingMeters: null,
    offRoute: false, createdAt: '2026-11-16T21:00:00.000Z', expiresAt: '2026-11-17T00:00:00.000Z', updatedAt: '2026-11-16T21:00:00.000Z',
    ...overrides,
  };
}

const quadra = { stopId: 2, name: 'Quadra 5', lat: -15.805, lng: -47.8 };

test('the ride kept on the device is read back only when it is complete', () => {
  const kept = { shareToken: TOKEN, ownerToken: OWNER, line: '0.110', directionId: 1, vehicleId: '12345' };
  assert.deepEqual(parseOwnRide(JSON.stringify(kept)), kept);
  assert.equal(parseOwnRide(JSON.stringify({ ...kept, directionId: undefined }))?.directionId, 0);
  assert.equal(parseOwnRide(JSON.stringify({ ...kept, ownerToken: 'short' })), null);
  assert.equal(parseOwnRide(JSON.stringify({ ...kept, line: 7 })), null);
  assert.equal(parseOwnRide('{not json'), null);
  assert.equal(parseOwnRide(null), null);
  assert.equal(rideLink(TOKEN, 'https://antiwalk.example'), `https://antiwalk.example/viagem/${TOKEN}`);
});

test('only stops still ahead of the bus are offered as the stop to get off', () => {
  const line: LngLat[] = [[-47.8, -15.8], [-47.8, -15.81]];
  const stops = [
    { stopId: 1, name: 'Terminal Norte', lat: -15.8, lng: -47.8 },
    quadra,
    { stopId: 3, name: 'Terminal Sul', lat: -15.81, lng: -47.8 },
  ];
  assert.deepEqual(stopsAhead(line, stops, [-47.8, -15.8025]).map((s) => s.stopId), [2, 3]);
  // Off the drawn route, every stop is offered and the server decides.
  assert.equal(stopsAhead(line, stops, [-47.7, -15.8025]).length, 3);
});

test('on a loop the terminal it ends at is still ahead of a bus that just left it', () => {
  // North, east, south and back west to the start.
  const loop: LngLat[] = [[-47.8, -15.8], [-47.8, -15.795], [-47.795, -15.795], [-47.795, -15.8], [-47.8, -15.8]];
  const terminal = { stopId: 1, name: 'Terminal', lat: -15.8, lng: -47.8 };
  const stops = [terminal, { stopId: 2, name: 'Meio', lat: -15.795, lng: -47.7975 }, terminal];
  assert.deepEqual(stopsAhead(loop, stops, [-47.8, -15.8]).map((s) => s.stopId), [2, 1]);
});

test('the headline says where the bus goes and when it gets there', () => {
  const now = Date.parse('2026-11-16T21:30:00Z');
  const at = (minutes: number) => new Date(now + minutes * 60000).toISOString();
  assert.equal(rideHeadline(ride(), now), 'Sentido Terminal Sul');
  assert.equal(rideHeadline(ride({ alightStop: quadra }), now), 'A caminho de Quadra 5');
  assert.equal(rideHeadline(ride({ alightStop: quadra, arrivalAt: at(12) }), now), 'Chega em Quadra 5 em 12 min, por volta de 18:42');
  assert.equal(rideHeadline(ride({ alightStop: quadra, arrivalAt: at(0.5) }), now), 'Chegando em Quadra 5');
  assert.equal(minutesUntil(at(-3), now), 0);
  assert.equal(minutesUntil(null, now), null);
  assert.equal(rideHeadline(ride({ status: 'ended', endedReason: 'arrived', alightStop: quadra }), now), 'Chegou em Quadra 5');
  assert.equal(endedText(ride({ status: 'ended', endedReason: 'signal-lost' })), 'O GPS do ônibus parou de responder');
  assert.equal(endedText(ride({ status: 'ended', endedReason: 'owner' })), 'A viagem foi encerrada por quem compartilhou');
});

test('distance and position notes stay short and honest', () => {
  const now = Date.parse('2026-11-16T21:30:00Z');
  assert.equal(remainingText(2100), 'faltam 2,1 km');
  assert.equal(remainingText(347), 'faltam 350 m');
  assert.equal(remainingText(4), 'faltam 10 m');
  assert.equal(remainingText(null), null);
  const position = (secondsAgo: number) => ({ lat: -15.8, lng: -47.8, observedAt: new Date(now - secondsAgo * 1000).toISOString(), source: 'mobilibus' });
  assert.equal(ridePositionNote(ride({ position: position(10) }), now), null);
  assert.equal(ridePositionNote(ride({ position: position(180) }), now), 'Posição recebida há 3 min.');
  assert.match(ridePositionNote(ride({ position: position(10), offRoute: true }), now)!, /fora do trajeto/);
  assert.equal(ridePositionNote(ride(), now), 'Aguardando a posição do ônibus.');
  assert.equal(ridePositionNote(ride({ status: 'ended', position: position(900) }), now), null);
  assert.equal(rideShareText(ride({ alightStop: quadra })), 'Estou no ônibus 0.110 (veículo 12345), indo para Quadra 5. Acompanhe por aqui:');
});

test('the bus popup offers starting a ride only when asked to', () => {
  const vehicle = { vehicleId: '<b>7</b>', lat: -15.8, lng: -47.8, lineShortName: '0.110' } as never;
  assert.equal(vehiclePopup(vehicle, Date.now()).includes(START_RIDE_ATTRIBUTE), false);
  const html = vehiclePopup(vehicle, Date.now(), { canStartRide: true });
  assert.match(html, new RegExp(`<button type="button" ${START_RIDE_ATTRIBUTE}[^>]*>Estou neste ônibus</button>`));
  assert.equal(html.includes('<b>7</b>'), false);
});
