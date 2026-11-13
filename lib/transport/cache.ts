import { get, set } from "idb-keyval";

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

function isValidCache<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  return Boolean(entry && entry.expiresAt > Date.now());
}

async function readPersistentCache<T>(key: string): Promise<T | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const entry = await get<CacheEntry<T>>(key);
    if (!isValidCache(entry)) {
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

async function writePersistentCache<T>(key: string, entry: CacheEntry<T>): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  try {
    await set(key, entry);
  } catch {
    // Ignore persistence failures and keep in-memory cache working.
  }
}

export async function getOrSetCache<T>(
  key: string,
  ttlMs: number,
  producer: () => Promise<T>
): Promise<T> {
  const memoryEntry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (isValidCache(memoryEntry)) {
    return memoryEntry.data;
  }

  const persistentData = await readPersistentCache<T>(key);
  if (persistentData !== null) {
    memoryCache.set(key, {
      data: persistentData,
      expiresAt: Date.now() + ttlMs,
    });
    return persistentData;
  }

  const freshData = await producer();
  const entry: CacheEntry<T> = {
    data: freshData,
    expiresAt: Date.now() + ttlMs,
  };

  memoryCache.set(key, entry);
  await writePersistentCache(key, entry);

  return freshData;
}
