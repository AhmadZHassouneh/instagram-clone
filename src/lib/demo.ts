// Static demo (GitHub Pages, NEXT_PUBLIC_DEMO=1): answers the app's API calls in the browser.
// Reads come from the snapshot in /demo-api (see scripts/demo-snapshot.mts). Sent messages, likes,
// saves and follows are remembered in this browser's localStorage and applied on top of the snapshot.
import { demoKey } from "./demo-key";

export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export class DemoError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const NOT_IN_DEMO = "This isn't available in the online demo.";

// ---- Snapshot files
const files = new Map<string, Promise<unknown | null>>();
function load<T>(key: string): Promise<T | null> {
  if (!files.has(key)) {
    files.set(
      key,
      fetch(`${BASE}/demo-api/${key}.json`)
        .then(async (r) => (r.ok ? JSON.parse((await r.text()).replaceAll('"/api/media/', `"${BASE}/media/`)) : null))
        .catch(() => null),
    );
  }
  // Callers get their own copy, so the overlay never mutates the cache.
  return files.get(key)!.then((d) => (d === null ? null : structuredClone(d))) as Promise<T | null>;
}

// ---- Browser storage (best effort: private mode or blocked storage just means nothing is kept)
function read<T>(name: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(`demo:${name}`) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function write(name: string, value: unknown) {
  try {
    localStorage.setItem(`demo:${name}`, JSON.stringify(value));
  } catch {}
}

type Flags = Record<string, boolean>;
type Msg = { id: number; senderId: number; kind: "text"; text: string; createdAt: number; post: null; invoice: null; voiceSeconds: null };

/** Applies this browser's likes, saves and follows to any posts/users inside a response. */
function overlay(data: unknown) {
  const likes = read<Flags>("likes", {});
  const saves = read<Flags>("saves", {});
  const follows = read<Flags>("follows", {});
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.media) && typeof o.liked === "boolean") {
      const want = likes[String(o.id)];
      if (want !== undefined && want !== o.liked) {
        o.likeCount = Math.max(0, (o.likeCount as number) + (want ? 1 : -1));
        o.liked = want;
      }
      const s = saves[String(o.id)];
      if (s !== undefined) o.saved = s;
    }
    if (typeof o.username === "string" && typeof o.isFollowing === "boolean") {
      const f = follows[o.username];
      if (f !== undefined && f !== o.isFollowing) {
        if (typeof o.followerCount === "number") o.followerCount += f ? 1 : -1;
        o.isFollowing = f;
      }
    }
    Object.values(o).forEach(walk);
  };
  walk(data);
  return data;
}

async function me() {
  return (await load<{ user: { id: number; username: string; name: string; avatar: string | null; verified: boolean } }>("me"))!.user;
}

// ---- GET
async function get(url: string): Promise<unknown> {
  const u = new URL(url, "http://demo.local");
  const p = u.pathname;

  if (p === "/api/search") {
    const q = (u.searchParams.get("q") ?? "").trim().replace(/^@/, "").toLowerCase();
    const all = (await load<{ username: string; name: string }[]>("_users")) ?? [];
    return overlay({ users: q ? all.filter((x) => x.username.toLowerCase().includes(q) || x.name.toLowerCase().includes(q)).slice(0, 50) : [] });
  }

  const thread = p.match(/^\/api\/conversations\/(\d+)\/messages$/);
  if (thread) {
    const d = await load<{ messages: Msg[]; ids: number[] }>(demoKey(url));
    if (!d) throw new DemoError(404, "This conversation isn't available.");
    const after = Number(u.searchParams.get("after")) || 0;
    const all = [...d.messages, ...read<Msg[]>(`msgs:${thread[1]}`, [])];
    return { ...d, messages: all.filter((m) => m.id > after), ids: all.map((m) => m.id) };
  }

  // Exact snapshot, else the same path without its query (e.g. ?include= on stories).
  const data = (await load(demoKey(url))) ?? (u.search ? await load(demoKey(p)) : null);
  if (data === null) throw new DemoError(404, NOT_IN_DEMO);

  if (p === "/api/conversations") {
    // Show the last message this browser sent in the inbox preview.
    const d = data as { conversations: { id: number; lastMessage: unknown }[] };
    for (const c of d.conversations) {
      const mine = read<Msg[]>(`msgs:${c.id}`, []).at(-1);
      if (mine) c.lastMessage = { text: mine.text, senderId: mine.senderId, createdAt: mine.createdAt, kind: "text" };
    }
  }
  return overlay(data);
}

// ---- Writes
async function send(method: string, url: string, body: unknown): Promise<unknown> {
  const p = new URL(url, "http://demo.local").pathname;
  const toggle = (store: string, id: string) => {
    write(store, { ...read<Flags>(store, {}), [id]: method !== "DELETE" });
    return { ok: true };
  };
  let m: RegExpMatchArray | null;

  if ((m = p.match(/^\/api\/posts\/(\d+)\/like$/))) return toggle("likes", m[1]);
  if ((m = p.match(/^\/api\/posts\/(\d+)\/save$/))) return toggle("saves", m[1]);
  if ((m = p.match(/^\/api\/users\/([^/]+)\/follow$/))) return toggle("follows", decodeURIComponent(m[1]));

  if ((m = p.match(/^\/api\/conversations\/(\d+)\/messages$/)) && method === "POST") {
    const text = String((body as { text?: string })?.text ?? "").trim();
    if (!text) throw new DemoError(400, "Write a message first.");
    const message: Msg = { id: Date.now(), senderId: (await me()).id, kind: "text", text, createdAt: Date.now(), post: null, invoice: null, voiceSeconds: null };
    write(`msgs:${m[1]}`, [...read<Msg[]>(`msgs:${m[1]}`, []), message]);
    return { message };
  }
  if ((m = p.match(/^\/api\/messages\/(\d+)$/)) && method === "DELETE") {
    const id = Number(m[1]);
    for (const k of Object.keys(localStorage).filter((k) => k.startsWith("demo:msgs:"))) {
      const name = k.slice("demo:".length);
      write(name, read<Msg[]>(name, []).filter((x) => x.id !== id));
    }
    return { ok: true };
  }
  if (p === "/api/conversations" && method === "POST") {
    const username = (body as { username?: string })?.username;
    const d = await load<{ conversations: { id: number; other: { username: string } }[] }>("conversations");
    const c = d?.conversations.find((x) => x.other.username === username);
    if (!c) throw new DemoError(400, "Starting new chats isn't available in the online demo.");
    return { id: c.id };
  }
  if ((m = p.match(/^\/api\/posts\/(\d+)\/comments$/)) && method === "POST") {
    const text = String((body as { text?: string })?.text ?? "").trim();
    const u = await me();
    return { comment: { id: Date.now(), text, createdAt: Date.now(), user: { ...u, isFollowing: false }, likeCount: 0, liked: false } };
  }

  // Logging in/out and small reactions just succeed; anything that uploads or edits data isn't possible offline.
  if (/^\/api\/(auth\/(login|logout|signup)|comments\/\d+(\/like)?|stories\/\d+\/view|notifications)$/.test(p)) return { ok: true };
  throw new DemoError(400, NOT_IN_DEMO);
}

export function demoApi(path: string, method: string, body: unknown): Promise<unknown> {
  return method === "GET" ? get(path) : send(method, path, body);
}
