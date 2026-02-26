import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import {
  getMeHandler,
  getSessionsHandler,
  revokeSessionHandler,
  updateMeHandler,
} from "../controllers/userController";
import { authMiddleware } from "../middleware/authMiddleware";

export const apiRoutes = new Hono();

apiRoutes.use("*", authMiddleware);

const updateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  city: z.string().max(255).optional(),
  photo: z.string().url().max(500).optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
});

// User profile
apiRoutes.get("/me", getMeHandler);
apiRoutes.patch("/me", zValidator("json", updateProfileSchema), updateMeHandler);

// Session management
apiRoutes.get("/me/sessions", getSessionsHandler);
apiRoutes.delete("/me/sessions/:id", revokeSessionHandler);
