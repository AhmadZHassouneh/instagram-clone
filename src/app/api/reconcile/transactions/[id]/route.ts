import { route, intParam, jsonBody } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { withStore } from "@/lib/server/reconcile";
import { setNote } from "@/lib/reconcile/store";

// Your own note on a transaction: { note }
export const PATCH = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const me = await requireUser();
  const id = intParam((await params).id);
  const { note } = await jsonBody<{ note: string }>(req);
  withStore((d) => setNote(d, me.id, id, String(note ?? "")));
});
