// Draws builder output into a real PDF (pdf-lib). Every page carries a "SYNTHETIC TEST DATA"
// watermark and footer: these files must never pass for a real bank statement.
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { COL, PAGE, buildItems, type StatementSpec } from "./builder";

const FONT_SIZE = 9;

export async function renderStatementPdf(spec: StatementSpec): Promise<Uint8Array> {
  const { items, pageCount } = buildItems(spec);
  const doc = await PDFDocument.create();
  doc.setTitle("Synthetic test statement");
  doc.setProducer("snapgram test fixtures");
  doc.setSubject("SYNTHETIC TEST DATA - not a real bank document");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = Array.from({ length: pageCount }, () => doc.addPage([PAGE.width, PAGE.height]));

  for (const page of pages) {
    page.drawText("SYNTHETIC TEST DATA", {
      x: 110,
      y: 300,
      size: 52,
      font: bold,
      color: rgb(0.85, 0.85, 0.85),
      rotate: degrees(35),
      opacity: 0.6,
    });
    page.drawText("SYNTHETIC TEST DATA - generated fixture, not issued by any bank", {
      x: 150,
      y: 15,
      size: 7,
      font,
      color: rgb(0.6, 0.1, 0.1),
    });
  }

  for (const it of items) {
    const f = it.bold ? bold : font;
    // Re-centre / right-align using the real font metrics so the PDF looks right.
    const realW = f.widthOfTextAtSize(it.str, FONT_SIZE);
    let x = it.x;
    const amountCol = [COL.added, COL.deducted, COL.balance].find((c) => it.x > c.x - 1 && it.x + it.width <= c.x + c.w + 1);
    if (amountCol && /^[\d,.-]+$/.test(it.str)) x = amountCol.x + amountCol.w - realW;
    else if (it.bold) x = it.x + (it.width - realW) / 2;
    pages[it.page - 1].drawText(it.str, { x, y: it.y, size: FONT_SIZE, font: f, color: rgb(0.2, 0.2, 0.2) });
  }
  return doc.save();
}
