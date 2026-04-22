import { SqliteClient } from "@effect/sql-sqlite-bun";
import { SqliteMigrator } from "@effect/sql-sqlite-bun";
import * as Migrator from "effect/unstable/sql/Migrator";
import { Effect } from "effect";

import migration0001 from "../src/server/db/migrations/0001_initial_schema.ts";

const migrate = SqliteMigrator.run({
  loader: Migrator.fromRecord({
    "0001_initial_schema": migration0001,
  }),
});

const SqliteLive = SqliteClient.layer({ filename: "./data/localmail.db" });

Effect.runPromise(migrate.pipe(Effect.provide(SqliteLive)))
  .then((applied) => {
    if (applied.length > 0) {
      console.log(
        `Applied ${applied.length} migration(s):`,
        applied.map(([id, name]) => `${id}_${name}`).join(", "),
      );
    } else {
      console.log("Database schema up to date.");
    }
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
