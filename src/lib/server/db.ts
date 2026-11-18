import "server-only";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { openDatabase } from "../../../db/migrate.mjs";

declare global {
  var __snapgramDb: DatabaseSync | undefined;
}

export function db() {
  globalThis.__snapgramDb ??= openDatabase();
  return globalThis.__snapgramDb;
}

export function all<T>(sql: string, ...params: SQLInputValue[]): T[] {
  return db().prepare(sql).all(...params) as T[];
}

export function get<T>(sql: string, ...params: SQLInputValue[]): T | undefined {
  return db().prepare(sql).get(...params) as T | undefined;
}

export function run(sql: string, ...params: SQLInputValue[]) {
  const r = db().prepare(sql).run(...params);
  return { id: Number(r.lastInsertRowid), changes: Number(r.changes) };
}

export function tx<T>(fn: () => T): T {
  const d = db();
  d.exec("BEGIN");
  try {
    const result = fn();
    d.exec("COMMIT");
    return result;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}

export const now = () => Date.now();
