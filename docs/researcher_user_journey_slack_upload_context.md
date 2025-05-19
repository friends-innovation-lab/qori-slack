# 🧭 CivicMind Researcher Journey – Slack-Based Workflow (Updated with Context)

This file outlines the CivicMind researcher workflow, including Slack-based research artifact uploads, AI-powered analysis, and exportable outputs.

---

## 👤 Persona
Human-centered researcher or service designer working in civic tech (e.g., VA).

---

## 🟢 Step 1: Create a New Research Project

> _"We're starting a new research sprint on benefits navigation."_

Run the Slack command:
```
/civicmind new_project "Benefits Navigation"
```

CivicMind generates:
- `research-plan.md` (VA-style)
- `conversation-guide.md`
- `participant-tracker.md`
- Consent form link (Google Doc)
- A project folder in GitHub, S3, or internal storage

Posts a Slack confirmation with template links and workspace context.

---

## 🟡 Step 2: Upload Research Artifacts via Slack

> _"I just finished two interviews — one audio file and one transcript doc."_

There are two ways to upload documents, audio, or notes:

### 🔹 Method 1: Slash Command
```
/civicmind upload
```
Bot prompts the user to:
- Attach a file
- Select project
- Optionally tag (e.g. `interview`, `eligibility`, `benefits`)

### 🔹 Method 2: Drag + Drop to Slack Channel
- User uploads a file in `#research-digests` or `#project-channel`
- CivicMind detects the file and replies:
  > _“I noticed you uploaded `interview_03.wav`. Should I transcribe and tag this for your project?”_
  > 🔘 [Yes – add to “Benefits Navigation”]  
  > 🔘 [No – ignore this file]

### ✅ After Upload
- File is stored in project-specific storage
- CivicMind:
  - Transcribes audio
  - Parses and extracts text from documents
  - Tags quotes/themes
  - Sends Slack reply with options:
    - View transcript
    - Generate summary
    - Export insights

---

## 🔵 Step 3: Generate Themes, Quotes, and Insights

> _"What themes are emerging so far from our benefits navigation interviews?"_

Run:
```
/civicmind analyze "Benefits Navigation"
```

CivicMind:
- Tags quotes by theme and sentiment
- Outputs markdown insight cards
- Groups findings into a summary report
- Posts digest in Slack

---

## 🟣 Step 4: Review and Edit Insights

> _"Before I share this, I want to review the AI-generated summaries and tweak a few quotes."_

Researchers receive:
- Markdown summaries
- Editable insight cards
- Threaded Slack posts or GitHub Issues

---

## 🟠 Step 5: Export to Other Platforms

> _"I need to share a summary with my PM and paste quotes into Miro for synthesis."_

Export formats include:
- ✅ Google Sheet (.csv) for Jira or Airtable
- ✅ Miro Sticky Notes CSV
- ✅ PDF briefing

Use command:
```
/civicmind export "Benefits Navigation" format=csv
```

CivicMind posts:
> _“Here’s your download link for export:”_  
> 🔗 Google Sheet | 🔗 Miro CSV | 🔗 PDF

---

## 🔴 Step 6: Share and Act

- Auto-post Slack summary in `#research-digests`
- Push issues to GitHub or Jira
- Link insights to Figma or design artifacts

---

## ✅ Summary Table

| Step       | Tool / Output                   |
|------------|----------------------------------|
| Create     | Slackbot → Templates             |
| Upload     | Slackbot or Channel Drop         |
| Analyze    | AI tags + summaries              |
| Review     | Markdown + Issue generation      |
| Export     | CSV, Miro, PDF                   |
| Share      | Slack + GitHub digests           |

---

## 🧠 Human-Centered Features

- All outputs are editable and marked as AI-generated
- Version history and reviewer audit trail
- Consent forms via Google Docs

---
