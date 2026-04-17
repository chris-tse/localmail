---
status: pending
---

# 014 — Full Keyboard Shortcuts

## Phase
2 — Interaction

## Goal
Implement the complete keyboard shortcut set from the TECH_SPEC, including multi-key sequences (`g` then `i`) and context-aware shortcuts (compose mode vs. list mode).

## Prerequisites
- 008-message-list (j/k navigation already started)
- 011-message-actions (actions to trigger)
- 012-compose-send (compose to open/close)

## References
- `TECH_SPEC.md` §8.3 — full keyboard shortcut table

## Scope

### 1. Set up tinykeys globally
- Location: `src/client/hooks/useKeyboardShortcuts.ts`
- Register shortcuts at the app root level
- Context-aware: disable mail shortcuts when compose is focused or when typing in an input

### 2. Implement all shortcuts from TECH_SPEC §8.3
| Key | Action | Context |
|-----|--------|---------|
| `j` / `k` | Next / previous message | List |
| `Enter` | Open selected message | List |
| `e` | Archive | List/Viewer |
| `#` | Delete (move to trash) | List/Viewer |
| `r` | Reply | Viewer |
| `a` | Reply all | Viewer |
| `f` | Forward | Viewer |
| `c` | Compose new | Global |
| `s` | Toggle star | List/Viewer |
| `u` | Toggle read/unread | List/Viewer |
| `/` | Focus search | Global |
| `Esc` | Close compose / back to list | Global |
| `g i` | Go to Inbox | Global |
| `g s` | Go to Sent | Global |
| `g d` | Go to Drafts | Global |
| `1`–`9` | Switch account | Global |
| `Cmd+Enter` | Send message | Compose |
| `?` | Show shortcut overlay | Global |

### 3. Multi-key sequences
- `g` prefix: set a 1-second timeout for the second key
- If timeout expires or non-matching key pressed, cancel

### 4. Shortcut overlay
- Location: `src/client/components/shared/ShortcutOverlay.tsx`
- Modal triggered by `?`
- Grouped by category: Navigation, Actions, Compose, Go-to
- Dismiss with `Esc` or clicking outside

## Verification
- All shortcuts from the table work correctly
- Shortcuts disabled when typing in input fields
- `g` then `i` navigates to inbox
- `?` shows overlay, `Esc` closes it
- No conflicts between shortcuts

## Output
- `src/client/hooks/useKeyboardShortcuts.ts`
- `src/client/components/shared/ShortcutOverlay.tsx`
