import test from 'node:test';
import assert from 'node:assert/strict';
import { CachedSource, type ByteStore, type StoredRange } from '../lib/map/cached-source.ts';

function memoryStore(): ByteStore & { map: Map<string, StoredRange> } {
  const map = new Map<string, StoredRange>();
  return {
    map,
    get: async (key) => map.get(key),
    set: async (key, value) => { map.set(key, value); },
    clear: async () => { map.clear(); },
  };
}

function fakeNetwork(etag = 'v1') {
  const calls: string[] = [];
  let online = true;
  let currentEtag = etag;
  return {
    calls,
    setOnline: (value: boolean) => { online = value; },
    setEtag: (value: string) => { currentEtag = value; },
    source: {
      getKey: () => 'https://example.test/df.pmtiles',
      getBytes: async (offset: number, length: number) => {
        calls.push(`${offset}:${length}`);
        if (!online) throw new TypeError('Failed to fetch');
        return { data: new Uint8Array([offset % 256, length % 256]).buffer, etag: currentEtag };
      },
    },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test('ranges are fetched once and then served from the store', async () => {
  const store = memoryStore();
  const net = fakeNetwork();
  const source = new CachedSource('https://example.test/df.pmtiles', store, net.source);
  await source.getBytes(1000, 50);
  await flush();
  await source.getBytes(1000, 50);
  assert.deepEqual(net.calls, ['1000:50']);
  assert.equal(store.map.size, 1);
});

test('offline, stored header and tiles keep the map working', async () => {
  const store = memoryStore();
  const net = fakeNetwork();
  const source = new CachedSource('https://example.test/df.pmtiles', store, net.source);
  await source.getBytes(0, 16384);
  await source.getBytes(2000, 10);
  await flush();
  net.setOnline(false);
  const header = await source.getBytes(0, 16384);
  assert.deepEqual([...new Uint8Array(header.data)], [0, 0]);
  await source.getBytes(2000, 10);
  await assert.rejects(source.getBytes(3000, 10), TypeError);
});

test('a new archive version clears the old ranges', async () => {
  const store = memoryStore();
  const net = fakeNetwork('v1');
  const source = new CachedSource('https://example.test/df.pmtiles', store, net.source);
  await source.getBytes(0, 16384);
  await source.getBytes(2000, 10);
  await flush();
  net.setEtag('v2');
  await source.getBytes(0, 16384);
  await flush();
  assert.deepEqual([...store.map.keys()], ['0:16384']);
  assert.equal(store.map.get('0:16384')?.etag, 'v2');
});

test('stored data survives the original buffer being detached', async () => {
  const store = memoryStore();
  const net = fakeNetwork();
  const source = new CachedSource('https://example.test/df.pmtiles', store, net.source);
  const response = await source.getBytes(500, 20);
  structuredClone(response.data, { transfer: [response.data] });
  await flush();
  assert.equal(store.map.get('500:20')?.data.byteLength, 2);
});
