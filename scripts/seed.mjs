// Fills the database with demo users, posts, reels, stories, comments and messages.
// Usage: npm run seed   (this wipes existing data)
import crypto from "node:crypto";
import { openDatabase } from "../db/migrate.mjs";
import { refuseInProduction } from "./lib/env-guard.mjs";

refuseInProduction("npm run seed");
const db = openDatabase();

for (const t of [
  "invoice_items", "invoices", "order_items", "orders",
  "notifications", "messages", "conversation_members", "conversations", "story_views", "stories",
  "follows", "comment_likes", "comments", "saves", "likes", "post_media", "posts", "sessions", "users",
]) db.exec(`DELETE FROM ${t}`);
db.exec("DELETE FROM sqlite_sequence");

const hash = (pw) => {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(pw, salt, 64).toString("hex")}`;
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sample = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
const HOUR = 3600_000;
const NOW = Date.now();
const ago = (hours) => NOW - Math.round(hours * HOUR);

const insert = (sql, ...args) => Number(db.prepare(sql).run(...args).lastInsertRowid);

// ---- users ----
const people = [
  ["demo", "Demo User", "Just testing Instagram ✨", 12, 0],
  ["natgeo_fan", "Nature Lover", "🌍 Exploring the planet one photo at a time", 32, 1],
  ["lena.travels", "Lena Fischer", "Travel • Coffee • Film photography\n📍 Berlin", 5, 0],
  ["marco_eats", "Marco Rossi", "Food is my love language 🍝", 13, 0],
  ["sara.design", "Sara Kim", "Product designer. Minimalist.", 9, 1],
  ["omar.fit", "Omar Haddad", "Coach 🏋️ | DM for programs", 51, 0],
  ["julia_art", "Julia Moreau", "Painter & illustrator 🎨", 44, 0],
  ["techwithtom", "Tom Becker", "I make videos about gadgets", 57, 1],
  ["aya.music", "Aya Tanaka", "🎹 pianist | new single out now", 47, 0],
  ["dev.daniel", "Daniel Park", "Software engineer. Building things.", 60, 0],
  ["mia.photo", "Mia Johnson", "📷 street & portraits", 25, 0],
];
const users = {};
for (const [username, name, bio, img, verified] of people) {
  users[username] = insert(
    `INSERT INTO users (username, email, name, password_hash, bio, website, avatar, verified, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    username, `${username.replace(/\./g, "")}@example.com`, name, hash("password123"), bio,
    username === "demo" ? "" : `${username.replace(/[._]/g, "")}.com`,
    `https://i.pravatar.cc/300?img=${img}`, verified, ago(24 * 200),
  );
}
const ids = Object.values(users);
const others = ids.filter((id) => id !== users.demo);

// ---- follows ----
for (const a of ids) {
  for (const b of ids) {
    if (a === b) continue;
    const chance = a === users.demo ? (b === users["dev.daniel"] || b === users["mia.photo"] ? 0 : 0.85) : 0.55;
    if (Math.random() < chance) insert("INSERT INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)", a, b, ago(Math.random() * 2000));
  }
}

// ---- posts ----
const captions = [
  "Golden hour never disappoints 🌅", "Weekend mood", "Can't believe this view is real",
  "New favorite spot ☕", "Throwback to this amazing trip ✈️", "Little things 💛", "City lights",
  "Sunday reset 🌿", "Some days are just perfect", "Swipe to see more 👉", "Homemade and delicious 😋",
  "Work in progress...", "Back at it again", "Grateful for moments like this 🙏", "",
];
const locations = ["", "", "Paris, France", "Tokyo, Japan", "Berlin, Germany", "New York, NY", "Lisbon, Portugal", "Bali, Indonesia", "Dubai"];
const commentTexts = [
  "Wow 😍", "This is amazing!", "🔥🔥🔥", "Love this", "Where is this?", "Stunning shot 👏",
  "So beautiful", "Need to go here!", "❤️", "Incredible colors", "Goals 🙌", "Looks delicious!", "Obsessed",
];

let imgSeed = 1;
const postIds = [];
for (const uid of ids) {
  const count = uid === users.demo ? 3 : 4 + Math.floor(Math.random() * 6);
  for (let i = 0; i < count; i++) {
    const created = ago(Math.random() * 24 * 30);
    const pid = insert(
      "INSERT INTO posts (user_id, type, caption, location, created_at) VALUES (?, 'post', ?, ?, ?)",
      uid, pick(captions), pick(locations), created,
    );
    const slides = Math.random() < 0.25 ? 2 + Math.floor(Math.random() * 3) : 1;
    const tall = Math.random() < 0.35;
    for (let s = 0; s < slides; s++) {
      insert(
        "INSERT INTO post_media (post_id, url, kind, position) VALUES (?, ?, 'image', ?)",
        pid, `https://picsum.photos/seed/sg${imgSeed++}/1080/${tall ? 1350 : 1080}`, s,
      );
    }
    postIds.push([pid, uid, created]);
  }
}

