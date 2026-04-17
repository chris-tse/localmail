---
status: pending
---

# 022 — Unified Inbox

## Phase
5 — Polish

## Goal
Provide a single "All Inboxes" view that merges messages from all accounts' INBOX folders into one chronological list.

## Prerequisites
- 006-api-routes (message list pagination)
- 008-message-list (message list UI)

## References
- `TECH_SPEC.md` §13.3 Q13 — virtual folder with UNION ALL

## Scope

### 1. Virtual folder query
- No dedicated table — use `UNION ALL` across all accounts' INBOX folders
- Same cursor-based pagination as regular folders
- Sort by date DESC across all accounts

### 2. API endpoint
- Extend `GET /folders/:folderId/messages` to accept a special `folderId = "unified"` (or add a dedicated `GET /inbox/unified` endpoint)

### 3. Sidebar entry
- "All Inboxes" at the top of the sidebar, above individual accounts
- Unread count = sum of all inbox unread counts
- Active state when viewing unified inbox

### 4. Account indicator in message rows
- When in unified view, show a colored dot or account name tag on each message row to indicate which account it belongs to

## Verification
- Unified inbox shows messages from all accounts interleaved by date
- Pagination works across account boundaries
- Account indicator visible on each message
- Unread count accurate

## Output
- Updated `src/server/api/messages.ts`
- Updated `src/client/components/Sidebar/Sidebar.tsx`
- Updated `src/client/components/MessageList/MessageRow.tsx`
