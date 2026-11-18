import { parseFils } from "../money";
import { layoutPages } from "./layout";
import { assembleRows, classifyRows, parseHeader } from "./parse";
import type { ParsedStatement, TextItem } from "./types";
import { validate } from "./validate";

export type * from "./types";

/** Parses already-extracted text items. Pure: no I/O, no logging. */
export function parseBlinkItems(items: TextItem[], pageCount: number): ParsedStatement {
  const pages = layoutPages(items, pageCount);
  const header = parseHeader(pages.slice(0, 2).flatMap((p) => p.preamble));
  const { opening, closing, transactions, warnings } = classifyRows(assembleRows(pages));

  const openingFils = opening?.balance ? parseFils(opening.balance) : null;
  const closingFils = closing?.balance ? parseFils(closing.balance) : null;
  const headerWarnings = (Object.keys(header) as (keyof typeof header)[])
    .filter((k) => header[k] === null)
    .map((k) => `Header field "${k}" not found.`);

  return {
    header,
    openingBalanceFils: openingFils,
    closingBalanceFils: closingFils,
    transactions,
    pageCount,
    validation: validate(openingFils, closingFils, transactions, [...headerWarnings, ...warnings]),
  };
}

/** Reads text with positions from a PDF using pdf.js (Node). */
export async function extractTextItems(pdf: Uint8Array): Promise<{ items: TextItem[]; pageCount: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // pdf.js takes ownership of (detaches) the buffer it's given, so pass a copy.
  const task = pdfjs.getDocument({ data: pdf.slice(), useSystemFonts: true, verbosity: 0 });
  const items: TextItem[] = [];
  try {
    const doc = await task.promise;
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      for (const it of content.items) {
        if (!("str" in it) || !it.str.trim()) continue;
        items.push({ page: p, x: it.transform[4], y: it.transform[5], width: it.width, str: it.str });
      }
    }
    return { items, pageCount: doc.numPages };
  } finally {
    await task.destroy();
  }
}

export async function parseBlinkStatement(pdf: Uint8Array): Promise<ParsedStatement> {
  const { items, pageCount } = await extractTextItems(pdf);
  return parseBlinkItems(items, pageCount);
}
