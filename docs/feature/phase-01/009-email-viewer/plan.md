---
status: pending
---

# 009 — Email Body Viewer

## Phase
1 — Foundation (MVP)

## Goal
Build the message viewer panel that renders email content safely in a sandboxed iframe, displays message headers (from, to, cc, date, subject), and handles both HTML and plain-text emails.

## Prerequisites
- 006-api-routes (message detail endpoint with body content)
- 007-react-layout (Layout shell, right panel slot)
- 008-message-list (selectedMessageId state)

## References
- `TECH_SPEC.md` §8.5 — HTML email rendering (sandboxing rules)
- `TECH_SPEC.md` §9 — security considerations

## Scope

### 1. Build the MessageViewer component
- Location: `src/client/components/MessageViewer/MessageViewer.tsx`
- Reads `selectedMessageId` from Zustand store
- Uses `useMessage(messageId)` query hook
- Shows loading state while message detail is fetching (especially on-demand body fetch)

### 2. Build the MessageHeader component
- Location: `src/client/components/MessageViewer/MessageHeader.tsx`
- Display:
  - From: name + email address
  - To: list of recipients
  - CC: list (if present)
  - Date: full date/time
  - Subject: full text
- Collapsible "show details" for full recipient lists

### 3. Build the EmailBody component (HTML rendering)
- Location: `src/client/components/MessageViewer/EmailBody.tsx`
- Render HTML emails in `<iframe sandbox="allow-popups">`
- Security measures per TECH_SPEC §8.5:
  - `sandbox="allow-popups"` — no scripts, no forms, no same-origin
  - Rewrite relative URLs to absolute (based on message domain)
  - Block remote images by default (Phase 1) — strip `<img src="http...">` or replace with placeholder
  - Inject a base stylesheet for consistent typography:
    - Font: system font stack
    - Max-width constraint
    - Sensible defaults for tables, links
- Write content to iframe via `srcdoc` attribute or `blob:` URL
- Auto-resize iframe height to fit content (postMessage from iframe or MutationObserver)

### 4. Build plain-text email rendering
- In `EmailBody.tsx`:
- If `body_html` is null/empty, fall back to `body_text`
- Render with `white-space: pre-wrap`
- Auto-link URLs (regex or simple linkifier)
- Auto-link email addresses

### 5. Build the attachment list
- Location: `src/client/components/MessageViewer/AttachmentList.tsx`
- Display attachment metadata below the email body:
  - Filename
  - File size (formatted: "1.2 MB")
  - File type icon (generic for now)
- Download button (links to `/attachments/:id/download` — endpoint not implemented yet, wire the UI)
- Inline images: note their presence but don't render yet (Phase 5)

### 6. Empty state
- When no message is selected, show a centered empty state
- "Select a message to read" or similar

### 7. Loading state
- While message body is being fetched (on-demand from IMAP):
  - Show message headers immediately (from envelope data in the list)
  - Show a loading spinner in the body area
  - "Loading message..." text

## Verification
- Selecting a message in the list shows it in the viewer
- HTML emails render safely in the sandboxed iframe
- No JavaScript execution in email content
- Plain-text emails render with proper whitespace and auto-linked URLs
- Remote images are blocked (no tracking pixel loading)
- Attachment list shows correct metadata
- Empty state when no message selected
- Loading state while body is fetching
- `bunx tsc --noEmit` passes

## Output
- `src/client/components/MessageViewer/MessageViewer.tsx`
- `src/client/components/MessageViewer/MessageHeader.tsx`
- `src/client/components/MessageViewer/EmailBody.tsx`
- `src/client/components/MessageViewer/AttachmentList.tsx`
