# 🧭 CivicMind Researcher Journey – Updated MVP Flow

This file outlines the updated researcher workflow using CivicMind, now including automatic template generation and exportable insight formats.

---

## 👤 Persona
Human-centered researcher or service designer working in civic tech (e.g., VA, 18F, Code for America).

---

## 🟢 Step 1: Create a New Research Project

> _"We're starting a new research sprint on benefits navigation."_

Run the Slack command:
```
/civicmind new_project "Benefits Navigation"
```

CivicMind will automatically generate:
- `research-plan.md` (VA-style, with editable prompts)
- `conversation-guide.md`
- `participant-tracker.md`
- Consent form link (Google Doc)
- Project folder in GitHub or S3 for artifact storage

It posts a summary in Slack with all links and locations for editing.

---

## 🟡 Step 2: Upload Research Artifacts

> _"We just wrapped up a few interviews."_

Upload:
- Audio files (MP3, WAV) → CivicMind transcribes via Whisper
- Existing PDFs, Docs, or Markdown files → Parsed and stored
- Notes or CSVs → Converted to insights if formatted correctly

All transcripts and documents are stored in the project folder.

---

## 🔵 Step 3: Generate Themes, Quotes, and Insights

> _"What patterns are emerging in our data?"_

Run:
```
/civicmind analyze "Benefits Navigation"
```

CivicMind will:
- Tag quotes by theme and sentiment
- Generate Markdown insight cards
- Group findings into research summary format
- Push updates to Slack and GitHub

---

## 🟣 Step 4: Review and Edit Insights

Researchers get:
- A Markdown summary (`summary.md`)
- A table of tagged quotes
- Editable insight cards in GitHub Issues or Markdown

---

## 🟠 Step 5: Export to Other Platforms

CivicMind offers exports as:
- ✅ **Google Sheet (.csv)** → for Jira or Airtable import
- ✅ **Miro Sticky Note CSV** → import into Miro directly
- ✅ **PDF Summary** → email to stakeholders

Example Slack command:
```
/civicmind export "benefits-nav" format=csv
```

Or download from a link returned by the bot:
```
🔗 Download your insights as: [Google Sheet](https://link-to-export.com)
```

---

## 🔴 Step 6: Share and Take Action

- Post summary digest in `#research-digests`
- Use Slack commands to generate Issues or Jira tickets
- Link findings to Figma frames, prototypes, or decision logs

---

## ✅ Summary of Key Actions

| Task                     | Tool / Output                     |
|--------------------------|----------------------------------|
| Create Project           | Slackbot → GitHub + Templates    |
| Upload Interviews        | Audio + Docs → CivicMind storage |
| Analyze Data             | Insight Cards, Summary, Tags     |
| Export                   | Google Sheet, Miro, PDF          |
| Share                   | Slack + GitHub summary files     |

---

## 🧠 Human-Centered Safeguards

- All content is human-reviewed before export
- Version control tracks edits
- Export logs are audit-friendly

---

🗂️ Add this file to: `/docs/researcher_user_journey_updated.md`