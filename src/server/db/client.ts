import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { SqliteClient } from "@effect/sql-sqlite-bun";
import { Context, Effect, Layer } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export const DEFAULT_DATABASE_FILE = "./data/localmail.db";

export interface DatabaseLayerOptions {
  readonly filename?: string;
}

export const ensureDatabaseDirectory = (filename: string = DEFAULT_DATABASE_FILE): void => {
  if (filename === ":memory:") {
    return;
  }

  const directory = dirname(filename);
  if (directory === "." || directory === "") {
    return;
  }

  mkdirSync(directory, { recursive: true });
};

export const makeSqliteLayer = (options: DatabaseLayerOptions = {}) => {
  const filename = options.filename ?? DEFAULT_DATABASE_FILE;
  ensureDatabaseDirectory(filename);

  return SqliteClient.layer({ filename }).pipe(
    Layer.tap((context) =>
      Effect.gen(function* () {
        const sql = Context.get(context, SqlClient.SqlClient);

        yield* sql`PRAGMA journal_mode = WAL`;
        yield* sql`PRAGMA foreign_keys = ON`;
      }),
    ),
  );
};

export const SqliteLive = makeSqliteLayer();
export const DatabaseLayer = SqliteLive;

export const getJournalMode = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ journal_mode: string }>`PRAGMA journal_mode`;

  return rows[0]?.journal_mode ?? "";
});

export const getForeignKeys = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ foreign_keys: 0 | 1 }>`PRAGMA foreign_keys`;

  return rows[0]?.foreign_keys ?? 0;
});

export const listDatabaseObjects = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ name: string; type: string }>`
    SELECT name, type
    FROM sqlite_schema
    WHERE type IN ('table', 'trigger', 'index', 'view')
    ORDER BY name
  `;

  return rows;
});

export const listApplicationTables = Effect.map(listDatabaseObjects, (objects) =>
  objects.filter((object) => object.type === "table").map((object) => object.name),
);

export const listAppliedMigrations = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ migration_id: number; name: string; created_at: string }>`
    SELECT migration_id, name, created_at
    FROM effect_sql_migrations
    ORDER BY migration_id
  `;

  return rows;
});

export { SqliteClient };
