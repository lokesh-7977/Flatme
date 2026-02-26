import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { ZodError, z } from "zod";
import { config, IS_PROD } from "./config/env";
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

app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

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

app.use("/*", serveStatic({ root: "./src/public" }));
app.get("/", serveStatic({ path: "./src/public/index.html" }));

app.route("/auth", authRoutes);
app.route("/api", apiRoutes);

export default app;
