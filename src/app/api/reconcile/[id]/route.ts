import { route, intParam } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { withStore } from "@/lib/server/reconcile";
import { deleteImport, getImport } from "@/lib/reconcile/store";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req, { params }: Ctx) => {
  const me = await requireUser();
  const id = intParam((await params).id);
  return { statement: withStore((d) => getImport(d, me.id, id)) };
});

// Removes the imported statement and its links. Orders/invoices are not affected.
export const DELETE = route(async (_req, { params }: Ctx) => {
  const me = await requireUser();
  const id = intParam((await params).id);
  withStore((d) => deleteImport(d, me.id, id));
});
