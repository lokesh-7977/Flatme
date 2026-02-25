import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { authRoutes } from "./routes/authRoutes";
import { apiRoutes } from "./routes/apiRoutes";
import { AppError } from "./lib/errors";
import { IS_PROD } from "./config/env";

const app = new Hono();

// ── Global error handler ────────────────────────────────────────────────────
app.onError((err, c) => {
  // Hono validation / HTTP exceptions
  if (err instanceof HTTPException) {
    return c.json({ error: err.message, code: "HTTP_ERROR" }, err.status);
  }

  // Zod validation failures (from zValidator middleware)
  if (err instanceof ZodError) {
    return c.json(
      { error: "Validation failed", issues: err.flatten().fieldErrors },
      400
    );
  }

  // Our typed application errors
  if (err instanceof AppError) {
    return c.json({ error: err.message, code: err.code }, err.statusCode as any);
  }

  // Unknown errors — hide detail in production
  console.error("[unhandled]", err);
  return c.json(
    {
      error: IS_PROD ? "Internal server error" : (err as Error).message,
      code: "INTERNAL_ERROR",
    },
    500
  );
});

// ── Routes ──────────────────────────────────────────────────────────────────
app.use("/*", serveStatic({ root: "./src/public" }));
app.get("/", serveStatic({ path: "./src/public/index.html" }));

app.route("/auth", authRoutes);
app.route("/api", apiRoutes);

export default app;
