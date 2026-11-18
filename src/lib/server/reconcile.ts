import "server-only";
import { db } from "./db";
import { HttpError } from "./http";
import { NotFound } from "@/lib/reconcile/store";

/** Runs a reconcile store function against the app database, turning NotFound into a 404. */
export function withStore<T>(fn: (d: ReturnType<typeof db>) => T): T {
  try {
    return fn(db());
  } catch (e) {
    if (e instanceof NotFound) throw new HttpError(404, e.message);
    throw e;
  }
}

export function windowDays(value: unknown) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 30 ? n : 3;
}
