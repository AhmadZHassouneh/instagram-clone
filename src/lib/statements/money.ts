// JOD amounts are handled as integer fils (1 JOD = 1000 fils) so sums never suffer float rounding.

const AMOUNT_RE = /^(-)?([\d,]+)(?:\.(\d{1,3}))?$/;

/** True if the text looks like a JOD amount ("1,234.567", "0.000", "50"). */
export function isAmount(text: string) {
  return AMOUNT_RE.test(text.trim());
}

/** "1,234.567" -> 1234567. Parses the digits as text; never goes through a float. */
export function parseFils(text: string): number {
  const m = AMOUNT_RE.exec(text.trim());
  if (!m) throw new Error(`Not an amount: "${text}"`);
  const whole = m[2].replace(/,/g, "");
  const frac = (m[3] ?? "").padEnd(3, "0");
  const fils = Number(whole) * 1000 + Number(frac);
  if (!Number.isSafeInteger(fils)) throw new Error(`Amount out of range: "${text}"`);
  return m[1] ? -fils : fils;
}

/** 1234567 -> "1,234.567" */
export function formatFils(fils: number): string {
  const sign = fils < 0 ? "-" : "";
  const abs = Math.abs(fils);
  const whole = Math.floor(abs / 1000).toLocaleString("en-US");
  return `${sign}${whole}.${String(abs % 1000).padStart(3, "0")}`;
}
