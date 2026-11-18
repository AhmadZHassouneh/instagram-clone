// Static demo build (DEMO_EXPORT=1): build-time access to the snapshot in demo/ (see scripts/demo-snapshot.mts).
import fs from "node:fs";
import path from "node:path";
import type { Me } from "./types";

export const IS_DEMO_EXPORT = process.env.DEMO_EXPORT === "1";

type Manifest = {
  usernames: string[];
  postIds: number[];
  conversationIds: number[];
  storyUsernames: string[];
  highlightIds: number[];
};

const readJson = <T,>(file: string): T => JSON.parse(fs.readFileSync(path.join(process.cwd(), "demo", file), "utf8"));

/** The signed-in user of the snapshot, with media paths under the site's base path. */
export function demoMe(): Me {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const { user } = readJson<{ user: Me }>("api/me.json");
  return { ...user, avatar: user.avatar?.replace(/^\/api\/media\//, `${base}/media/`) ?? null };
}

/** Pages to pre-render for a dynamic route; none outside the demo build (they render on demand). */
export function demoParams(kind: "users" | "posts" | "conversations" | "stories" | "highlights" | "none"): Record<string, string>[] {
  if (!IS_DEMO_EXPORT) return [];
  if (kind === "none") return [{ id: "0" }]; // export needs at least one page; it just shows "not available"
  const m = readJson<Manifest>("manifest.json");
  switch (kind) {
    case "users":
      return m.usernames.map((username) => ({ username }));
    case "stories":
      return m.storyUsernames.map((username) => ({ username }));
    case "posts":
      return m.postIds.map((id) => ({ id: String(id) }));
    case "conversations":
      return m.conversationIds.map((id) => ({ id: String(id) }));
    case "highlights":
      return m.highlightIds.map((id) => ({ id: String(id) }));
  }
}
