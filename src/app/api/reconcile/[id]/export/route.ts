import { route, intParam } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { withStore } from "@/lib/server/reconcile";
import { getImport, toCsv } from "@/lib/reconcile/store";
import { formatFils } from "@/lib/statements/money";

// CSV report: transaction, linked order IDs, match status. (The PDF is the printable report page.)
export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const me = await requireUser();
  const id = intParam((await params).id);
  const view = withStore((d) => getImport(d, me.id, id));
  return new Response(toCsv(view, formatFils), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reconciliation-${view.periodFrom ?? id}-${view.periodTo ?? ""}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
