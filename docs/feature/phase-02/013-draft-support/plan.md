---
status: pending
---

# 013 — Draft Save/Restore

## Phase

2 — Interaction

## Goal

Implement auto-saving drafts to the local database and IMAP Drafts folder, and restoring drafts in the compose editor.

## Prerequisites

- 012-compose-send (compose UI and editor)

## References

- `TECH_SPEC.md` §7.1 — compose.saveDraft

## Scope

### 1. Add draft API endpoint

- `POST /compose/draft` — save or update a draft
  - Input: accountId, to, cc, bcc, subject, bodyHtml, bodyText, draftId (optional for update)
  - Returns `{ id }`
- Handler: update `src/server/api/compose.ts`

### 2. Implement draft storage

- Save drafts as messages in the local DB with `is_draft = 1`
- Also APPEND to IMAP Drafts folder
- On update: replace the IMAP draft (delete old, append new)
- On send: delete the draft from DB and IMAP

### 3. Auto-save in compose

- Debounced auto-save (every 30 seconds of inactivity, or on blur)
- Show "Draft saved" indicator
- Track dirty state to avoid unnecessary saves

### 4. Draft list in UI

- Drafts folder shows draft messages
- Clicking a draft opens the compose editor with pre-filled content
- Restore all fields: to, cc, bcc, subject, body

## Verification

- Compose a message, wait — draft auto-saves
- Close compose, navigate to Drafts, open draft — content restored
- Edit and send a draft — draft deleted from Drafts folder
- Discard a draft — draft deleted

## Output

- Updated `src/server/api/compose.ts`
- Updated `src/client/components/Compose/Compose.tsx`
