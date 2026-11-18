/** Small seeded PRNG (mulberry32) so fixtures and seed data are reproducible from a number. */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }

  /** [0, 1) */
  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] */
  int(min: number, max: number) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p: number) {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** n distinct items */
  sample<T>(arr: readonly T[], n: number): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, n);
  }

  /** Uppercase letters/digits, e.g. for fake references. */
  code(len: number, alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789") {
    return Array.from({ length: len }, () => alphabet[Math.floor(this.next() * alphabet.length)]).join("");
  }

  digits(len: number) {
    return this.code(len, "0123456789");
  }
}
