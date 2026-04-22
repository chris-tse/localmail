---
status: pending
---

# 021 — Full-Text Search

## Phase

4 — Real-Time + Search

## Goal

Implement search across all synced messages using SQLite FTS5, with a search UI that shows results with context highlighting.

## Prerequisites

- 002-database-setup (FTS5 virtual table and triggers)
- 006-api-routes (API infrastructure)

## References

- `TECH_SPEC.md` §7.1 — search.query endpoint
- `TECH_SPEC.md` §3.1 — messages_fts table

## Scope

### 1. Add search API endpoint

- `GET /search?q=...&accountId=...&limit=20`
- Query `messages_fts` using FTS5 `MATCH` syntax
- Join with `messages` table for full metadata
- Optional: filter by account
- Return ranked results with snippet highlighting (`snippet()` FTS5 function)

### 2. Build search UI

- Location: `src/client/components/Search/`
- Search input in the header area (focused by `/` shortcut)
- Results dropdown/panel showing:
  - Sender, subject, date
  - Highlighted snippet showing match context
  - Account/folder indicator
- Click result → navigate to that message

### 3. Search debouncing

- Debounce input by 300ms
- Show loading indicator while searching
- Cancel previous request on new input

## Verification

- Search finds messages by subject, sender, body text
- Results are ranked by relevance
- Snippets show highlighted match context
- Search across multiple accounts works
- Empty query shows no results
- `/` shortcut focuses search input

## Output

- `src/server/api/search.ts`
- `src/client/components/Search/SearchBar.tsx`
- `src/client/components/Search/SearchResults.tsx`
