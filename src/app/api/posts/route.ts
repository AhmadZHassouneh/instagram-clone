import { route, HttpError } from "@/lib/server/http";
import { run, now, tx } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { saveUpload, type SavedMedia } from "@/lib/server/media";
import { queryPosts } from "@/lib/server/queries";

// Create a post. Multipart form: files (1–10), caption, location.
// A single video becomes a reel, like on Instagram.
export const POST = route(async (req) => {
  const me = await requireUser();
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new HttpError(400, "Choose at least one photo or video.");
  if (files.length > 10) throw new HttpError(400, "You can share up to 10 photos and videos.");

  const saved: SavedMedia[] = [];
  for (const f of files) saved.push(await saveUpload(f));

  const caption = String(form.get("caption") ?? "").slice(0, 2200);
  const location = String(form.get("location") ?? "").slice(0, 100);
  const type = saved.length === 1 && saved[0].kind === "video" ? "reel" : "post";

  const postId = tx(() => {
    const { id } = run(
      "INSERT INTO posts (user_id, type, caption, location, created_at) VALUES (?, ?, ?, ?, ?)",
      me.id,
      type,
      caption,
      location,
      now(),
    );
    saved.forEach((m, i) =>
      run("INSERT INTO post_media (post_id, url, kind, position) VALUES (?, ?, ?, ?)", id, m.url, m.kind, i),
    );
    return id;
  });

  return { post: queryPosts(me.id, "p.id = ?", [postId], "")[0] };
});
