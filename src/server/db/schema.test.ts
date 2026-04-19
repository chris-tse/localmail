import { expect, test } from "bun:test";

import { Tables } from "./schema";

test("exports database storage object names", () => {
  expect(Tables.accounts).toBe("accounts");
  expect(Tables.folders).toBe("folders");
  expect(Tables.messages).toBe("messages");
  expect(Tables.attachments).toBe("attachments");
  expect(Tables.contacts).toBe("contacts");
  expect(Tables.sync_state).toBe("sync_state");
  expect(Tables.messages_fts).toBe("messages_fts");
});
