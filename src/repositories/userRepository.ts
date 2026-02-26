import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import type { User } from "../db";
import { db, usersTable } from "../db";

export type UpdateUserInput = Partial<Pick<User, "name" | "city" | "photo" | "gender">>;

export const userRepository = {
  async findByGoogleSub(googleSub: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.googleSub, googleSub))
      .limit(1);

    return result[0];
  },

  async createWithGoogleSub(profile: { id: string; name: string; email: string }): Promise<User> {
    const userId = uuidv7();

    const result = await db
      .insert(usersTable)
      .values({ id: userId, name: profile.name, email: profile.email, googleSub: profile.id })
      .returning();

    return result[0];
  },

  async findById(id: string): Promise<User | undefined> {
    const result = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);

    return result[0];
  },

  async updateById(id: string, data: UpdateUserInput): Promise<User | undefined> {
    const result = await db
      .update(usersTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(usersTable.id, id))
      .returning();

    return result[0];
  },
};
