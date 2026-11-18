import { route, intParam } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { unsendMessage } from "@/lib/server/dm";

// Unsend a direct message: only its sender can remove it, and it disappears for both people.
export const DELETE = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const me = await requireUser();
  unsendMessage(intParam((await params).id), me.id);
});
