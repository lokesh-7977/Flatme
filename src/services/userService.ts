import type { Session, User } from "../db";
import { sessionRepository } from "../repositories/sessionRepository";
import type { UpdateUserInput } from "../repositories/userRepository";
import { userRepository } from "../repositories/userRepository";
import type { GoogleUser } from "../types/authTypes";

export const userService = {
  async getOrCreateFromGoogleProfile(googleProfile: GoogleUser): Promise<User> {
    const existing = await userRepository.findByGoogleSub(googleProfile.id);
    return existing ?? userRepository.createWithGoogleSub(googleProfile);
  },

  async getById(id: string): Promise<User | undefined> {
    return userRepository.findById(id);
  },

  async updateProfile(id: string, data: UpdateUserInput): Promise<User | undefined> {
    return userRepository.updateById(id, data);
  },

  async getSessions(userId: string): Promise<Session[]> {
    return sessionRepository.findUserSessions(userId);
  },

  async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    const session = await sessionRepository.findSessionById(sessionId);
    // Ensure the session belongs to the requesting user
    if (!session || session.userId !== userId) return false;
    await sessionRepository.deleteSession(sessionId);
    return true;
  },
};
