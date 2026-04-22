---
status: pending
---

# 020 — Poll Scheduler

## Phase

4 — Real-Time + Search

## Goal

Implement background polling for folders not covered by IDLE, using Effect's scheduling primitives. Detect flag changes and new messages across all folders.

## Prerequisites

- 005-imap-sync-engine (delta sync logic)
- 018-imap-idle (IDLE covers the active folder; polling covers the rest)

## References

- `TECH_SPEC.md` §5.1 — polling every 5 minutes, CONDSTORE delta detection

## Scope

### 1. Create the scheduler

- Location: `src/server/sync/scheduler.ts`
- Per account, run `Effect.repeat(syncAllFolders, Schedule.spaced("5 minutes"))` for non-IDLE folders
- Skip the folder currently under IDLE
- Use CONDSTORE (`CHANGEDSINCE`) when available for efficient delta detection
- Fall back to UID-based delta when CONDSTORE not supported

### 2. Stagger account polling

- Don't poll all accounts simultaneously
- Stagger by `Schedule.addDelay` or similar to spread load

### 3. Emit events on changes

- Publish to PubSub when polling detects:
  - New messages
  - Flag changes
  - Folder count changes

## Verification

- Non-IDLE folders detect new messages within 5 minutes
- Flag changes made on another device are detected
- Multiple accounts don't all poll at the same instant
- CONDSTORE delta detection works when server supports it

## Output

- `src/server/sync/scheduler.ts`
- Updated `src/server/sync/engine.ts`
