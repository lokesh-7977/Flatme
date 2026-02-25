import { and, eq, lt } from "drizzle-orm";
import { db } from "../db";
import { sessionsTable } from "../db";
import type { Session } from "../db";
import { uuidv7 } from "uuidv7";

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

    const result = await db
      .insert(sessionsTable)
      .values({
        id: sessionId,
        userId,
        refreshToken,
        expiresAt,
        userAgent: metadata?.userAgent,
        ipAddress: metadata?.ipAddress,
      })
      .returning();

    return result[0];
  },

  /**
   * Atomically swaps the refresh token for a session.
   * Returns the updated session, or null if the (sessionId + oldToken) pair
   * was not found — which means the token was already rotated (reuse attack).
   */
  async rotateRefreshToken(
    sessionId: string,
    oldToken: string,
    newToken: string,
  ): Promise<Session | null> {
    const result = await db
      .update(sessionsTable)
      .set({ refreshToken: newToken, lastUsedAt: new Date() })
      .where(
        and(
          eq(sessionsTable.id, sessionId),
          eq(sessionsTable.refreshToken, oldToken),
        ),
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
    await db
      .delete(sessionsTable)
      .where(lt(sessionsTable.expiresAt, new Date()));
  },
};
