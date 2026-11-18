// Static demo (GitHub Pages): maps an API GET URL to the snapshot file that holds its response.
// Shared by scripts/demo-snapshot.mts (writes the files) and src/lib/demo.ts (reads them in the browser).

/** Query params that only bust caches or shuffle order; the snapshot ignores them. */
const IGNORED = new Set(["seed", "u", "after"]);

/** "/api/users/x/posts?tab=reels" -> "users/x/posts__tab-reels" (no extension). */
export function demoKey(url: string): string {
  const u = new URL(url, "http://demo.local");
  const path = u.pathname.replace(/^\/api\//, "").replace(/\/+$/, "");
  const params = [...u.searchParams.entries()]
    .filter(([k]) => !IGNORED.has(k))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}-${encodeURIComponent(v).replace(/%/g, "~")}`);
  return params.length ? `${path}__${params.join("_")}` : path;
}
