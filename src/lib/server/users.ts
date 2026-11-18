import "server-only";
import { get } from "./db";
import { HttpError } from "./http";

export function userIdByUsername(username: string) {
  const u = get<{ id: number }>("SELECT id FROM users WHERE username = ?", decodeURIComponent(username));
  if (!u) throw new HttpError(404, "Sorry, this page isn't available.");
  return u.id;
}
