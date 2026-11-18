import type { RowMismatch, Transaction, ValidationReport } from "./types";

/**
 * Checks the running balance after every row and that
 * closing = opening + total added − total deducted. All arithmetic is in integer fils.
 */
export function validate(
  openingFils: number | null,
  closingFils: number | null,
  transactions: Transaction[],
  warnings: string[],
): ValidationReport {
  const notes = [...warnings];
  if (openingFils === null) notes.push("No Opening Balance row found; assuming 0.000.");
  const opening = openingFils ?? 0;

  const rowMismatches: RowMismatch[] = [];
  let running = opening;
  let totalAdded = 0;
  let totalDeducted = 0;
  for (const t of transactions) {
    if (t.direction === "in") totalAdded += t.amountFils;
    else totalDeducted += t.amountFils;
    const expected = running + (t.direction === "in" ? t.amountFils : -t.amountFils);
    if (expected !== t.balanceFils) {
      rowMismatches.push({
        index: t.index,
        page: t.page,
        date: t.date,
        expectedBalanceFils: expected,
        printedBalanceFils: t.balanceFils,
        differenceFils: t.balanceFils - expected,
      });
    }
    // Continue from the printed balance so one bad row is reported once, not on every row after it.
    running = t.balanceFils;
  }

  const expectedClosing = opening + totalAdded - totalDeducted;
  if (closingFils === null) notes.push("No Closing Balance row found.");
  const closingOk = closingFils === null ? rowMismatches.length === 0 : closingFils === expectedClosing;

  return {
    ok: rowMismatches.length === 0 && closingOk && closingFils !== null,
    rowMismatches,
    closing: {
      openingFils: opening,
      totalAddedFils: totalAdded,
      totalDeductedFils: totalDeducted,
      expectedClosingFils: expectedClosing,
      printedClosingFils: closingFils,
      ok: closingOk,
    },
    warnings: notes,
  };
}
