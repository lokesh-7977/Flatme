import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { pgTable, varchar, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { config } from "../config/env";

const pool = new Pool({ connectionString: config.DATABASE_URL });
export const db = drizzle(pool);

// ── Schema ───────────────────────────────────────────────────────────────────

export const genderEnum = pgEnum("gender", ["male", "female", "other"]);

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  googleSub: varchar("google_sub", { length: 255 }).notNull().unique(),
  city: varchar("city", { length: 255 }),
  photo: varchar("photo", { length: 500 }),
  gender: genderEnum("gender"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sessionsTable = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  refreshToken: text("refresh_token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at").defaultNow().notNull(),
  userAgent: varchar("user_agent", { length: 500 }),
  ipAddress: varchar("ip_address", { length: 45 }),
});

export type User = typeof usersTable.$inferSelect;
export type Session = typeof sessionsTable.$inferSelect;
