// Fuzzy name matching that works across Arabic script and English transliterations
// (محمد ≈ MOHAMMAD ≈ MUHAMMED, الزعبي ≈ AL ZOUBI ≈ ZOUBI).

const AR: Record<string, string> = {
  "ا": "a", "أ": "a", "إ": "i", "آ": "a", "ٱ": "a", "ب": "b", "ت": "t", "ث": "th", "ج": "j", "ح": "h", "خ": "kh",
  "د": "d", "ذ": "th", "ر": "r", "ز": "z", "س": "s", "ش": "sh", "ص": "s", "ض": "d", "ط": "t", "ظ": "z", "ع": "a",
  "غ": "gh", "ف": "f", "ق": "q", "ك": "k", "ل": "l", "م": "m", "ن": "n", "ه": "h", "ة": "a", "و": "w", "ي": "y",
  "ى": "a", "ء": "", "ئ": "y", "ؤ": "w", "ـ": "",
};

/** Arabic letters -> rough Latin transliteration; Latin text is lowercased. Diacritics dropped. */
export function transliterate(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[ً-ٰٟ̀-ͯ]/g, "") // harakat / combining marks
    .toLowerCase()
    .replace(/[؀-ۿ]/g, (c) => AR[c] ?? "");
}

// Words that carry no identity in a payer name.
const STOP = new Set([
  "al", "el", "bin", "ibn", "abu", "co", "company", "llc", "ltd", "est", "for", "and", "the", "of",
  "center", "centre", "services", "service", "store", "shop", "jo", "me", "middle", "east",
]);

/** Tokens: transliterated, split on non-letters, "al-"/"el-" prefixes removed, stop words dropped. */
export function nameTokens(name: string | null | undefined): string[] {
  if (!name) return [];
  return transliterate(name)
    .replace(/[._\-/]+/g, " ")
    .split(/[^a-z]+/)
    .map((t) => (t.length > 4 && /^(al|el)/.test(t) ? t.slice(2) : t))
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

/**
 * Consonant skeleton: keeps the first letter, drops vowels/y/w after it, merges spelling variants
 * (kh/x, ph/f, q/k, th/t/s, dh/z, ou/u...) and doubled letters. "mohammad", "muhamed", "محمد" -> "mhmd".
 */
export function skeleton(token: string): string {
  const t = token
    .replace(/ph/g, "f")
    .replace(/q/g, "k")
    .replace(/ck/g, "k")
    .replace(/x/g, "kh")
    .replace(/dh/g, "z")
    .replace(/th/g, "t")
    .replace(/ee|ie|ei|ey/g, "i")
    .replace(/oo|ou/g, "u")
    .replace(/(.)\1+/g, "$1");
  return (t[0] + t.slice(1).replace(/[aeiouyw']/g, "")).replace(/(.)\1+/g, "$1");
}

/** Jaro-Winkler similarity in [0, 1]. */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const am = new Array(a.length).fill(false);
  const bm = new Array(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - range); j < Math.min(b.length, i + range + 1); j++) {
      if (bm[j] || a[i] !== b[j]) continue;
      am[i] = bm[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  let k = 0;
  let transpositions = 0;
  for (let i = 0; i < a.length; i++) {
    if (!am[i]) continue;
    while (!bm[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  const m = matches;
  const jaro = (m / a.length + m / b.length + (m - transpositions / 2) / m) / 3;
  let prefix = 0;
  while (prefix < 4 && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

function tokenSimilarity(a: string, b: string) {
  const sa = skeleton(a);
  const sb = skeleton(b);
  // Equal skeletons of real length are the same name in another spelling.
  if (sa === sb && sa.length >= 2) return Math.max(0.95, jaroWinkler(a, b));
  return Math.max(jaroWinkler(a, b), jaroWinkler(sa, sb) * 0.95);
}

/**
 * Similarity of two names in [0, 1]: each token of the shorter name is paired with its best match
 * in the longer one (so "QAHWET AL BALAD CAFE" vs "Qahwet Al Balad" scores high), averaged and
 * weighted down slightly when the shorter name is just one token.
 */
export function nameSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return 0;
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  let total = 0;
  for (const t of short) total += Math.max(...long.map((u) => tokenSimilarity(t, u)));
  const avg = total / short.length;
  return short.length === 1 ? avg * 0.85 : avg;
}

/** Best similarity of a name against any of several names (business name, username, Arabic name...). */
export function bestNameSimilarity(name: string | null | undefined, candidates: (string | null | undefined)[]) {
  return Math.max(0, ...candidates.map((c) => nameSimilarity(name, c)));
}
