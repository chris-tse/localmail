---
status: pending
---

# 008 — Message List

## Phase
1 — Foundation (MVP)

## Goal
Build the message list panel that displays messages for the selected folder with infinite scroll pagination, unread indicators, star indicators, and sender/subject/date display.

## Prerequisites
- 006-api-routes (paginated messages endpoint)
- 007-react-layout (Layout shell, API client hooks, Sidebar navigation)

## References
- `TECH_SPEC.md` §8.2 — layout diagram (middle panel)
- `TECH_SPEC.md` §7.1 — messages.list endpoint with cursor pagination

## Scope

### 1. Build the MessageList component
- Location: `src/client/components/MessageList/MessageList.tsx`
- Receives `folderId` from route params
- Uses `useMessages(folderId)` infinite query hook
- Displays messages in a scrollable list, sorted by date descending

### 2. Build the MessageRow component
- Location: `src/client/components/MessageList/MessageRow.tsx`
- Display per row:
  - Sender name (parsed from `from_address` JSON)
  - Subject line (truncated)
  - Snippet (first line of body_text, truncated)
  - Date (relative: "2m ago", "Yesterday", "Mar 15")
  - Star indicator (filled/empty)
  - Unread indicator (bold text + dot, or background color)
- Active/selected state: highlighted background
- Click → set `selectedMessageId` in Zustand store + navigate

### 3. Implement infinite scroll
- Use `useInfiniteQuery` with `getNextPageParam` returning the composite cursor
- Trigger `fetchNextPage` when the user scrolls near the bottom
- Use `IntersectionObserver` on a sentinel element at the end of the list
- Show loading indicator while fetching next page

### 4. Implement keyboard navigation (basic)
- `j` / `k` to move selection up/down in the list
- `Enter` to open (set selectedMessageId)
- Use `tinykeys` for binding
- Track selected index in component state
- Scroll the selected row into view

### 5. Date formatting utility
- Location: `src/client/hooks/useRelativeDate.ts` (or a util)
- Format rules:
  - Under 1 hour: "Xm ago"
  - Today: "HH:MM AM/PM"
  - Yesterday: "Yesterday"
  - This year: "Mon DD"
  - Older: "Mon DD, YYYY"

### 6. Empty state
- When folder has no messages, show a centered empty state message
- "No messages in this folder" or similar

## Verification
- Message list populates when a folder is selected
- Scrolling to bottom loads more messages (pagination works)
- Unread messages visually distinct from read
- Starred messages show star indicator
- Clicking a message highlights it
- `j`/`k` keyboard navigation works
- Empty folder shows empty state
- `bunx tsc --noEmit` passes

## Output
- `src/client/components/MessageList/MessageList.tsx`
- `src/client/components/MessageList/MessageRow.tsx`
- `src/client/hooks/useRelativeDate.ts`
