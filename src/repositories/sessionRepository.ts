import { and, asc, eq, lt } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { config } from "../config/env";
import type { Session } from "../db";
import { db, sessionsTable } from "../db";
import { hashToken } from "../lib/hash";

export const sessionRepository = {
  async createSession(
    userId: string,
    refreshToken: string,
    metadata?: {
      sessionId?: string;
      userAgent?: string;
      ipAddress?: string;
    },
  ): Promise<Session> {
    const sessionId = metadata?.sessionId ?? uuidv7();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Enforce max sessions per user: delete oldest sessions beyond the limit.
    const existing = await db
      .select({ id: sessionsTable.id, createdAt: sessionsTable.createdAt })
      .from(sessionsTable)
      .where(eq(sessionsTable.userId, userId))
      .orderBy(asc(sessionsTable.createdAt));

    if (existing.length >= config.MAX_SESSIONS_PER_USER) {
      const toDelete = existing.slice(0, existing.length - config.MAX_SESSIONS_PER_USER + 1);
      for (const s of toDelete) {
        await db.delete(sessionsTable).where(eq(sessionsTable.id, s.id));
      }
    }

    const result = await db
      .insert(sessionsTable)
      .values({
        id: sessionId,
        userId,
        // Store only the hash — the raw token lives only in the signed JWT cookie.
        refreshToken: hashToken(refreshToken),
        expiresAt,
        userAgent: metadata?.userAgent,
        ipAddress: metadata?.ipAddress,
      })
      .returning();

    return result[0];
  },

  /**
   * Atomically swaps the refresh token for a session.
   * Compares hashed tokens so the DB never holds raw token values.
   * Returns the updated session, or null if the (sessionId + oldTokenHash) pair
   * was not found — which indicates a token reuse attack.
   */
  async rotateRefreshToken(
    sessionId: string,
    oldToken: string,
    newToken: string,
  ): Promise<Session | null> {
    const result = await db
      .update(sessionsTable)
      .set({ refreshToken: hashToken(newToken), lastUsedAt: new Date() })
      .where(
        and(eq(sessionsTable.id, sessionId), eq(sessionsTable.refreshToken, hashToken(oldToken))),
      )
      .returning();

    return result[0] ?? null;
  },

  async findSessionById(sessionId: string): Promise<Session | undefined> {
    const result = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId))
      .limit(1);

    return result[0];
  },

  async deleteSession(sessionId: string): Promise<void> {
    await db.delete(sessionsTable).where(eq(sessionsTable.id, sessionId));
  },

  async deleteUserSessions(userId: string): Promise<void> {
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
  },

  async deleteExpiredSessions(): Promise<void> {
    await db.delete(sessionsTable).where(lt(sessionsTable.expiresAt, new Date()));
  },
};
