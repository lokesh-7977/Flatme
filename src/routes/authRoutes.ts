import { googleAuth } from "@hono/oauth-providers/google";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { config } from "../config/env";
import {
  googleAuthHandler,
  googleCallbackHandler,
  logoutHandler,
  refreshTokenHandler,
} from "../controllers/authController";
import { rateLimit } from "../middleware/rateLimitMiddleware";

export const authRoutes = new Hono();

const googleAuthConfig = {
  client_id: config.GOOGLE_CLIENT_ID,
  client_secret: config.GOOGLE_CLIENT_SECRET,
  scope: ["openid", "email", "profile"] as string[],
  redirect_uri: config.GOOGLE_REDIRECT_URI,
};

// Validate the refresh token cookie is present before hitting the handler
const refreshCookieSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken cookie is required"),
});

// Rate limits — keyed by IP
const authInitLimit = rateLimit({ limit: 20, windowMs: 15 * 60 * 1000 }); // 20 OAuth initiations / 15 min
const refreshLimit = rateLimit({ limit: 30, windowMs: 15 * 60 * 1000 }); // 30 refresh calls / 15 min
const logoutLimit = rateLimit({ limit: 20, windowMs: 15 * 60 * 1000 }); // 20 logout calls / 15 min

authRoutes.get("/google", authInitLimit, googleAuth(googleAuthConfig), googleAuthHandler);

authRoutes.get(
  "/google/callback",
  authInitLimit,
  googleAuth(googleAuthConfig),
  googleCallbackHandler,
);

authRoutes.post(
  "/refresh",
  refreshLimit,
  zValidator("cookie", refreshCookieSchema),
  refreshTokenHandler,
);

authRoutes.post("/logout", logoutLimit, logoutHandler);
