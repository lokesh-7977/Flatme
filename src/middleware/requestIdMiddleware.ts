import type { Context, Next } from "hono";
import { uuidv7 } from "uuidv7";

export async function requestIdMiddleware(c: Context, next: Next) {
  const id = c.req.header("x-request-id") ?? uuidv7();
  c.set("requestId", id);
  c.header("X-Request-ID", id);
  await next();
}
