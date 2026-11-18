import { route, HttpError } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { windowDays, withStore } from "@/lib/server/reconcile";
import { listImports, runMatching, saveImport } from "@/lib/reconcile/store";
import { parseBlinkStatement } from "@/lib/statements/blink";

const MAX_BYTES = 20 * 1024 * 1024;

export const GET = route(async () => {
  const me = await requireUser();
  return { imports: withStore((d) => listImports(d, me.id)) };
});

// Upload a statement PDF: parse it, store the rows, and propose matches against your orders.
// Only reconciliation tables are written; orders, invoices and messages are read-only here.
export const POST = route(async (req) => {
  const me = await requireUser();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "Choose a statement PDF.");
  if (file.size > MAX_BYTES) throw new HttpError(400, "That file is too large (20 MB max).");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") throw new HttpError(400, "That isn't a PDF file.");

  let parsed;
  try {
    parsed = await parseBlinkStatement(bytes);
  } catch {
    // Don't log the error: it could contain statement text.
    throw new HttpError(400, "Couldn't read this PDF as a Blink statement.");
  }
  if (parsed.transactions.length === 0) throw new HttpError(400, "No transactions found in this PDF.");

  return withStore((d) => {
    const { importId, existing } = saveImport(d, me.id, file.name, bytes, parsed);
    const result = existing ? { proposed: 0, auto: 0 } : runMatching(d, me.id, importId, { windowDays: windowDays(form.get("windowDays")) });
    return { importId, existing, ...result };
  });
});
