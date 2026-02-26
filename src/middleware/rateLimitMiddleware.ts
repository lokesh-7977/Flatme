import type { Context, Next } from "hono";

interface WindowEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, WindowEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 60_000);

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  keyGenerator?: (c: Context) => string;
  message?: string;
}

export function rateLimit(opts: RateLimitOptions) {
  const { limit, windowMs, message = "Too many requests, please try again later." } = opts;

  const keyOf =
    opts.keyGenerator ??
    ((c) => {
      const forwarded = c.req.header("x-forwarded-for");
      return forwarded?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? "unknown";
    });

  return async function rateLimitMiddleware(c: Context, next: Next) {
    const key = keyOf(c);
    const now = Date.now();

    let entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 1, resetAt: now + windowMs };
      store.set(key, entry);
    } else {
      entry.count += 1;
    }

    const remaining = Math.max(0, limit - entry.count);
    const resetSecs = Math.ceil((entry.resetAt - now) / 1000);

    c.header("X-RateLimit-Limit", String(limit));
    c.header("X-RateLimit-Remaining", String(remaining));
    c.header("X-RateLimit-Reset", String(resetSecs));

    if (entry.count > limit) {
      c.header("Retry-After", String(resetSecs));
      return c.json({ error: message, code: "RATE_LIMITED" }, 429);
    }

    await next();
  };
}
