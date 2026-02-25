import { eq } from "drizzle-orm";
import { db } from "../db";
import { usersTable } from "../db";
import type { User } from "../db";
import { uuidv7 } from "uuidv7";

export const userRepository = {
  async findByGoogleSub(googleSub: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.googleSub, googleSub))
      .limit(1);

    return result[0];
  },

  async createWithGoogleSub(profile: {
    id: string;
    name: string;
    email: string;
  }): Promise<User> {
    const userId = uuidv7();

    const insertData = {
      id: userId,
      name: profile.name,
      email: profile.email,
      googleSub: profile.id,
    };

    const result = await db.insert(usersTable).values(insertData).returning();

    return result[0];
  },

  async findById(id: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    return result[0];
  },
};
