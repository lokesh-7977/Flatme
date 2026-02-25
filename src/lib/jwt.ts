import { SignJWT, jwtVerify } from "jose";
import { config } from "../config/env";

const JWT_SECRET = new TextEncoder().encode(config.JWT_SECRET);

// Access token: 1 hour
export async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({ userId, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(JWT_SECRET);
}

// Refresh token: 30 days
export async function signRefreshToken(userId: string, sessionId: string): Promise<string> {
  return new SignJWT({ userId, sessionId, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

export async function verifyAccessToken(token: string): Promise<{ userId: string }> {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  if (payload.type !== "access") throw new Error("Invalid token type");
  return { userId: payload.userId as string };
}

export async function verifyRefreshToken(
  token: string
): Promise<{ userId: string; sessionId: string }> {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  if (payload.type !== "refresh") throw new Error("Invalid token type");
  return {
    userId: payload.userId as string,
    sessionId: payload.sessionId as string,
  };
}
