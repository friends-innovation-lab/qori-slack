# CivicMind-Slack-AI-Bot
**CivicMind** is an AI-powered research assistant designed to accelerate human-centered design in civic tech—without losing the human.
# CivicMind

Built by [Friends From The City](https://www.friendsfromthecity.com), this open-source tool streamlines common ResearchOps and DesignOps tasks like synthesizing interviews, generating reports, managing artifacts, and pushing insights into delivery tools like Slack, GitHub, and Jira.

> 🧠 “CivicMind helps you focus on designing for people—not wrestling with documentation.”

---

## 🔧 What It Does (MVP Features)

- **Slack-based Q&A**  
  Ask: _“What did users say about benefits navigation?”_ and get tagged quotes, summaries, and source links.

- **Auto-report generation**  
  Upload transcripts or notes → Get insight summaries in Markdown or PDF.

- **Transcription + tagging**  
  Upload interview audio → Receive transcripts with quotes tagged by theme, sentiment, and pain points.

- **Document summarization**  
  Drop in existing Docs, PDFs, or Markdown → Extract themes and insights from previous research.

- **GitHub Issue creation**  
  Turn insights into Issues linked to specific quotes, themes, or transcripts.

- **Weekly Slack digests**  
  Auto-publish research digests by theme or project to Slack channels.

---

## 🧪 Why It Matters

Civic tech teams struggle with:
- Manual, slow research cycles
- Poor visibility for findings
- Inefficient synthesis and reporting

CivicMind shortens the distance between research and action, making it easier to:
- Keep stakeholders informed
- Link insights to design tickets
- Create repeatable, human-first research flows

---

## 🗺️ MVP Roadmap

- [ ] Slackbot for research Q&A
- [ ] Markdown report generator
- [ ] Whisper-based transcription
- [ ] GitHub Issue sync
- [ ] Weekly Slack digest
- [ ] Human-in-the-loop review UX
- [ ] Ethical AI guidance + version logging

---

## 🧰 Tech Stack

| Component | Stack |
|----------|-------|
| Frontend | Slackbot (Bolt/Node.js or Flask), Figma plugin (planned) |
| Backend  | Python (FastAPI or Flask), Node.js (optional) |
| AI Engine | OpenAI GPT-4o, Whisper API |
| Storage | Postgres, GDrive or S3 |
| Vector Search | Pinecone or Weaviate |
| Integrations | Slack, GitHub, Jira, Google Docs |

---

## 🔐 Privacy, Ethics & Human Oversight

CivicMind is built to uphold civic trust:
- **FedRAMP-aware architecture planning**
- **Human-in-the-loop for all AI output**
- **Version history and edit traceability**
- **PII/PHI redaction coming soon**

See [`docs/ai-ethics.md`](docs/ai-ethics.md) and [`docs/privacy-governance.md`](docs/privacy-governance.md) for more.

---

## 👐 Contributing

We welcome contributions from civic designers, developers, and researchers.

- 📄 See [`CONTRIBUTING.md`](CONTRIBUTING.md) to get started.
- 🛠️ Open an Issue to suggest a feature or report a bug.
- 🌐 Join our Slack to collaborate with the team.

---

## 📜 License

[MIT License](LICENSE)

---

## ✨ Maintained By

Built with care by [Friends From The City](https://cityfriends.tech)  
Follow the journey at [@cityfriends.tech](https://www.instagram.com/cityfriends.tech)

