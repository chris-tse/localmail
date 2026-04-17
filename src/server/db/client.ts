import { SqliteClient } from "@effect/sql-sqlite-bun"

export const SqliteLive = SqliteClient.layer({
  filename: "./data/localmail.db",
})

export { SqliteClient }
