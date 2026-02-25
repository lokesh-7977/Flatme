import { userRepository } from "../repositories/userRepository";
import type { User } from "../db/schema";
import type { GoogleUser } from "../types/authTypes";

export const userService = {
  async getOrCreateFromGoogleProfile(googleProfile: GoogleUser): Promise<User> {
    const existing = await userRepository.findByGoogleSub(googleProfile.id);
    return existing ?? userRepository.createWithGoogleSub(googleProfile);
  },

  async getById(id: string): Promise<User | undefined> {
    return userRepository.findById(id);
  },
};
