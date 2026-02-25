import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "../config/env";

const pool = new Pool({ connectionString: config.DATABASE_URL });
export const db = drizzle(pool);

// All schema re-exported so app imports only ever use ../db
export * from "./schema";
