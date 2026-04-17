---
status: pending
---

# 011 — Message Actions (Read/Star/Delete/Archive/Move)

## Phase
2 — Interaction

## Goal
Implement write operations on messages: mark read/unread, toggle star, delete (move to trash), archive, and move between folders. Both the API endpoints and the IMAP flag/move commands.

## Prerequisites
- 005-imap-sync-engine (IMAP connection for flag updates)
- 006-api-routes (API infrastructure)
- 008-message-list (UI to trigger actions from)

## References
- `TECH_SPEC.md` §7.1 — messages.updateFlags, messages.move, messages.delete
- `TECH_SPEC.md` §5.3 — Gmail archive = remove INBOX label
- `TECH_SPEC.md` §13.2 Q8 — optimistic updates

## Scope

### 1. Add write endpoints to the API
- `PATCH /messages/flags` — update flags (is_read, is_starred, is_deleted) for batch of message IDs
- `POST /messages/move` — move messages to target folder
- `DELETE /messages` — permanent delete (move to trash, or expunge if already in trash)
- Handler: `src/server/api/messages.ts` (extend existing)

### 2. Implement IMAP flag sync
- In `src/server/sync/engine.ts`:
- `updateFlags(messageIds, flags)`:
  1. Group messages by folder
  2. For each folder, SELECT and STORE flags:
     - `is_read` → `\Seen`
     - `is_starred` → `\Flagged`
     - `is_deleted` → `\Deleted`
  3. Update local DB
- `moveMessages(messageIds, targetFolderId)`:
  1. IMAP `MOVE` or `COPY` + `STORE \Deleted` + `EXPUNGE`
  2. Update local DB (change folder_id, new UID)
- Gmail archive: move from INBOX means removing `\Inbox` label (not moving to a folder)

### 3. Implement optimistic updates on the frontend
- In API client hooks:
  - `useMutateFlags()` — `useMutation` with `onMutate` for optimistic update:
    - Update TanStack Query cache immediately
    - Roll back on error via `onError`
  - `useMoveMessages()` — remove from current list optimistically
  - `useDeleteMessages()` — remove from list optimistically

### 4. Add action buttons to the MessageViewer
- Update `src/client/components/MessageViewer/MessageViewer.tsx`:
  - Action bar below headers: Reply, Reply All, Forward (disabled — Phase 2), Archive, Delete, Star
  - Mark as read automatically when message is viewed (after 2 second delay)

### 5. Add action buttons to the MessageList
- Right-click context menu or inline action icons on hover:
  - Star/unstar
  - Mark read/unread
  - Delete
  - Archive

## Verification
- Toggling read/unread updates both local DB and IMAP server
- Starring/unstarring syncs to IMAP
- Delete moves to trash folder
- Archive works correctly (Gmail: remove from INBOX; others: move to Archive)
- Move between folders works
- Optimistic updates: UI updates immediately, rolls back on failure
- Batch operations work (select multiple → action)

## Output
- Updated `src/server/api/definition.ts`
- Updated `src/server/api/messages.ts`
- Updated `src/server/sync/engine.ts`
- Updated `src/client/components/MessageViewer/MessageViewer.tsx`
- Updated `src/client/components/MessageList/MessageRow.tsx`
- New mutation hooks in `src/client/api.ts`
