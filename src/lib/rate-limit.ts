/**
 * In-memory sliding-window rate limiter.
 * Works correctly for single-instance deployments (local dev, Docker).
 * For Vercel/serverless multi-instance production, replace with Upstash Redis:
 *   https://github.com/upstash/ratelimit-js
 */

interface Entry {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

// Prune expired entries periodically to prevent memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, 60_000);
}

function check(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

export const rateLimiters = {
  /** General API — 120 req / 60 s */
  api:    (key: string) => check(`api:${key}`,    120, 60_000),
  /** Auth endpoints — 10 req / 60 s (brute-force protection) */
  auth:   (key: string) => check(`auth:${key}`,    10, 60_000),
  /** File uploads — 30 req / 60 s */
  upload: (key: string) => check(`upload:${key}`,  30, 60_000),
  /** Public form submissions — 20 req / 60 s per IP */
  form:   (key: string) => check(`form:${key}`,    20, 60_000),
};
