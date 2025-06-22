# 🧠 CivicMind: Augmenting Civic Tech Research with AI

**CivicMind** is a human-assist, agentic AI built specifically for civic technologists and public interest researchers. It accelerates the messy, vital work of user research without compromising the care, ethics, and context that make it human-centered.

Built by [Friends From The City](https://www.friendsfromthecity.com), CivicMind is an open-source Slack-native research bot that helps civic design teams move faster without losing rigor. It supports every stage of the research cycle—from planning and fieldwork to synthesis and delivery—by automating documentation, summarization, and insight sharing.

> “CivicMind helps you focus on designing for people, not wrestling with documentation.”

Unlike generic productivity bots, **CivicMind is purpose-built for public service teams**:  
- It reduces ResearchOps friction. No more cobbling together templates or folder structures.  
- It supports study creation, automates transcription, and tags insights thematically.  
- It helps synthesize and summarize findings quickly, without relying on memory or manual labor.  
- It makes research visible by posting digests in Slack and converting quotes into GitHub issues.  
- It ensures that **insights don’t just sit in decks. They actively shape delivery.**

CivicMind is not just a research tool. It is the connective tissue between the people doing the work and the systems being built for them. With CivicMind, research becomes part of your operating system, not an afterthought.

---

## 📌 Follow the MVP Progress  
Stay up-to-date with feature development by following our [CivicMind MVP GitHub Project Board](https://github.com/orgs/Friends-From-The-City/projects/2)

---

## ✨ What It Does (MVP Features)

### 🧪 ResearchOps
- Folder Structure + Templates  
- Document Summarization  

### 🎙️ Fieldwork
- Transcription + Auto-Tagging  
- AI-Powered Slack Q&A  

### 🧠 Synthesis
- Auto-Report Generation  
- Insight-to-Issue Workflow  

### 📢 Share Out
- Weekly Slack Digests  

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
