// A PMTiles source that keeps every byte range it has fetched, so map areas already seen
// keep working without a connection.
import { FetchSource, type RangeResponse, type Source } from "pmtiles";

export interface StoredRange {
  data: ArrayBuffer;
  etag?: string;
}

export interface ByteStore {
  get(key: string): Promise<StoredRange | undefined>;
  set(key: string, value: StoredRange): Promise<void>;
  clear(): Promise<void>;
}

const quietly = <T>(promise: Promise<T>) => promise.catch(() => undefined);

export class CachedSource implements Source {
  private readonly url: string;
  private readonly store: ByteStore;
  private readonly inner: Source;

  constructor(url: string, store: ByteStore, inner?: Source) {
    this.url = url;
    this.store = store;
    this.inner = inner ?? new FetchSource(url);
  }

  getKey(): string {
    return this.url;
  }

  async getBytes(offset: number, length: number, signal?: AbortSignal, etag?: string): Promise<RangeResponse> {
    const key = `${offset}:${length}`;

    // The header is read network-first: a new archive (different ETag) invalidates every stored range.
    if (offset === 0) {
      try {
        const fresh = await this.inner.getBytes(offset, length, signal, etag);
        const previous = await quietly(this.store.get(key));
        if (previous?.etag && fresh.etag && previous.etag !== fresh.etag) await quietly(this.store.clear());
        this.remember(key, fresh);
        return fresh;
      } catch (error) {
        if (signal?.aborted) throw error;
        const stored = await quietly(this.store.get(key));
        if (stored) return { data: stored.data, etag: stored.etag };
        throw error;
      }
    }

    const stored = await quietly(this.store.get(key));
    if (stored && (!etag || !stored.etag || stored.etag === etag)) return { data: stored.data, etag: stored.etag };
    const fresh = await this.inner.getBytes(offset, length, signal, etag);
    this.remember(key, fresh);
    return fresh;
  }

  private remember(key: string, response: RangeResponse) {
    // Copied now: the map hands the original buffer to its worker, which detaches it.
    void quietly(this.store.set(key, { data: response.data.slice(0), etag: response.etag }));
  }
}

/** IndexedDB-backed store that keeps the most recently used ranges, up to a limit. */
export async function createIndexedDbByteStore(maxEntries = 3000): Promise<ByteStore> {
  const { createStore, get, set, del, delMany, entries, clear } = await import("idb-keyval");
  const ranges = createStore("antiwalk-map", "ranges");
  const used = createStore("antiwalk-map-used", "at");
  let writes = 0;

  const prune = async () => {
    const all = await entries<string, number>(used);
    if (all.length <= maxEntries) return;
    const oldest = all.sort((a, b) => a[1] - b[1]).slice(0, all.length - maxEntries).map(([key]) => key);
    await delMany(oldest, ranges);
    await delMany(oldest, used);
  };

  return {
    async get(key) {
      const value = await get<StoredRange>(key, ranges);
      if (value) void quietly(set(key, Date.now(), used));
      else void quietly(del(key, used));
      return value;
    },
    async set(key, value) {
      await set(key, value, ranges);
      await set(key, Date.now(), used);
      if (++writes % 50 === 0) void quietly(prune());
    },
    async clear() {
      await clear(ranges);
      await clear(used);
    },
  };
}
