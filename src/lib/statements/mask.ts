// Masking for anything that might end up in logs, console output or error messages.

/** "9227808131" -> "******8131" */
export function maskAccount(account: string | null | undefined): string {
  if (!account) return "";
  const digits = account.replace(/\s/g, "");
  if (digits.length <= 4) return "*".repeat(digits.length);
  return "*".repeat(digits.length - 4) + digits.slice(-4);
}

/** "JOHN Q SMITH" -> "J*** Q* S****" (keeps only the first letter of each word). */
export function maskName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .trim()
    .split(/\s+/)
    .map((w) => {
      const chars = [...w];
      return chars[0] + "*".repeat(Math.max(1, chars.length - 1));
    })
    .join(" ");
}

/** CliQ references are payment identifiers: keep the last 4 characters. */
export function maskReference(ref: string | null | undefined): string {
  if (!ref) return "";
  return ref.length <= 4 ? "*".repeat(ref.length) : "*".repeat(ref.length - 4) + ref.slice(-4);
}
