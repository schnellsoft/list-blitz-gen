import type { BoardData, LoadResult, LoadSource, Strategy } from "./types.ts";

export const CACHE_NAME = "harbor-board-v1";
export const DATA_PATH = "/data/items.json";
export const STRATEGY_KEY = "harbor-board-strategy";

let memoryCopy: BoardData | null = null;

function dataUrl(): URL {
  return new URL(DATA_PATH, location.origin);
}

function request(): Request {
  return new Request(dataUrl(), { cache: "no-store" });
}

async function openCache(): Promise<Cache | null> {
  if (!("caches" in window)) return null;
  return caches.open(CACHE_NAME);
}

async function readCached(cache: Cache | null): Promise<BoardData | null> {
  if (!cache) return memoryCopy;
  const hit = await cache.match(request());
  if (!hit) return memoryCopy;
  try {
    const data = (await hit.json()) as BoardData;
    memoryCopy = data;
    return data;
  } catch {
    return memoryCopy;
  }
}

async function fetchAndStore(cache: Cache | null): Promise<BoardData> {
  const response = await fetch(request());
  if (!response.ok) {
    throw new Error(`Board JSON failed (${response.status})`);
  }
  if (cache) {
    await cache.put(request(), response.clone());
  }
  const data = (await response.json()) as BoardData;
  memoryCopy = data;
  return data;
}

export async function loadBoard(strategy: Strategy): Promise<LoadResult> {
  const started = performance.now();
  const cache = await openCache();
  const cached = await readCached(cache);
  const source: LoadSource = cache ? "cache" : "memory";

  if (cached) {
    const durationMs = performance.now() - started;
    if (strategy === "swr") {
      return {
        data: cached,
        source,
        durationMs,
        background: fetchAndStore(cache).catch(() => null),
      };
    }
    return { data: cached, source, durationMs };
  }

  const data = await fetchAndStore(cache);
  return {
    data,
    source: "network",
    durationMs: performance.now() - started,
  };
}

export async function clearBoardCache(): Promise<void> {
  memoryCopy = null;
  if ("caches" in window) {
    await caches.delete(CACHE_NAME);
  }
}

export function readStrategy(): Strategy {
  const stored = localStorage.getItem(STRATEGY_KEY);
  return stored === "cache-first" ? "cache-first" : "swr";
}

export function writeStrategy(strategy: Strategy): void {
  localStorage.setItem(STRATEGY_KEY, strategy);
}

export function cacheApiAvailable(): boolean {
  return "caches" in window;
}
