import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { ZodError, z } from "zod";
import { config, IS_PROD } from "./config/env";
import { pool } from "./db";
import { AppError } from "./lib/errors";
import { logger } from "./lib/logger";
import { requestIdMiddleware } from "./middleware/requestIdMiddleware";
import { apiRoutes } from "./routes/apiRoutes";
import { authRoutes } from "./routes/authRoutes";

const app = new Hono();

app.use("*", secureHeaders());

app.use(
  "*",
  cors({
    origin: config.CORS_ORIGIN === "*" ? "*" : config.CORS_ORIGIN.split(",").map((o) => o.trim()),
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 600,
  }),
);

app.use("*", requestIdMiddleware);

app.get("/health", async (c) => {
  let dbStatus: "connected" | "disconnected" = "disconnected";
  try {
    await pool.query("SELECT 1");
    dbStatus = "connected";
  } catch {
    dbStatus = "disconnected";
  }

  const status = dbStatus === "connected" ? "ok" : "degraded";

  return c.json(
    {
      status,
      timestamp: new Date().toISOString(),
      service: {
        name: "Flatme API",
        version: "1.0.0",
        environment: config.NODE_ENV,
        uptime: Math.floor(process.uptime()),
        port: config.PORT,
      },
      db: { status: dbStatus },
    },
    status === "ok" ? 200 : 503,
  );
});

app.onError((err, c) => {
  const requestId = c.get("requestId");

  if (err instanceof HTTPException) {
    return c.json({ error: err.message, code: "HTTP_ERROR", requestId }, err.status);
  }

  if (err instanceof ZodError) {
    return c.json({ error: "Validation failed", issues: z.treeifyError(err), requestId }, 400);
  }

  if (err instanceof AppError) {
    return c.json({ error: err.message, code: err.code, requestId }, err.statusCode);
  }

  logger.error("Unhandled error", {
    requestId,
    error: (err as Error).message,
    stack: (err as Error).stack,
  });
  return c.json(
    {
      error: IS_PROD ? "Internal server error" : (err as Error).message,
      code: "INTERNAL_ERROR",
      requestId,
    },
    500,
  );
});

app.get("/", (c) => c.json({ name: "Flatme API", version: "1.0.0" }));

app.route("/auth", authRoutes);
app.route("/api", apiRoutes);

// ── Server startup ───────────────────────────────────────────────────────────
const server = Bun.serve({ fetch: app.fetch, port: config.PORT });
logger.info(`Server listening on http://localhost:${config.PORT}`);

// ── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown(signal: string) {
  logger.info(`${signal} received — shutting down gracefully`);
  server.stop(true);
  await pool.end().catch(() => {});
  logger.info("Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default app;
