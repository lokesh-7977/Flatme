import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "../config/env";

const pool = new Pool({ connectionString: config.DATABASE_URL });

export const db = drizzle(pool);

// Re-export everything so all imports go through src/db
export * from "./auth";