// ---- reels ----
const videos = [
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://test-videos.co.uk/vids/jellyfish/mp4/h264/360/Jellyfish_360_10s_1MB.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
  "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4",
];
const reelCaptions = ["Nature is healing 🌸", "Ocean vibes 🪼 #reels", "Friday feeling 🎉", "Animation night 🐰", "Watch till the end 👀"];
videos.forEach((url, i) => {
  const uid = pick(others);
  const created = ago(Math.random() * 24 * 10);
  const pid = insert("INSERT INTO posts (user_id, type, caption, location, created_at) VALUES (?, 'reel', ?, '', ?)", uid, reelCaptions[i], created);
  insert("INSERT INTO post_media (post_id, url, kind, position) VALUES (?, ?, 'video', 0)", pid, url);
  postIds.push([pid, uid, created]);
});

// ---- likes, comments, saves, notifications ----
for (const [pid, owner, created] of postIds) {
  for (const uid of sample(ids, Math.floor(Math.random() * ids.length))) {
    const t = created + Math.random() * (NOW - created);
    insert("INSERT INTO likes (user_id, post_id, created_at) VALUES (?, ?, ?)", uid, pid, t);
    if (uid !== owner) insert("INSERT INTO notifications (user_id, actor_id, type, post_id, read, created_at) VALUES (?, ?, 'like', ?, ?, ?)", owner, uid, pid, owner === users.demo ? 0 : 1, t);
  }
  for (const uid of sample(ids, Math.floor(Math.random() * 5))) {
    const t = created + Math.random() * (NOW - created);
    const text = pick(commentTexts);
    const cid = insert("INSERT INTO comments (post_id, user_id, text, created_at) VALUES (?, ?, ?, ?)", pid, uid, text, t);
    if (uid !== owner) insert("INSERT INTO notifications (user_id, actor_id, type, post_id, text, read, created_at) VALUES (?, ?, 'comment', ?, ?, ?, ?)", owner, uid, pid, text, owner === users.demo ? 0 : 1, t);
    for (const liker of sample(ids, Math.floor(Math.random() * 3))) insert("INSERT INTO comment_likes (user_id, comment_id) VALUES (?, ?)", liker, cid);
  }
  if (Math.random() < 0.15) insert("INSERT INTO saves (user_id, post_id, created_at) VALUES (?, ?, ?)", users.demo, pid, NOW);
}
for (const f of db.prepare("SELECT follower_id, created_at FROM follows WHERE following_id = ?").all(users.demo)) {
  insert("INSERT INTO notifications (user_id, actor_id, type, read, created_at) VALUES (?, ?, 'follow', 0, ?)", users.demo, f.follower_id, f.created_at);
}

// ---- stories (expire 24h after creation) ----
for (const uid of sample(others, 7)) {
  const n = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const t = ago(Math.random() * 20);
    const video = Math.random() < 0.2;
    insert(
      "INSERT INTO stories (user_id, url, kind, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
      uid, video ? pick(videos) : `https://picsum.photos/seed/st${imgSeed++}/1080/1920`, video ? "video" : "image", t, t + 24 * HOUR,
    );
  }
}

// ---- direct messages ----
const chats = [
  ["lena.travels", ["Hey! Are you coming to the meetup on Saturday?", "Yes!! Wouldn't miss it 😄", "Great, see you there 🙌"]],
  ["marco_eats", ["Did you try the place I recommended?", "Not yet, going tomorrow", "You're going to love the carbonara 🍝"]],
  ["sara.design", ["Can you send me the file when you get a chance?", "Sure, sending it now"]],
];
for (const [username, lines] of chats) {
  const t0 = ago(Math.random() * 48 + 2);
  const cid = insert("INSERT INTO conversations (created_at, updated_at) VALUES (?, ?)", t0, t0);
  insert("INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)", cid, users.demo, cid, users[username]);
  let last = 0;
  lines.forEach((text, i) => {
    const sender = i % 2 === 0 ? users[username] : users.demo;
    last = insert("INSERT INTO messages (conversation_id, sender_id, text, created_at) VALUES (?, ?, ?, ?)", cid, sender, text, t0 + i * 600_000);
    if (sender === users.demo) db.prepare("UPDATE conversation_members SET last_read_id = ? WHERE conversation_id = ? AND user_id = ?").run(last, cid, users.demo);
  });
  db.prepare("UPDATE conversation_members SET last_read_id = ? WHERE conversation_id = ? AND user_id = ?").run(last, cid, users[username]);
  db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(t0 + lines.length * 600_000, cid);
}

console.log(`Seeded ${ids.length} users and ${postIds.length} posts.`);
console.log('Log in with username "demo" and password "password123" (every demo account uses that password).');
