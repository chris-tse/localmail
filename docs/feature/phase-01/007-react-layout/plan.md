---
status: pending
---

# 007 — React Three-Panel Layout

## Phase

1 — Foundation (MVP)

## Goal

Build the foundational React app shell: three-panel layout (sidebar, message list, message viewer), TanStack Router setup, TanStack Query + HttpApiClient integration, and Tailwind CSS configuration.

## Prerequisites

- 001-project-scaffold (Vite config, React installed)
- 003-effect-server (server running, health endpoint)
- 006-api-routes (API endpoints to fetch data from)

## References

- `TECH_SPEC.md` §8.1 — frontend stack
- `TECH_SPEC.md` §8.2 — layout diagram

## Scope

### 1. Set up the React entry point

- `src/client/index.html` — minimal HTML shell with `<div id="root">`
- `src/client/main.tsx` — React root, TanStack Query provider, Router provider

### 2. Configure TanStack Router

- File-based routing under `src/client/routes/`
- Root layout route with the three-panel shell
- Routes:
  - `/` — redirects to first account's inbox
  - `/account/:accountId/folder/:folderId` — main mail view
  - `/message/:messageId` — message detail (updates viewer panel)

### 3. Create the API client

- Location: `src/client/api.ts`
- Use `HttpApiClient.make(Api)` derived from the shared API definition
- Wrap in TanStack Query hooks:
  - `useAccounts()` — `useQuery` for account list
  - `useFolders(accountId)` — `useQuery` for folder list
  - `useMessages(folderId, cursor?)` — `useInfiniteQuery` for paginated messages
  - `useMessage(messageId)` — `useQuery` for full message detail

### 4. Build the Layout component

- Location: `src/client/components/Layout.tsx`
- Three-panel layout using CSS Grid or Flexbox:
  ```
  grid-template-columns: 220px 350px 1fr
  ```
- Panels: Sidebar, MessageList, MessageViewer
- Full viewport height (`h-screen`)
- Vertical dividers between panels

### 5. Build the Sidebar component

- Location: `src/client/components/Sidebar/Sidebar.tsx`
- For each account:
  - Account name with color indicator
  - Folder list beneath, sorted by role
  - Unread badge on folders with unread messages
- Highlight active folder
- Click folder → navigate to `/account/:accountId/folder/:folderId`

### 6. Configure Tailwind CSS

- `src/client/index.css` — Tailwind imports + base styles
- Design tokens:
  - Background: dark theme (email clients look better dark)
  - Accent color for selection/active states
  - Typography: system font stack or Inter

### 7. Create Zustand store for UI state

- Location: `src/client/stores/ui.ts`
- State:
  - `selectedMessageId: string | null`
  - `sidebarWidth: number`
  - `messageListWidth: number`

## Verification

- `bun run build` produces client bundle in `dist/client/`
- App loads at `localhost:3000` and shows three-panel layout
- Sidebar shows accounts and folders from the API
- Clicking a folder navigates and updates the URL
- Layout is responsive to window resize
- `bunx tsc --noEmit` passes

## Output

- `src/client/index.html`
- `src/client/main.tsx`
- `src/client/index.css`
- `src/client/api.ts`
- `src/client/components/Layout.tsx`
- `src/client/components/Sidebar/Sidebar.tsx`
- `src/client/stores/ui.ts`
- `src/client/routes/` (route files)
