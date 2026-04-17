---
status: pending
---

# 024 — Contact Autocomplete

## Phase
5 — Polish

## Goal
Auto-populate the contacts table from sent/received messages and provide autocomplete in the compose To/CC/BCC fields.

## Prerequisites
- 005-imap-sync-engine (message data to extract contacts from)
- 012-compose-send (compose UI with recipient fields)

## References
- `TECH_SPEC.md` §3.1 — contacts table
- `TECH_SPEC.md` §7.1 — contacts.search endpoint

## Scope

### 1. Contact extraction during sync
- On message sync, extract unique email addresses from From, To, CC fields
- Upsert into contacts table: increment `frequency`, update `last_seen_at` and `name`

### 2. Search endpoint
- `GET /contacts/search?q=...&limit=10`
- Match on email prefix and name prefix
- Sort by frequency descending (most-contacted first)

### 3. Autocomplete UI in compose
- Replace plain text inputs with autocomplete fields
- Show dropdown as user types
- Display: name + email address
- Select with Enter or click
- Render selected contacts as removable chips/tags

## Verification
- Contacts populated after initial sync
- Typing in To field shows relevant suggestions
- Most-frequent contacts ranked higher
- Multiple recipients work with chip UI

## Output
- `src/server/api/contacts.ts`
- Updated `src/server/sync/engine.ts`
- Updated `src/client/components/Compose/Compose.tsx`
