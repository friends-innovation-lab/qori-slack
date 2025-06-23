# 🧠 CivicMind: Augmenting Civic Tech Research with AI

**CivicMind** is an agentic AI built specifically for civic technologists and public interest researchers. It accelerates the messy, vital work of user research without compromising the care, ethics, and context that make it human-centered.

Built by [Friends From The City](https://www.friendsfromthecity.com), CivicMind is an open-source Slack-native research bot that helps civic design teams move faster without losing rigor. It supports every stage of the research cycle—from planning and fieldwork to synthesis and delivery—by automating documentation, summarization, and insight sharing.

> “CivicMind keeps research moving, visible, and human. CivicMind turns research into momentum.”

Unlike generic productivity bots, **CivicMind is purpose-built for public service teams**:  
- It reduces ResearchOps friction. No more cobbling together templates or folder structures.
- It helps design studies, from research plans to interview guides. 
- It supports study creation, automates transcription, and tags insights thematically.  
- It helps synthesize and summarize findings quickly, without relying on memory or manual labor.  
- It makes research visible by posting digests in Slack and converting insights into GitHub issues.  
- It ensures that **insights don’t just sit in decks. They actively shape delivery.**

CivicMind weaves research directly into the way public interest teams build. It connects the people doing the work with the systems being designed for them, ensuring that insights flow into delivery instead of getting lost. With CivicMind, research becomes part of the team’s operating system, always present and always actionable.

---

## 📌 Follow the MVP Progress  
Stay up-to-date with feature development by following our [CivicMind MVP GitHub Project Board](https://github.com/orgs/Friends-From-The-City/projects/2)

---

## ✨ What It Does (MVP Features)

### 🧪 ResearchOps

- **Slack-Initiated Research Kickoff**  
  Launch new studies with a single command like `/new study`, pre-populating folders, templates, and study metadata.

- **Document Summarization**  
  Drop in existing Docs, PDFs, or Markdown files to extract key themes, quotes, and pain points from previous research.

### 🎙️ Fieldwork
- **Transcription + Auto-Tagging**  
  Upload interview audio to receive a full transcript with quotes tagged by theme, sentiment, and user pain points.

- **AI-Powered Slack Q&A**  
  Ask questions like “What did users say about benefits navigation?” and get instant summaries, quotes, and links to source materials.

### 🧠 Synthesis
- **Auto-Report Generation**  
  Generate insight reports in Markdown or PDF from your notes and transcripts with just a few clicks.

- **Insight-to-Issue Workflow**  
  Convert research findings into GitHub Issues that reference specific quotes, themes, and transcripts.

### 📢 Share Out
- **Weekly Slack Digests**  
  Auto-publish research summaries, tagged by theme or project, into Slack channels to keep teams informed and engaged. 

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

*Architecture diagram to be embedded or linked here once saved successfully.*

---

## 🔐 Privacy, Ethics & Human Oversight

CivicMind is built to uphold civic trust:
- FedRAMP-aware architecture (planning)  
- Human-in-the-loop review for all AI output  
- Version logging and edit traceability  
- PII/PHI redaction (coming soon)  

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

Or start a new research study:
```
/new study "Benefits Navigation Interviews"
```
---

## 👐 Contributing

We welcome contributions from civic designers, developers, and researchers.

- 📄 See `CONTRIBUTING.md`  
- 🛠️ Open an Issue for bugs or ideas  
- 🌐 Join our Slack to collaborate  

---

## 📜 License

MIT License

---

## ✨ Maintained By

Built with care by [Friends From The City](https://www.friendsfromthecity.com)
