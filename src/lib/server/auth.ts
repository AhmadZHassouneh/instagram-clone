import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { get, run, now } from "./db";
import { HttpError } from "./http";

export const SESSION_COOKIE = "sg_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

export type UserRow = {
  id: number;
  username: string;
  email: string;
  name: string;
  bio: string;
  website: string;
  avatar: string | null;
  verified: number;
  created_at: number;
};

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === candidate.length && crypto.timingSafeEqual(candidate, expected);
}

export async function startSession(userId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  run("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)", token, userId, now());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) run("DELETE FROM sessions WHERE token = ?", token);
  store.delete(SESSION_COOKIE);
}

export async function currentUser(): Promise<UserRow | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return (
    get<UserRow>(
      `SELECT u.id, u.username, u.email, u.name, u.bio, u.website, u.avatar, u.verified, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`,
      token,
    ) ?? null
  );
}

export async function requireUser(): Promise<UserRow> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "You need to log in.");
  return user;
}

export const USERNAME_RE = /^[a-z0-9._]{1,30}$/;
