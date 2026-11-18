/** One piece of text from the PDF, in PDF points (y grows upwards, like the PDF itself). */
export type TextItem = {
  page: number; // 1-based
  x: number;
  y: number;
  width: number;
  str: string;
};

export type TxnType = "transfer" | "cliq_inward" | "interest" | "tax" | "other";

export type Transaction = {
  /** Position in the statement, starting at 1 (opening/closing rows are not counted). */
  index: number;
  /** Page the row starts on. */
  page: number;
  date: string; // YYYY-MM-DD
  direction: "in" | "out";
  type: TxnType;
  counterparty: string | null;
  cliqReference: string | null;
  /** Full Details text as printed. */
  description: string;
  amountFils: number;
  balanceFils: number;
};

export type StatementHeader = {
  periodFrom: string | null;
  periodTo: string | null;
  issueDate: string | null;
  accountHolder: string | null;
  accountNumber: string | null;
  currency: string | null;
};

export type RowMismatch = {
  index: number;
  page: number;
  date: string;
  expectedBalanceFils: number;
  printedBalanceFils: number;
  differenceFils: number;
};

export type ValidationReport = {
  ok: boolean;
  rowMismatches: RowMismatch[];
  closing: {
    openingFils: number;
    totalAddedFils: number;
    totalDeductedFils: number;
    expectedClosingFils: number;
    printedClosingFils: number | null;
    ok: boolean;
  };
  /** Things that look off but aren't balance errors (unknown row types, missing header fields, ...). */
  warnings: string[];
};

export type ParsedStatement = {
  header: StatementHeader;
  openingBalanceFils: number | null;
  closingBalanceFils: number | null;
  transactions: Transaction[];
  pageCount: number;
  validation: ValidationReport;
};
