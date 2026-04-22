---
status: pending
---

# 026 — UI Polish + Error Handling

## Phase

5 — Polish

## Goal

Final polish pass: keyboard shortcut overlay, panel resize persistence, account color coding, loading states, error boundaries, empty states, and credential encryption hardening.

## Prerequisites

- All prior features implemented

## References

- `TECH_SPEC.md` §12 Phase 5 checklist

## Scope

### 1. Panel resize persistence

- Make sidebar and message list panels resizable (drag handles)
- Persist widths in localStorage
- Restore on app load

### 2. Account color coding

- Allow users to assign colors to accounts
- Show color indicator in sidebar and message list (unified inbox)
- Color picker in account settings

### 3. Loading states

- Skeleton loaders for message list while syncing
- Spinner for message body fetch
- Progress indicator for initial sync ("Syncing your inbox... 47/312 messages")

### 4. Error boundaries

- React error boundaries at each panel level
- Graceful degradation: if message viewer crashes, sidebar and list still work
- "Something went wrong" with retry button

### 5. Empty states

- No accounts: show account setup CTA
- Empty folder: "No messages"
- No search results: "No messages match your search"
- Offline/disconnected: "Connection lost — retrying..."

### 6. Credential encryption hardening

- Research OS keychain integration:
  - macOS: `security` CLI or `keytar` package for Keychain access
  - Store the AES-256-GCM master key in the OS keychain instead of deriving from hostname
- Implement if feasible, otherwise document as future work

## Verification

- Panel resize works and persists across page loads
- Account colors visible in sidebar and unified inbox
- Loading states smooth and non-jarring
- Error boundaries catch and display errors gracefully
- Empty states show appropriate messaging
- No rough edges in the core workflows

## Output

- Updated `src/client/components/Layout.tsx`
- Updated various component files
- `src/client/components/shared/ErrorBoundary.tsx`
- `src/client/components/shared/LoadingSkeleton.tsx`
- `src/client/components/shared/EmptyState.tsx`
