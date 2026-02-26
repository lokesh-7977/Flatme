import { createHash } from "node:crypto";

/**
 * Returns a SHA-256 hex digest of the input string.
 * Used to store refresh tokens in the DB without keeping the raw token value,
 * so a DB breach doesn't expose tokens that could be used to hijack sessions.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
