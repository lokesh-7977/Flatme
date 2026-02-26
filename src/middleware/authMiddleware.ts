import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { UnauthorizedError } from "../lib/errors";
import { verifyAccessToken } from "../lib/jwt";

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.replace("Bearer ", "") ?? getCookie(c, "accessToken");

  if (!token) {
    throw new UnauthorizedError("No token provided");
  }

  try {
    const { userId } = await verifyAccessToken(token);
    c.set("userId", userId);
    await next();
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError("Invalid token");
  }
}
