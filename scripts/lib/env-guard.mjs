// Seed scripts write or delete lots of data: never let them touch a production database.
import fs from "node:fs";
import path from "node:path";

/** Reads APP_ENV from the environment, falling back to .env.local / .env in the project root. */
function appEnv() {
  if (process.env.APP_ENV) return process.env.APP_ENV;
  for (const file of [".env.local", ".env"]) {
    try {
      const m = /^\s*APP_ENV\s*=\s*["']?([\w-]+)/m.exec(fs.readFileSync(path.join(process.cwd(), file), "utf8"));
      if (m) return m[1];
    } catch {}
  }
  return "";
}

export function isProduction() {
  return [process.env.NODE_ENV, appEnv()].some((v) => /^prod(uction)?$/i.test(v ?? ""));
}

/** Throws (and the caller exits) if this looks like a production environment. */
export function refuseInProduction(what) {
  if (isProduction()) {
    throw new Error(`Refusing to run ${what}: NODE_ENV/APP_ENV says this is production.`);
  }
}
