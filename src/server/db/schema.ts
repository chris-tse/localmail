export const Tables = {
  accounts: "accounts",
  folders: "folders",
  messages: "messages",
  attachments: "attachments",
  contacts: "contacts",
  sync_state: "sync_state",
  messages_fts: "messages_fts",
} as const;

export type TableName = (typeof Tables)[keyof typeof Tables];

export type SqliteBoolean = 0 | 1;

export type AccountProvider = "gmail" | "outlook" | "generic";
export type AuthType = "oauth2" | "password";
export type DiscoverySource = "preset" | "mx" | "autoconfig" | "heuristic" | "manual";
export type FolderRole = "inbox" | "sent" | "drafts" | "trash" | "spam" | "archive" | "all";
export type SyncStatus = "idle" | "syncing" | "error";

type InsertShape<Row, RequiredKeys extends keyof Row> = Pick<Row, RequiredKeys> &
  Partial<Omit<Row, RequiredKeys>>;

export interface AccountRow {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly provider: AccountProvider;
  readonly username: string | null;
  readonly imap_host: string;
  readonly imap_port: number;
  readonly imap_secure: SqliteBoolean;
  readonly smtp_host: string;
  readonly smtp_port: number;
  readonly smtp_secure: SqliteBoolean;
  readonly smtp_starttls: SqliteBoolean;
  readonly auth_type: AuthType;
  readonly access_token: string | null;
  readonly refresh_token: string | null;
  readonly token_expiry: string | null;
  readonly oauth_client_id: string | null;
  readonly oauth_client_secret: string | null;
  readonly password_secret: string | null;
  readonly discovery_source: DiscoverySource | null;
  readonly discovery_confidence: number | null;
  readonly color: string | null;
  readonly sort_order: number;
  readonly is_active: SqliteBoolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export type AccountInsert = InsertShape<
  AccountRow,
  "id" | "name" | "email" | "provider" | "imap_host" | "smtp_host" | "auth_type"
>;
export type AccountUpdate = Partial<Omit<AccountRow, "id" | "created_at">>;

export interface FolderRow {
  readonly id: string;
  readonly account_id: string;
  readonly path: string;
  readonly name: string;
  readonly delimiter: string | null;
  readonly role: FolderRole | null;
  readonly uid_validity: number | null;
  readonly uid_next: number | null;
  readonly highest_modseq: string | null;
  readonly total_messages: number;
  readonly unread_messages: number;
  readonly last_synced_at: string | null;
  readonly sort_order: number;
}

export type FolderInsert = InsertShape<FolderRow, "id" | "account_id" | "path" | "name">;
export type FolderUpdate = Partial<Omit<FolderRow, "id" | "account_id">>;

export interface MessageRow {
  readonly id: string;
  readonly account_id: string;
  readonly folder_id: string;
  readonly uid: number;
  readonly internet_message_id: string | null;
  readonly thread_id: string | null;
  readonly in_reply_to: string | null;
  readonly references_json: string | null;
  readonly subject: string | null;
  readonly from_address: string;
  readonly to_addresses: string | null;
  readonly cc_addresses: string | null;
  readonly bcc_addresses: string | null;
  readonly reply_to: string | null;
  readonly date: string;
  readonly snippet: string | null;
  readonly body_text: string | null;
  readonly body_html: string | null;
  readonly has_body: SqliteBoolean;
  readonly is_read: SqliteBoolean;
  readonly is_starred: SqliteBoolean;
  readonly is_answered: SqliteBoolean;
  readonly is_draft: SqliteBoolean;
  readonly is_deleted: SqliteBoolean;
  readonly labels_json: string | null;
  readonly size_bytes: number | null;
  readonly received_at: string | null;
  readonly synced_at: string;
}

export type MessageInsert = InsertShape<
  MessageRow,
  "id" | "account_id" | "folder_id" | "uid" | "from_address" | "date"
>;
export type MessageUpdate = Partial<Omit<MessageRow, "id" | "account_id" | "folder_id" | "uid">>;

export interface AttachmentRow {
  readonly id: string;
  readonly message_id: string;
  readonly filename: string | null;
  readonly content_type: string;
  readonly size_bytes: number | null;
  readonly content_id: string | null;
  readonly part_id: string;
  readonly is_inline: SqliteBoolean;
  readonly disposition: "attachment" | "inline" | null;
}

export type AttachmentInsert = InsertShape<
  AttachmentRow,
  "id" | "message_id" | "content_type" | "part_id"
>;
export type AttachmentUpdate = Partial<Omit<AttachmentRow, "id" | "message_id">>;

export interface ContactRow {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly frequency: number;
  readonly last_seen_at: string;
  readonly created_at: string;
}

export type ContactInsert = InsertShape<ContactRow, "id" | "email" | "last_seen_at">;
export type ContactUpdate = Partial<Omit<ContactRow, "id" | "email" | "created_at">>;

export interface SyncStateRow {
  readonly folder_id: string;
  readonly sync_from: string | null;
  readonly last_uid: number | null;
  readonly last_modseq: string | null;
  readonly status: SyncStatus;
  readonly error_message: string | null;
  readonly last_full_sync: string | null;
  readonly updated_at: string;
}

export type SyncStateInsert = InsertShape<SyncStateRow, "folder_id">;
export type SyncStateUpdate = Partial<Omit<SyncStateRow, "folder_id">>;
