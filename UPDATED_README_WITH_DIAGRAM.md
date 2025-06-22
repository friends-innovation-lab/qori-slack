# 🧠 CivicMind: The Human-Assist AI for Civic Tech Research

**CivicMind** is an agentic AI-powered research assistant designed to accelerate human-centered design in civic tech—without losing the human.

Built by [Friends From The City](https://www.friendsfromthecity.com), this open-source bot supports civic designers and researchers by streamlining ResearchOps, Fieldwork, Synthesis, and Share Out tasks. It operates directly within Slack and integrates with tools like GitHub, Google Docs, and Jira.

> “CivicMind helps you focus on designing for people—not wrestling with documentation.”

---

## 📌 Follow the MVP Progress  
Stay up-to-date with feature development by following our [CivicMind MVP GitHub Project Board](https://github.com/orgs/Friends-From-The-City/projects/2)

---

## ✨ What It Does (MVP Features)

### 🧪 ResearchOps
- **Folder Structure + Templates**  
  Create structured research folders from Slack using project-based templates (interviews, readouts, summaries).

- **Document Summarization**  
  Drop in existing Docs, PDFs, or Markdown files to extract themes and insights from past research.

### 🎙️ Fieldwork
- **Transcription + Auto-Tagging**  
  Upload interview audio and receive a transcript with quotes tagged by theme, sentiment, and pain points.

- **AI-Powered Slack Q&A**  
  Ask natural-language questions like “What did users say about benefits navigation?” → Get tagged quotes, themes, and source links.

### 🧠 Synthesis
- **Auto-Report Generation**  
  Upload transcripts or notes to generate summaries in Markdown or PDF formats.

- **Insight-to-Issue Workflow**  
  Convert key insights into GitHub Issues linked to quotes, transcripts, and themes.

### 📢 Share Out
- **Weekly Slack Digests**  
  Automatically publish project-based or theme-based research digests into selected Slack channels.

---

## 🤖 About Qori

**Qori** is the agentic AI behind CivicMind. It’s a “human-assist” bot designed to work alongside public interest technologists—not replace them. Qori doesn’t just answer questions. It proactively helps manage research artifacts, summarize findings, and keep insights flowing into delivery tools. 

Qori blends language intelligence with structured workflows, ensuring research stays visible, traceable, and human-reviewed at every step.

---

## 🧭 Why It Matters

Civic tech teams face:
- Long, manual research cycles
- Siloed findings that go unused
- Burnout from admin and documentation

**CivicMind shortens the distance between research and action**, making it easier to:
- Keep teams aligned and informed
- Push insights into delivery tools
- Practice repeatable, ethical, and inclusive research

---

## 🗺️ MVP Roadmap

- [ ] Slackbot for research Q&A  
- [ ] Markdown/PDF report generator  
- [ ] Whisper-based transcription  
- [ ] GitHub Issue sync  
- [ ] Weekly Slack digest  
- [ ] Human-in-the-loop UX  
- [ ] Ethical AI guidance + logging

---

## 🧰 Tech Stack

| Component        | Stack / Service                                                                 |
|------------------|----------------------------------------------------------------------------------|
| **Frontend**      | Slackbot (Node.js + Bolt)                                                       |
| **Router Layer**  | LangChain-JS (function calling + RAG)                                           |
| **Backend Services** | Python Microservices (FastAPI/Flask)                                         |
| **AI Workers**     | LLM Worker (GPT-4o / Claude), Transcription Worker (Whisper v3), CrewAI + LangGraph |
| **Data Stores**    | Postgres (config + transcripts), Vector Store (pgvector / Pinecone)            |
| **Infra / Queue**  | Redis / BullMQ (Job Queue), Agenda.js (for weekly digests)                     |
| **Integrations**   | Slack, GitHub (via Octokit), Google Docs, Jira                                 |

---

## 🗂️ System Architecture

![CivicMind Architecture Diagram](CivicMind_Architecture_Diagram_LowRes.png)

---

## 🔐 Privacy, Ethics & Human Oversight

CivicMind is built to uphold civic trust:
- **FedRAMP-aware architecture** (planning)
- **Human-in-the-loop review for all AI output**
- **Version logging and edit traceability**
- **PII/PHI redaction (coming soon)**

See [`docs/ai-ethics.md`](docs/ai-ethics.md) and [`docs/privacy-governance.md`](docs/privacy-governance.md) for details.

---

## 🛠️ Installation (Coming Soon)

Instructions to deploy CivicMind locally or to a cloud workspace will be added in the next release.

---

## 🚀 Usage

Once installed, simply message the Slackbot:
```
/ask What did users say about onboarding pain points?
```

Or upload a file:
```
/upload interview_audio.mp3
```

---

## 👐 Contributing

We welcome contributions from civic designers, developers, and researchers.

- 📄 See [`CONTRIBUTING.md`](docs/CONTRIBUTING.md)
- 🛠️ Open an Issue for bugs or ideas
- 🌐 Join our Slack to collaborate

---

## 📜 License

[MIT License](LICENSE)

---

## ✨ Maintained By

Built with care by [Friends From The City](https://www.friendsfromthecity.com)
