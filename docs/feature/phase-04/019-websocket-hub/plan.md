---
status: pending
---

# 019 — WebSocket Event Hub

## Phase

4 — Real-Time + Search

## Goal

Push real-time events (new messages, flag changes, sync status, folder counts) from the server to all connected browser clients via WebSocket.

## Prerequisites

- 003-effect-server (BunHttpServer with WebSocket upgrade support)
- 018-imap-idle (events to push)

## References

- `TECH_SPEC.md` §7.2 — WebSocket event types

## Scope

### 1. Create the PubSub-based event hub

- Location: `src/server/ws/hub.ts`
- `PubSub<WSEvent>` for internal event distribution
- Sync fibers publish events, WebSocket connections subscribe
- Backpressure: dropping oldest if a slow client falls behind

### 2. WebSocket upgrade handling

- In the server entrypoint, handle WebSocket upgrade requests
- Each connected client subscribes to the PubSub
- On disconnect, clean up subscription

### 3. Event types (per TECH_SPEC §7.2)

- `new_message` — fired when sync detects a new message
- `flags_updated` — fired when flags change (local or remote)
- `message_deleted` — fired when messages are deleted
- `folder_counts` — fired when total/unread counts change
- `sync_status` — fired when sync starts/stops/errors
- `auth_error` — fired when token refresh fails

### 4. Frontend WebSocket client

- Location: `src/client/ws.ts`
- Connect to `ws://localhost:3000/ws`
- On `new_message`: invalidate message list query for the relevant folder
- On `flags_updated`: update message cache
- On `folder_counts`: update sidebar badges
- On `sync_status`: show sync indicator
- On `auth_error`: show re-auth prompt
- Auto-reconnect on disconnect

## Verification

- New email triggers `new_message` event → message appears in list without manual refresh
- Flag changes from another device detected on next sync → UI updates
- Sync status shows in the UI
- WebSocket reconnects after server restart

## Output

- `src/server/ws/hub.ts`
- `src/client/ws.ts`
- Updated `src/server/index.ts`
