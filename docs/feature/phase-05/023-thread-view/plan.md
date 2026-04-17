---
status: pending
---

# 023 — Thread View

## Phase
5 — Polish

## Goal
Group related messages into conversation threads in the message viewer, showing the full reply chain in chronological order.

## Prerequisites
- 005-imap-sync-engine (threading assigns thread_ids)
- 009-email-viewer (message viewer)

## References
- `TECH_SPEC.md` §3.2 — threading strategy
- `TECH_SPEC.md` §13.2 Q7 — flat list default, thread view toggle

## Scope

### 1. Thread API endpoint
- `GET /messages/:id/thread` — return all messages with the same `thread_id`, sorted by date ASC
- Include body content for each message in the thread

### 2. Thread view in MessageViewer
- When viewing a message that belongs to a thread:
  - Show all messages in the thread, stacked vertically
  - Each message: collapsible header + body
  - Most recent message expanded by default, others collapsed
  - Click to expand/collapse individual messages

### 3. Thread toggle
- Toggle in the message list header: "Thread view" on/off
- When on: group messages by thread_id in the list, show count
- When off: flat list (current behavior)
- Persist preference in Zustand store

## Verification
- Reply chains display as a single conversation
- Collapsed messages show sender + date, expand on click
- Thread toggle switches between grouped and flat list
- Cross-folder threads work (reply in Sent, original in Inbox)

## Output
- Updated `src/server/api/messages.ts`
- `src/client/components/MessageViewer/ThreadView.tsx`
- Updated `src/client/components/MessageList/MessageList.tsx`
