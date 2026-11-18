import { route, jsonBody, HttpError } from "@/lib/server/http";
import { get, run, now } from "@/lib/server/db";
import { hashPassword, startSession, USERNAME_RE } from "@/lib/server/auth";

export const POST = route(async (req) => {
  const body = await jsonBody<{ email: string; name: string; username: string; password: string }>(req);
  const email = String(body.email ?? "").trim();
  const name = String(body.name ?? "").trim();
  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, "Enter a valid email address.");
  if (!USERNAME_RE.test(username))
    throw new HttpError(400, "Usernames can only use letters, numbers, underscores and periods.");
  if (password.length < 6) throw new HttpError(400, "Create a password at least 6 characters long.");
  if (get("SELECT 1 FROM users WHERE username = ?", username))
    throw new HttpError(409, "This username isn't available. Please try another.");
  if (get("SELECT 1 FROM users WHERE email = ?", email))
    throw new HttpError(409, "Another account is using the same email.");

  const { id } = run(
    "INSERT INTO users (username, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
    username,
    email,
    name,
    hashPassword(password),
    now(),
  );
  await startSession(id);
  return { ok: true };
});
