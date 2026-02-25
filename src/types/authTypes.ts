export type { User, Session } from "../db/schema";

export type GoogleUser = {
  id: string;
  name: string;
  email: string;
  verified_email?: boolean;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};
