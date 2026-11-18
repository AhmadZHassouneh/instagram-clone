import { route, intParam, jsonBody, HttpError } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { withStore } from "@/lib/server/reconcile";
import { decideLink } from "@/lib/reconcile/store";

// { decision: "confirmed" | "rejected" | "pending" }
export const POST = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const me = await requireUser();
  const id = intParam((await params).id);
  const { decision } = await jsonBody<{ decision: string }>(req);
  if (decision !== "confirmed" && decision !== "rejected" && decision !== "pending") throw new HttpError(400, "Unknown decision.");
  withStore((d) => decideLink(d, me.id, id, decision));
});
