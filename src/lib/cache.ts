import type { DataSourceStatus } from "@/types/telemetry";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  staleUntil: number;
  updatedAt: string;
}

/**
 * High-concurrency 3-tier cache:
 * L1: In-memory Singleflight + SWR per serverless instance
 * L2: Optional Upstash Redis REST distributed cache (when UPSTASH_REDIS_REST_URL/TOKEN set)
 * L3: Vercel Edge CDN (`s-maxage` + `stale-while-revalidate`)
 */
const store = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

const MAX_ENTRIES = 600;

function pruneStoreIfNeeded() {
  if (store.size <= MAX_ENTRIES) return;
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (now > v.staleUntil) {
      store.delete(k);
    }
  }
  while (store.size > MAX_ENTRIES * 0.8) {
    const oldestKey = store.keys().next().value;
    if (!oldestKey) break;
    store.delete(oldestKey);
  }
}

async function redisGet<T>(key: string): Promise<{ value: T; updatedAt: string } | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1800);
    const res = await fetch(`${url.replace(/\/$/, "")}/get/${encodeURIComponent(`tp:${key}`)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: string | null };
    if (!json.result) return null;
    return JSON.parse(json.result) as { value: T; updatedAt: string };
  } catch {
    return null;
  }
}

async function redisSet<T>(key: string, value: T, updatedAt: string, ttlSeconds: number): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  try {
    const body = JSON.stringify({ value, updatedAt });
    // Avoid writing huge >800KB payloads into Redis REST
    if (body.length > 800_000) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    await fetch(
      `${url.replace(/\/$/, "")}/set/${encodeURIComponent(`tp:${key}`)}?EX=${Math.max(30, ttlSeconds)}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
        signal: controller.signal,
      }
    );
    clearTimeout(timer);
  } catch {
    // Non-blocking distributed cache write
  }
}

export async function cachedFetch<T>(options: {
  key: string;
  ttlSeconds: number;
  staleSeconds: number;
  fetcher: () => Promise<T>;
  fallback: () => T;
}): Promise<{
  data: T;
  status: DataSourceStatus;
  updatedAt: string;
  latencyMs: number;
}> {
  const { key, ttlSeconds, staleSeconds, fetcher, fallback } = options;
  const now = Date.now();
  const existing = store.get(key) as CacheEntry<T> | undefined;

  // L1 Fresh in-memory hit
  if (existing && now < existing.expiresAt) {
    return {
      data: existing.value,
      status: "cached",
      updatedAt: existing.updatedAt,
      latencyMs: 0,
    };
  }

  // L2 Optional Upstash Redis distributed hit (protects cold starts & data.go.kr quota!)
  const started = Date.now();
  const redisHit = await redisGet<T>(key);
  if (redisHit) {
    pruneStoreIfNeeded();
    store.set(key, {
      value: redisHit.value,
      expiresAt: Date.now() + ttlSeconds * 1000,
      staleUntil: Date.now() + (ttlSeconds + staleSeconds) * 1000,
      updatedAt: redisHit.updatedAt,
    });
    return {
      data: redisHit.value,
      status: "cached",
      updatedAt: redisHit.updatedAt,
      latencyMs: Date.now() - started,
    };
  }

  // Singleflight deduplication
  let promise = inFlight.get(key) as Promise<T> | undefined;
  if (!promise) {
    promise = fetcher()
      .then((value) => {
        const updatedAt = new Date().toISOString();
        pruneStoreIfNeeded();
        store.set(key, {
          value,
          expiresAt: Date.now() + ttlSeconds * 1000,
          staleUntil: Date.now() + (ttlSeconds + staleSeconds) * 1000,
          updatedAt,
        });
        void redisSet(key, value, updatedAt, ttlSeconds);
        return value;
      })
      .finally(() => {
        inFlight.delete(key);
      });
    inFlight.set(key, promise);
  }

  try {
    const data = await promise;
    const entry = store.get(key) as CacheEntry<T> | undefined;
    return {
      data,
      status: "live",
      updatedAt: entry?.updatedAt ?? new Date().toISOString(),
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    console.warn(`[cachedFetch:${key}] upstream failed:`, err instanceof Error ? err.message : err);
    if (existing && now < existing.staleUntil) {
      return {
        data: existing.value,
        status: "stale",
        updatedAt: existing.updatedAt,
        latencyMs: Date.now() - started,
      };
    }
    return {
      data: fallback(),
      status: "fallback",
      updatedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    };
  }
}

export function buildCdnHeaders(
  sMaxAge: number,
  staleWhileRevalidate: number,
  cacheStatus?: DataSourceStatus
): HeadersInit {
  const mapStatus: Record<DataSourceStatus, string> = {
    cached: "HIT",
    live: "MISS",
    stale: "STALE",
    fallback: "FALLBACK",
  };
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": `public, max-age=15, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    "CDN-Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    "Vercel-CDN-Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    "X-TerraPulse-Cache": cacheStatus ? mapStatus[cacheStatus] : "CDN",
  };
}
