# Alpha Polish Tracker

Running log of small bugs, UX rough edges, and cleanup tasks discovered during alpha testing. Not urgent individually — batch these up and knock them out periodically.

## How this works
- Add items as I find them. One line per item.
- When I sit down to fix a batch, move completed items under "Fixed" with the commit SHA.
- Severity: 🔴 flow-blocker / 🟡 data integrity / 🟢 UX polish / 🔵 cosmetic.

## Command status

| Command | Status | Notes |
|---|---|---|
| /qori-start | ✅ Works | Full end-to-end verified (2026-04-23) |
| /qori-repo | ⚠️ Works with rough edge | See "Open issues" below |
| /qori-plan | 🔴 Broken | Plan/guide don't generate; brief saves to wrong repo |
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
| /qori-request | 🔴 Broken | No approval notification sent to stakeholder |
| /qori-learn | ❓ Not yet tested | |
| /qori-ask | 🚫 Disabled | Tied to RAG, disabled for alpha |

## Open issues

### 🔴 /qori-plan: research plan and discussion guide didn't generate
Blocker — stops you from continuing the flow. Could be a YAML template not found (wrong repo), Claude API error, timeout, or write failure. Needs log investigation to determine root cause.

### 🔴 /qori-plan: research brief saved to wrong location
Brief saved to `beta-test/tester_content/01-planning/` instead of `qori-studies/friends-lab/alpha/research/[study]/01-planning/`. Almost certainly a `GITHUB_REPO` vs `GITHUB_CONFIG_REPO` classification miss — the brief-writing code path is reading/writing to the wrong repo, or has a hardcoded path from the old single-repo setup. Likely missed in the Option 2 refactor.

### 🔴 /qori-request: no approval notification sent back to stakeholder
After submitting a research request, no notification is sent back to the stakeholder. Possibly related to changing the auto-filled "Submitted by" name. Needs investigation — might be a Slack user ID lookup failure when the name doesn't match, or the approval flow isn't fully wired up.

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

## Post-Railway Alpha Test Findings (2026-04-24)

Discovered during first full end-to-end alpha test on Railway. ~95% of flows working.

### 🔴 Flow-blockers

- **`/qori-synthesis`: Usability Issues section doesn't generate.** Service blueprint modal should pull in stakeholder notes but doesn't.
- **Reports and some synthesis notes getting truncated.** Suspect token limit issue in YAML templates — generated content is cut off mid-section.
- **Observer manager saves over the participant** when a new observer is added to the same session. Observer count stays at 1/3 instead of counting up.

### 🟡 Data integrity

- **`/qori-update-participant`: new notes overwrite original notes** instead of appending or versioning. Previous notes are lost.
- **Project Timeline in Research Plan doesn't read from date inputs** in the modal. Timeline section ignores the dates the user entered.
- **Generation dates on synthesis files are incorrect.** Affinity mapping and other synthesis outputs show wrong dates.

### 🟢 UX polish

- **Email output contains `**` markdown bolds** that should be stripped for plain text email clients.
- **"Continue to another email" button in email flow doesn't work.** Flow dead-ends after first email.
- **Follow-up message modal missing a duration button.** Results in placeholder text (e.g., `{{duration}}`) being inserted into the output.
- **Observer notification threshold is 2 participants, should be 3 or 4.** Was set to 2 for testing — needs to be raised for production use.

### 🔵 Cosmetic (save for last)

- **YAML template audit for modern GitHub output styling.** Review all generated files for consistent, clean Markdown rendering on GitHub.

## Fixed

(Move items here with the commit SHA when resolved.)

### ✅ Railway migration (2026-04-23 – 2026-04-24)
Railway deployment complete. Backend, Postgres, and Redis all running. 22 migrations applied. End-to-end Slack flow verified.

### ✅ Env var debugging (2026-04-23 – 2026-04-24)
`SLACK_APP_TOKEN` and `GITHUB_TOKEN` were both truncated/malformed when pasted into Railway's Variables UI. Fixed by re-pasting full values. Documented in CLAUDE.md as a gotcha.
