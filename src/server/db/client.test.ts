import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SqliteMigrator } from "@effect/sql-sqlite-bun";
import { afterEach, expect, test } from "bun:test";
import { Effect, Exit } from "effect";
import * as Migrator from "effect/unstable/sql/Migrator";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { makeSqliteLayer } from "./client";
import migration0001 from "./migrations/0001_initial_schema.ts";

const tempFiles = new Set<string>();
const now = new Date("2026-04-19T12:00:00.000Z").toISOString();

const makeTempDatabaseFile = () => {
  const filename = join(tmpdir(), `localmail-test-${crypto.randomUUID()}.db`);
  tempFiles.add(filename);
  tempFiles.add(`${filename}-shm`);
  tempFiles.add(`${filename}-wal`);
  return filename;
};

const migrate = SqliteMigrator.run({
  loader: Migrator.fromRecord({
    "0001_initial_schema": migration0001,
  }),
});

const removeFileWithRetries = async (filename: string) => {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      rmSync(filename, { force: true });
      return;
    } catch (error) {
      if (attempt === 19) {
        throw error;
      }
      await Bun.sleep(100);
    }
  }
};

const runWithMigratedDatabase = async (
  program: Effect.Effect<void, unknown, SqlClient.SqlClient>,
) => {
  const filename = makeTempDatabaseFile();
  const layer = makeSqliteLayer({ filename });

  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        yield* migrate;
        yield* program;
      }).pipe(Effect.provide(layer, { local: true })),
    ),
  );
};

const insertMailboxFixture = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    INSERT INTO accounts (
      id,
      name,
      email,
      provider,
      imap_host,
      smtp_host,
      auth_type
    )
    VALUES (
      'acct_01',
      'Test Account',
      'test@example.com',
      'generic',
      'imap.example.com',
      'smtp.example.com',
      'password'
    )
  `;

  yield* sql`
    INSERT INTO folders (id, account_id, path, name, role)
    VALUES ('folder_01', 'acct_01', 'INBOX', 'Inbox', 'inbox')
  `;

  yield* sql`
    INSERT INTO messages (
      id,
      account_id,
      folder_id,
      uid,
      internet_message_id,
      subject,
      from_address,
      to_addresses,
      date,
      body_text,
      has_body
    )
    VALUES (
      'msg_01',
      'acct_01',
      'folder_01',
      1,
      '<msg_01@example.com>',
      'Quarterly roadmap',
      '{"name":"Sender","address":"sender@example.com"}',
      '[{"name":"Recipient","address":"test@example.com"}]',
      ${now},
      'The roadmap includes a searchable migration milestone.',
      1
    )
  `;

  yield* sql`
    INSERT INTO attachments (id, message_id, filename, content_type, part_id)
    VALUES ('attachment_01', 'msg_01', 'roadmap.pdf', 'application/pdf', '2')
  `;

  yield* sql`
    INSERT INTO contacts (id, email, name, last_seen_at)
    VALUES ('contact_01', 'sender@example.com', 'Sender', ${now})
  `;

  yield* sql`
    INSERT INTO sync_state (folder_id, status, last_uid)
    VALUES ('folder_01', 'idle', 1)
  `;
});

afterEach(async () => {
  for (const filename of tempFiles) {
    await removeFileWithRetries(filename);
    tempFiles.delete(filename);
  }
});

test("enforces mailbox relationships and cascades account deletes", async () => {
  await runWithMigratedDatabase(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* insertMailboxFixture;

      const invalidFolderInsert = sql`
        INSERT INTO folders (id, account_id, path, name)
        VALUES ('folder_bad', 'missing_account', 'INBOX', 'Inbox')
      `;
      const invalidResult = yield* Effect.exit(invalidFolderInsert);
      expect(Exit.isFailure(invalidResult)).toBe(true);

      yield* sql`DELETE FROM accounts WHERE id = 'acct_01'`;

      const remaining = yield* sql<{
        folders: number;
        messages: number;
        attachments: number;
        sync_state: number;
      }>`
        SELECT
          (SELECT COUNT(*) FROM folders) AS folders,
          (SELECT COUNT(*) FROM messages) AS messages,
          (SELECT COUNT(*) FROM attachments) AS attachments,
          (SELECT COUNT(*) FROM sync_state) AS sync_state
      `;

      expect(remaining[0]).toEqual({
        folders: 0,
        messages: 0,
        attachments: 0,
        sync_state: 0,
      });
    }),
  );
});

test("keeps message search results synchronized with message changes", async () => {
  await runWithMigratedDatabase(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* insertMailboxFixture;

      const insertedMatches = yield* sql<{ id: string }>`
        SELECT messages.id
        FROM messages_fts
        JOIN messages ON messages_fts.rowid = messages.rowid
        WHERE messages_fts MATCH 'migration'
      `;
      expect(insertedMatches.map((row) => row.id)).toEqual(["msg_01"]);

      yield* sql`
        UPDATE messages
        SET body_text = 'The updated body mentions tokenizer behavior.'
        WHERE id = 'msg_01'
      `;

      const oldMatches = yield* sql<{ id: string }>`
        SELECT messages.id
        FROM messages_fts
        JOIN messages ON messages_fts.rowid = messages.rowid
        WHERE messages_fts MATCH 'migration'
      `;
      expect(oldMatches).toEqual([]);

      const updatedMatches = yield* sql<{ id: string }>`
        SELECT messages.id
        FROM messages_fts
        JOIN messages ON messages_fts.rowid = messages.rowid
        WHERE messages_fts MATCH 'tokenizer'
      `;
      expect(updatedMatches.map((row) => row.id)).toEqual(["msg_01"]);

      yield* sql`DELETE FROM messages WHERE id = 'msg_01'`;

      const deletedMatches = yield* sql<{ id: string }>`
        SELECT messages.id
        FROM messages_fts
        JOIN messages ON messages_fts.rowid = messages.rowid
        WHERE messages_fts MATCH 'tokenizer'
      `;
      expect(deletedMatches).toEqual([]);
    }),
  );
});

test("populates default timestamps as parseable UTC strings", async () => {
  await runWithMigratedDatabase(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* insertMailboxFixture;

      const rows = yield* sql<{
        account_created_at: string;
        message_synced_at: string;
        contact_created_at: string;
        sync_state_updated_at: string;
      }>`
        SELECT
          accounts.created_at AS account_created_at,
          messages.synced_at AS message_synced_at,
          contacts.created_at AS contact_created_at,
          sync_state.updated_at AS sync_state_updated_at
        FROM accounts
        JOIN messages ON messages.account_id = accounts.id
        JOIN contacts ON contacts.id = 'contact_01'
        JOIN sync_state ON sync_state.folder_id = messages.folder_id
        WHERE accounts.id = 'acct_01'
          AND messages.id = 'msg_01'
      `;

      expect(rows[0]).toBeDefined();
      for (const timestamp of Object.values(rows[0] ?? {})) {
        expect(Number.isNaN(Date.parse(timestamp))).toBe(false);
        expect(timestamp.endsWith("Z")).toBe(true);
      }
    }),
  );
});
