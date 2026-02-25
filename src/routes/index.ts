import { Hono } from "hono";
import { authMiddleware } from "../middleware/authMiddleware";
import { getMeHandler } from "../controllers/userController";

export const apiRoutes = new Hono();

apiRoutes.use(authMiddleware);

apiRoutes.get("/me", getMeHandler);
