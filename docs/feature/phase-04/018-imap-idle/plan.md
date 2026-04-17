---
status: pending
---

# 018 — IMAP IDLE for Push Notifications

## Phase
4 — Real-Time + Search

## Goal
Maintain IMAP IDLE connections for real-time new mail detection. When a new message arrives in the actively-viewed folder, detect it immediately rather than waiting for the next poll.

## Prerequisites
- 005-imap-sync-engine (IMAP connection management)

## References
- `TECH_SPEC.md` §5.1 — IDLE description
- `TECH_SPEC.md` §2.2 — process model (sync workers)

## Scope

### 1. Implement IDLE loop as an Effect fiber
- Per account, maintain one IDLE connection on the currently-viewed folder
- IDLE loop runs as its own fiber
- When IDLE notification arrives:
  1. Break IDLE
  2. Run delta sync on the folder
  3. Resume IDLE
- `Fiber.interrupt` cleanly breaks the IDLE command when switching folders

### 2. Folder switching
- When the user switches to a different folder:
  1. Interrupt the current IDLE fiber
  2. SELECT the new folder
  3. Start a new IDLE fiber on it
- If IDLE is not supported by the server, fall back to polling

### 3. IDLE timeout handling
- IMAP servers may drop IDLE after ~29 minutes (RFC 2177)
- Re-issue IDLE before timeout (every 25 minutes)

## Verification
- New email arriving in Gmail INBOX detected within seconds (not 5 minutes)
- Switching folders correctly moves IDLE to the new folder
- Server disconnect during IDLE triggers reconnection
- Servers without IDLE support fall back gracefully

## Output
- Updated `src/server/sync/connection.ts`
- Updated `src/server/sync/engine.ts`
