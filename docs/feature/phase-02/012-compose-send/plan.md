---
status: pending
---

# 012 — Compose, Reply, Forward + SMTP Send

## Phase
2 — Interaction

## Goal
Build the compose UI with TipTap rich text editor, implement reply/reply-all/forward flows, and send emails via SMTP using Nodemailer.

## Prerequisites
- 004-gmail-oauth2 (OAuth2 credentials for SMTP auth)
- 006-api-routes (API infrastructure)
- 009-email-viewer (message context for reply/forward)

## References
- `TECH_SPEC.md` §7.1 — compose.send, compose.saveDraft
- `TECH_SPEC.md` §8.1 — TipTap for rich text

## Scope

### 1. Create the SMTP send service
- Location: `src/server/sync/smtp.ts` (or `src/server/compose/send.ts`)
- Wrap Nodemailer transporter as an Effect service
- Configure per-account:
  - Gmail: `smtp.gmail.com:465`, OAuth2 auth
  - Outlook: `smtp.office365.com:587`, STARTTLS, OAuth2 auth
- `sendEmail(account, envelope)`:
  1. Create transporter with account's SMTP config
  2. Auth with OAuth2 tokens (refresh if needed)
  3. Send via Nodemailer
  4. Return sent message ID
  5. Copy sent message to Sent folder via IMAP APPEND

### 2. Add compose API endpoints
- `POST /compose/send` — send an email
  - Input: accountId, to, cc, bcc, subject, bodyHtml, bodyText, inReplyTo
  - Sets In-Reply-To and References headers for replies
  - Returns `{ messageId }`
- Handler: `src/server/api/compose.ts`

### 3. Build the Compose component
- Location: `src/client/components/Compose/Compose.tsx`
- Full-screen overlay or split panel (modal-style)
- Fields:
  - From: account selector (dropdown)
  - To: email input (comma-separated, later autocomplete in Phase 5)
  - CC/BCC: toggleable fields
  - Subject: text input
  - Body: TipTap rich text editor
- Send button: `Cmd+Enter` shortcut
- Close/discard: `Esc`

### 4. Set up TipTap editor
- Location: `src/client/components/Compose/Editor.tsx`
- Install: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`
- Features:
  - Bold, italic, underline
  - Bullet list, ordered list
  - Links
  - Block quotes (for reply quoting)
- Toolbar with formatting buttons
- Extract plain text version via `editor.getText()`
- Extract HTML version via `editor.getHTML()`

### 5. Implement reply/reply-all/forward
- Reply:
  - Pre-fill To with original sender
  - Pre-fill Subject with `Re: <subject>`
  - Set `inReplyTo` to original message's `internet_message_id`
  - Quote original message body in editor (blockquote)
- Reply All:
  - Pre-fill To with original sender + all To recipients (minus self)
  - Pre-fill CC with original CC (minus self)
- Forward:
  - Pre-fill Subject with `Fwd: <subject>`
  - Include original message body + headers in editor
  - Attachments: note that forwarding attachments is Phase 5 scope

### 6. Wire compose triggers
- `c` keyboard shortcut → open blank compose
- Reply/Forward buttons in MessageViewer → open compose with context
- Update Zustand store with compose state (open/closed, mode, context)

## Verification
- Compose a new email and send it via SMTP
- Email arrives at recipient's inbox
- Reply to a message — correct headers, quoting
- Reply All — correct recipient population
- Forward — correct subject prefix, body inclusion
- `Cmd+Enter` sends, `Esc` closes
- Rich text formatting preserved in sent HTML
- Sent message appears in Sent folder after IMAP APPEND

## Output
- `src/server/compose/send.ts`
- `src/server/api/compose.ts`
- Updated `src/server/api/definition.ts`
- `src/client/components/Compose/Compose.tsx`
- `src/client/components/Compose/Editor.tsx`
