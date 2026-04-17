---
status: pending
---

# 025 — Remote Image Proxy

## Phase
5 — Polish

## Goal
Proxy remote images in emails through the local server to prevent tracking pixels from revealing the user's IP and read status to senders.

## Prerequisites
- 009-email-viewer (email body rendering)

## References
- `TECH_SPEC.md` §8.5 — proxy remote images
- `TECH_SPEC.md` §13.3 Q10 — proxy by default

## Scope

### 1. Image proxy endpoint
- `GET /proxy/image?url=...` — fetch the remote image server-side, return to the browser
- Set appropriate Content-Type from the upstream response
- Cache fetched images locally (temp directory, TTL-based eviction)

### 2. HTML rewriting
- Before rendering email HTML in the iframe, rewrite all `<img src="https://...">` to point through the proxy
- Also rewrite CSS `background-image: url(...)` references

### 3. User control
- "Load images" button in the message viewer for emails with blocked images
- Per-sender allowlist (future — just the button for now)

## Verification
- Remote images display without leaking the user's IP to the sender
- Images cached locally
- Blocked images show placeholder
- "Load images" button loads them through proxy

## Output
- `src/server/api/proxy.ts`
- Updated `src/client/components/MessageViewer/EmailBody.tsx`
