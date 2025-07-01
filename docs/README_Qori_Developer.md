# Qori ResearchOps Slackbot — Developer Guide

This document supports development of Qori, a Slackbot for research operations teams working in public sector environments. It complements the detailed user journey and outlines core functionality, commands, data structure, and integration logic.

---

## 🧩 Core Workflow Overview

1. `/new study` — Create structured GitHub folders and assign roles
2. `/approve` or `/reject` — Stakeholder review
3. `/civicmind participant_tracker` — Manual or Calendly-based participant intake
4. `/upload-notes` — Collect and summarize research notes
5. `/civicmind [template]` — Run synthesis tools like quote extraction, personas, etc.
6. `/civicmind insight_card` — Push insights to GitHub and notify the PM
7. `/civicmind stakeholder_summary` — Generate executive summaries
8. `/close-study` — Archive and finalize the project
9. `/ask-study` — Enable retrieval of past insights from closed studies

---

## 🛠️ Slack Commands (Slash + Modal Based)

| Command                        | Description                                       |
|-------------------------------|---------------------------------------------------|
| `/new study`                  | Starts a study with GitHub folder structure       |
| `/approve`, `/reject`         | Stakeholder decision flow                         |
| `/upload-notes`               | Attach notes to sessions and trigger summary      |
| `/civicmind [template]`       | Runs any YAML-based research tool                 |
| `/start-session`              | Begins a live session log                         |
| `/close-study`                | Closes the study, updates metadata, archives      |
| `/ask-study`                  | Queries across past summaries, quotes, insights   |

---

## 📁 GitHub Folder Architecture

```
studies/[study-name]/
├── 00-brief/
├── 01-planning/
├── 02-participants/
├── 03-fieldwork/
├── 04-analysis/
├── 05-findings/
├── 06-assets/
└── README.md
```

---

## 📂 Key YAML + Markdown Artifacts

| File                          | Purpose                                             |
|------------------------------|-----------------------------------------------------|
| `notes.yaml`                 | Notes status tracking per session                  |
| `participant_tracker.yaml`   | Schedules, IDs, observers                          |
| `observer_feedback.yaml`     | Captures observer insights                         |
| `status.yaml`                | Study state: drafted, approved, closed             |
| `insight_card.yaml`          | Insight formatting and GitHub issue push           |
| `research_readout.md`        | Final, full synthesis                              |
| `stakeholder_summary.md`     | Executive TL;DR                                    |

---

## 🔗 External Integrations

- **Zoom API**: Auto-detects cloud recordings, matches to sessions, and retrieves transcripts.
- **Calendly**: Pulls participant scheduling data via CSV or API/webhook.
- **GitHub**: Writes structured outputs into folders, opens issues.

---

## 🧠 Automation Hooks

- 30-min session reminders
- Observer feedback requests post-session
- Recruitment status updates
- Slack notifications to PM and stakeholder
- Insight-to-Issue flow with @mention

---

## ✅ Status

This README is aligned with the user journey file and supports GitHub issue creation, Slack command design, and backend architecture planning.

