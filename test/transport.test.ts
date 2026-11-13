import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { positionQuality, positionAgeLabel, isUsableRouteCache } from '../lib/transport/quality.ts';
import { normalizeMetroRealtime, parseActiveTrains } from '../lib/transport/metro-data.ts';

const now = Date.parse('2026-10-01T13:00:00Z');
const vehicle = (age: number) => ({ vehicleId:'1',lat:-15.8,lng:-47.8,observedAt:new Date(now-age).toISOString() });
test('a idade da posição não é rejuvenescida pelo recebimento da mensagem', () => {
  assert.equal(positionQuality(vehicle(44000),now),'fresh');
  assert.equal(positionQuality({...vehicle(60000),fetchedAt:new Date(now).toISOString()},now),'stale');
  assert.equal(positionQuality(vehicle(121000),now),'expired');
  assert.equal(positionQuality(vehicle(-120000),now),'unknown');
  assert.equal(positionQuality({...vehicle(0),observedAt:'invalid'},now),'unknown');
  assert.match(positionAgeLabel(vehicle(-120000),now),/não confirmado/);
});
test('cache expirado ou corrompido não fornece um itinerário válido', () => {
  const data = {route:{routeId:1},trips:[]};
  assert.equal(isUsableRouteCache({data,expiresAt:now+1000},now),true);
  for(const entry of [null,{data,expiresAt:now},{data,expiresAt:Infinity},{data:{},expiresAt:now+1000}]) assert.equal(isUsableRouteCache(entry,now),false);
});
test('mensagens reais de plataformas do metrô são normalizadas antes de desenhar trens', () => {
  const raw = [{station:'CTL',platform:'1',lista:'2,C,99,,,C;4,S,100,,,S;invalid,C,5,,,C',fetchedAt:new Date(now).toISOString()},
    {station:'GAL',platform:'1',lista:'4,C,99,,,C',fetchedAt:new Date(now).toISOString()}];
  const arrivals = normalizeMetroRealtime(raw);
  assert.equal(arrivals.length,3);
  assert.equal(arrivals[0].destino_final,'Terminal Ceilândia');
  assert.equal(arrivals[1].destino_final,'Terminal Samambaia');
  const trains = parseActiveTrains(arrivals);
  assert.equal(trains.length,2);
  assert.equal(trains.find(t=>t.id==='99')?.nextStationCode,'CTL');
  assert.ok(trains.every(t=>Number.isFinite(t.lat)&&Number.isFinite(t.lng)));
});
test('o cache offline não intercepta conexões ao vivo ou módulos de desenvolvimento', async () => {
  const handlers = new Map();
  const source = await fs.readFile(new URL('../public/sw.js',import.meta.url),'utf8');
  vm.runInNewContext(source,{URL, self:{location:{origin:'http://localhost:3001'},addEventListener:(type: string,fn: Function)=>handlers.set(type,fn)}});
  for(const url of ['http://localhost:3000/api/monitor/sse/1','http://localhost:3001/api/monitor/sse/1','https://tiles.openfreemap.org/tile/1','http://localhost:3001/@vite/client','http://localhost:3001/?_rsc=1']) {
    let intercepted = false;
    handlers.get('fetch')({request:{method:'GET',url,mode:'cors'},respondWith:()=>{intercepted=true;}});
    assert.equal(intercepted,false,url);
  }
});
