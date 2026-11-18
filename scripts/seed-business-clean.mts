// Deletes every seeded business record (is_seed = 1). Real data is never touched.
// Usage: npm run seed:business:clean
import { openDatabase, databasePath } from "../db/migrate.mjs";
import { refuseInProduction } from "./lib/env-guard.mjs";
import { deleteSeedData } from "../src/lib/seed/business/write";

try {
  refuseInProduction("seed:business:clean");
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}

const counts = deleteSeedData(openDatabase());
console.log(`Database: ${databasePath()}`);
console.log(
  "Deleted seed data: " +
    Object.entries(counts)
      .map(([t, n]) => `${n} ${t}`)
      .join(", "),
);
