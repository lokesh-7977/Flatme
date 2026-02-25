import { Hono } from "hono";
import { googleAuth } from "@hono/oauth-providers/google";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { config } from "../config/env";
import {
  googleAuthHandler,
  googleCallbackHandler,
  refreshTokenHandler,
  logoutHandler,
} from "../controllers/authController";

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

authRoutes.get("/google", googleAuth(googleAuthConfig), googleAuthHandler);

authRoutes.get(
  "/google/callback",
  googleAuth(googleAuthConfig),
  googleCallbackHandler
);

authRoutes.post(
  "/refresh",
  zValidator("cookie", refreshCookieSchema),
  refreshTokenHandler
);

authRoutes.post("/logout", logoutHandler);
