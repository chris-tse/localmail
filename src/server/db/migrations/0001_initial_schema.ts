import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`PRAGMA foreign_keys = ON`;

  // Accounts
  yield* sql`
    CREATE TABLE IF NOT EXISTS accounts (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      email           TEXT NOT NULL,
      provider        TEXT NOT NULL,

      username        TEXT,
      imap_host       TEXT NOT NULL,
      imap_port       INTEGER NOT NULL DEFAULT 993,
      imap_secure     INTEGER NOT NULL DEFAULT 1,

      smtp_host       TEXT NOT NULL,
      smtp_port       INTEGER NOT NULL DEFAULT 465,
      smtp_secure     INTEGER NOT NULL DEFAULT 1,
      smtp_starttls   INTEGER NOT NULL DEFAULT 0,

      auth_type       TEXT NOT NULL,
      access_token    TEXT,
      refresh_token   TEXT,
      token_expiry    TEXT,
      oauth_client_id TEXT,
      oauth_client_secret TEXT,
      password_secret TEXT,

      discovery_source TEXT,
      discovery_confidence REAL,

      color           TEXT,
      sort_order      INTEGER NOT NULL DEFAULT 0,
      is_active       INTEGER NOT NULL DEFAULT 1,

      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `;
  yield* sql`CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email)`;
  yield* sql`CREATE INDEX IF NOT EXISTS idx_accounts_provider ON accounts(provider)`;

  // Folders
  yield* sql`
    CREATE TABLE IF NOT EXISTS folders (
      id              TEXT PRIMARY KEY,
      account_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

      path            TEXT NOT NULL,
      name            TEXT NOT NULL,
      delimiter       TEXT,

      role            TEXT,

      uid_validity    INTEGER,
      uid_next        INTEGER,
      highest_modseq  TEXT,

      total_messages   INTEGER DEFAULT 0,
      unread_messages  INTEGER DEFAULT 0,
      last_synced_at   TEXT,

      sort_order      INTEGER NOT NULL DEFAULT 0,

      UNIQUE(account_id, path)
    )
  `;
  yield* sql`CREATE INDEX IF NOT EXISTS idx_folders_account ON folders(account_id)`;
  yield* sql`CREATE INDEX IF NOT EXISTS idx_folders_role ON folders(account_id, role)`;

  // Messages
  yield* sql`
    CREATE TABLE IF NOT EXISTS messages (
      id              TEXT PRIMARY KEY,
      account_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      folder_id       TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,

      uid             INTEGER NOT NULL,
      internet_message_id TEXT,

      thread_id       TEXT,
      in_reply_to     TEXT,
      references_json TEXT,

      subject         TEXT,
      from_address    TEXT NOT NULL,
      to_addresses    TEXT,
      cc_addresses    TEXT,
      bcc_addresses   TEXT,
      reply_to        TEXT,
      date            TEXT NOT NULL,

      snippet         TEXT,
      body_text       TEXT,
      body_html       TEXT,
      has_body        INTEGER NOT NULL DEFAULT 0,

      is_read         INTEGER NOT NULL DEFAULT 0,
      is_starred      INTEGER NOT NULL DEFAULT 0,
      is_answered     INTEGER NOT NULL DEFAULT 0,
      is_draft        INTEGER NOT NULL DEFAULT 0,
      is_deleted      INTEGER NOT NULL DEFAULT 0,

      labels_json     TEXT,

      size_bytes      INTEGER,

      received_at     TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at       TEXT NOT NULL DEFAULT (datetime('now')),

      UNIQUE(folder_id, uid)
    )
  `;
  yield* sql`CREATE INDEX IF NOT EXISTS idx_messages_account ON messages(account_id)`;
  yield* sql`CREATE INDEX IF NOT EXISTS idx_messages_folder_date ON messages(folder_id, date DESC)`;
  yield* sql`CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id)`;
  yield* sql`CREATE INDEX IF NOT EXISTS idx_messages_message_id ON messages(internet_message_id)`;
  yield* sql`CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(folder_id, is_read) WHERE is_read = 0`;

  // Attachments
  yield* sql`
    CREATE TABLE IF NOT EXISTS attachments (
      id              TEXT PRIMARY KEY,
      message_id      TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,

      filename        TEXT,
      content_type    TEXT NOT NULL,
      size_bytes      INTEGER,
      content_id      TEXT,
      part_id         TEXT NOT NULL,
      is_inline       INTEGER NOT NULL DEFAULT 0,

      disposition     TEXT
    )
  `;
  yield* sql`CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id)`;

  // Contacts
  yield* sql`
    CREATE TABLE IF NOT EXISTS contacts (
      id              TEXT PRIMARY KEY,
      email           TEXT NOT NULL UNIQUE,
      name            TEXT,
      frequency       INTEGER NOT NULL DEFAULT 1,
      last_seen_at    TEXT NOT NULL,

      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `;
  yield* sql`CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email)`;
  yield* sql`CREATE INDEX IF NOT EXISTS idx_contacts_frequency ON contacts(frequency DESC)`;

  // Full-Text Search
  yield* sql`
    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      subject,
      from_address,
      to_addresses,
      body_text,
      content='messages',
      content_rowid='rowid',
      tokenize='porter unicode61'
    )
  `;

  // FTS triggers — use raw exec since triggers contain BEGIN/END blocks
  // that conflict with template literal parsing
  yield* sql`
    CREATE TRIGGER IF NOT EXISTS messages_fts_insert AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts(rowid, subject, from_address, to_addresses, body_text)
      VALUES (new.rowid, new.subject, new.from_address, new.to_addresses, new.body_text);
    END
  `;
  yield* sql`
    CREATE TRIGGER IF NOT EXISTS messages_fts_delete AFTER DELETE ON messages BEGIN
      INSERT INTO messages_fts(messages_fts, rowid, subject, from_address, to_addresses, body_text)
      VALUES ('delete', old.rowid, old.subject, old.from_address, old.to_addresses, old.body_text);
    END
  `;
  yield* sql`
    CREATE TRIGGER IF NOT EXISTS messages_fts_update AFTER UPDATE ON messages BEGIN
      INSERT INTO messages_fts(messages_fts, rowid, subject, from_address, to_addresses, body_text)
      VALUES ('delete', old.rowid, old.subject, old.from_address, old.to_addresses, old.body_text);
      INSERT INTO messages_fts(rowid, subject, from_address, to_addresses, body_text)
      VALUES (new.rowid, new.subject, new.from_address, new.to_addresses, new.body_text);
    END
  `;
});
