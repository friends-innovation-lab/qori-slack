# Alpha Polish Tracker

Running log of small bugs, UX rough edges, and cleanup tasks discovered during alpha testing. Not urgent individually — batch these up and knock them out periodically.

## How this works
- Add items as I find them. One line per item.
- When I sit down to fix a batch, move completed items under "Fixed" with the commit SHA.
- Severity: 🔴 blocks a user flow / 🟡 annoying but workable / 🟢 cosmetic.

## Command status

| Command | Status | Notes |
|---|---|---|
| /qori-start | ✅ Works | Full end-to-end verified (2026-04-23) |
| /qori-repo | ⚠️ Works with rough edge | See "Open issues" below |
| /qori-plan | ❓ Not yet tested | |
| /qori-participants | ❓ Not yet tested | |
| /qori-outreach | ❓ Not yet tested | |
| /qori-observe | ❓ Not yet tested | |
| /qori-notes | ❓ Not yet tested | |
| /qori-analyze | ❓ Not yet tested | |
| /qori-synthesis | ❓ Not yet tested | |
| /qori-report | ❓ Not yet tested | |
| /qori-update-participant | ❓ Not yet tested | |
| /qori-delete | ❓ Not yet tested | |
| /qori-sync | ❓ Not yet tested | |
| /qori-request | ❓ Not yet tested | |
| /qori-learn | ❓ Not yet tested | |
| /qori-ask | 🚫 Disabled | Tied to RAG, disabled for alpha |

## Open issues

### 🟡 /qori-repo: orphaned "Processing..." message
After successful submit, a "⏳ Processing your request…" message is posted to the channel, then a separate "Config saved:…" message appears. The placeholder is never cleaned up. Expected behavior: the placeholder should be updated in place with the success message.

### 🟢 CivicMind leftover code
`/civicmind` slash command handlers in events.js (~lines 115–339) are dead code — the command is not registered in the Slack app, so users can never invoke it. Safe to delete.

### 🟢 Sentry should be guarded on SENTRY_DSN env var
The app crashes on boot if SENTRY_DSN is set to anything invalid. Wrap the Sentry init in an `if (process.env.SENTRY_DSN)` check like we did for RAG.

### 🟢 Doubled `research/` path if sub_folder_name is "research"
The `/qori-start` path builder appends a literal `research/` after `sub_folder_name`. If a user picks "research" as their sub_folder_name during `/qori-repo`, they get `folder/research/research/study/`. Document this in the `/qori-repo` modal help text, OR strip trailing "research" from sub_folder_name before using.

### 🟢 Duplicate `ask-study-modal` view handlers
events.js has two `slackApp.view('ask-study-modal', …)` registrations (lines 1021 and 1108). Only one will fire at runtime — Slack Bolt takes the first match. Second registration is dead code. Both are currently RAG-disabled "not available yet" stubs, so no functional impact.

### 🟢 `docker-compose.yml` has obsolete `version:` attribute
Modern Docker Compose ignores it and warns on every command. Cosmetic fix: delete the `version:` line at the top of `docker-compose.yml`.

### 🟢 `/syncfolder` reference may still exist in UI text
The handler was renamed from `/syncfolder` to `/qori-sync` but we should audit all user-facing strings for stale mentions. Also audit for `/start-research` → `/qori-start` in any missed help text.

## Fixed

(Move items here with the commit SHA when resolved.)
