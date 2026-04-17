// DB schema is defined in migrations/0001_initial_schema.ts
// This file re-exports table names and types for use in application code.

export const Tables = {
  accounts: "accounts",
  folders: "folders",
  messages: "messages",
  attachments: "attachments",
  contacts: "contacts",
  messages_fts: "messages_fts",
} as const
