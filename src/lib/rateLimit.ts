/**
 * Lightweight sliding-window per-IP rate limiter for on-demand endpoints
 * (e.g. /api/point-inspect) to protect upstream APIs against scraping bursts.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 2000;

export function checkRateLimit(
  ip: string,
  limit = 60,
  windowMs = 60_000
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  if (buckets.size > MAX_KEYS) {
    for (const [k, v] of buckets.entries()) {
      if (now > v.resetAt) buckets.delete(k);
    }
  }

  const existing = buckets.get(ip);
  if (!existing || now > existing.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSec: 0,
  };
}
