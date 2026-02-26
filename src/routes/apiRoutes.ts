import { Hono } from "hono";
import { getMeHandler } from "../controllers/userController";
import { authMiddleware } from "../middleware/authMiddleware";

export const apiRoutes = new Hono();

apiRoutes.use("*", authMiddleware); // Apply middleware to all routes

apiRoutes.get("/me", getMeHandler);
