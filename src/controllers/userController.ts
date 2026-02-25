import { Context } from "hono";
import { userService } from "../services/userService";
import { UnauthorizedError, NotFoundError } from "../lib/errors";

export async function getMeHandler(c: Context) {
  const userId = c.get("userId") as string | undefined;

  if (!userId) {
    throw new UnauthorizedError();
  }

  const user = await userService.getById(userId);

  if (!user) {
    throw new NotFoundError("User not found");
  }

  const { googleSub: _, ...safeUser } = user;

  return c.json({ user: safeUser });
}
