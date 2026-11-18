import { route, intParam, jsonBody } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { windowDays, withStore } from "@/lib/server/reconcile";
import { runMatching } from "@/lib/reconcile/store";

// Re-run matching for rows without an active link (keeps your decisions; never re-proposes rejected pairs).
export const POST = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const me = await requireUser();
  const id = intParam((await params).id);
  const body = await jsonBody<{ windowDays: number }>(req);
  return withStore((d) => runMatching(d, me.id, id, { windowDays: windowDays(body.windowDays) }));
});
