// Snapshots the running app (as one logged-in user) into demo/ for the static GitHub Pages build.
// Usage: start the app (npm run dev), then: npx tsx scripts/demo-snapshot.mts [--url http://localhost:3001] [--user dabos_print]
// Writes demo/api/**.json (API responses), demo/media/* (uploaded files they use) and demo/manifest.json.
import fs from "node:fs";
import path from "node:path";
import { demoKey } from "../src/lib/demo-key";

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const BASE = flag("url", "http://localhost:3001");
const USER = flag("user", "dabos_print");
const PASSWORD = flag("password", "password123");
const OUT = "demo";

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "api"), { recursive: true });
fs.mkdirSync(path.join(OUT, "media"), { recursive: true });

// ---- Log in
const login = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ login: USER, password: PASSWORD }),
});
if (!login.ok) throw new Error(`Login as ${USER} failed: ${login.status} ${await login.text()}`);
const cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

// ---- Fetch + save
const cache = new Map<string, unknown>();
const media = new Set<string>();
const missing: string[] = [];

async function get<T>(url: string): Promise<T | null> {
  const key = demoKey(url);
  if (cache.has(key)) return cache.get(key) as T;
  const res = await fetch(BASE + url, { headers: { cookie } });
  if (!res.ok) {
    missing.push(`${res.status} ${url}`);
    cache.set(key, null);
    return null;
  }
  const text = await res.text();
  for (const m of text.matchAll(/\/api\/media\/([\w.-]+)/g)) media.add(m[1]);
  const file = path.join(OUT, "api", `${key}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  const data = JSON.parse(text) as T;
  cache.set(key, data);
  return data;
}

type U = { id: number; username: string };
type P = { id: number; user: U };
type Posts = { posts: P[]; hasMore?: boolean };

const postIds = new Set<number>();
const addPosts = (d: Posts | null) => d?.posts.forEach((p) => postIds.add(p.id));

const me = (await get<{ user: U }>("/api/me"))!.user;
for (const url of ["/api/unread", "/api/notifications", "/api/stories/archive", "/api/suggestions?limit=5", "/api/suggestions?limit=15"]) await get(url);
addPosts(await get<Posts>("/api/explore"));
addPosts(await get<Posts>("/api/reels"));

// Feed: one fixed shuffle, every page.
for (let offset = 0; ; offset += 8) {
  const page = await get<Posts>(`/api/feed?seed=1&offset=${offset}`);
  addPosts(page);
  if (!page?.hasMore) break;
}

// Every user, found through search (usernames are ASCII).
const users = new Map<number, U>();
for (const ch of "abcdefghijklmnopqrstuvwxyz0123456789._") {
  const r = await get<{ users: U[] }>(`/api/search?q=${ch}`);
  r?.users.forEach((u) => users.set(u.id, u));
}
fs.writeFileSync(path.join(OUT, "api", "_users.json"), JSON.stringify([...users.values()]));

// Profiles and everything on them.
const highlightIds = new Set<number>();
const storyUsers = new Set<string>();
for (const u of users.values()) {
  const base = `/api/users/${u.username}`;
  const profile = await get<{ profile: { hasStory?: boolean } }>(base);
  if (profile?.profile.hasStory) storyUsers.add(u.username);
  const hl = await get<{ highlights: { id: number }[] }>(`${base}/highlights`);
  hl?.highlights.forEach((h) => highlightIds.add(h.id));
  for (const tab of ["posts", "reels", ...(u.id === me.id ? ["saved"] : [])]) addPosts(await get<Posts>(`${base}/posts?tab=${tab}`));
  await get(`${base}/followers`);
  await get(`${base}/following`);
  await get(`${base}/followers?mutual=1`);
}

// Stories: the home bar, each user's group, and the viewer list of each story.
const groups = await get<{ groups: { user: U; stories: { id: number }[] }[] }>("/api/stories");
groups?.groups.forEach((g) => storyUsers.add(g.user.username));
for (const name of storyUsers) {
  const r = await get<{ groups: { stories: { id: number }[] }[] }>(`/api/stories?include=${encodeURIComponent(name)}`);
  for (const g of r?.groups ?? []) for (const s of g.stories) await get(`/api/stories/${s.id}`);
}

for (const id of highlightIds) await get(`/api/highlights/${id}`);
for (const id of postIds) {
  await get(`/api/posts/${id}`);
  await get(`/api/posts/${id}/likes`);
}

const convs = await get<{ conversations: { id: number }[] }>("/api/conversations");
for (const c of convs?.conversations ?? []) await get(`/api/conversations/${c.id}/messages?after=0`);

// ---- Media + manifest
let copied = 0;
for (const name of media) {
  const src = path.join("uploads", name);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(OUT, "media", name));
    copied++;
  } else missing.push(`media ${name}`);
}
const manifest = {
  user: me.username,
  createdAt: new Date().toISOString(),
  usernames: [...users.values()].map((u) => u.username),
  postIds: [...postIds],
  conversationIds: (convs?.conversations ?? []).map((c) => c.id),
  storyUsernames: [...storyUsers],
  highlightIds: [...highlightIds],
};
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));

console.log(
  `Snapshot of ${BASE} as ${me.username}: ${cache.size} responses, ${users.size} users, ${postIds.size} posts, ` +
    `${manifest.conversationIds.length} chats, ${highlightIds.size} highlights, ${copied} media files.`,
);
if (missing.length) console.log(`Skipped ${missing.length}:\n  ${missing.slice(0, 20).join("\n  ")}`);
