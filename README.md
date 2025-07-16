🧠 Qori: Augmenting Civic Tech Research with AI

**Qori** is an agentic AI built specifically for civic technologists and public interest researchers. It accelerates the messy, vital work of user research without compromising the care, ethics, and context that make it human-centered.

## Research Ops as Code

**What if research workflows could be as version-controlled, collaborative, and scalable as your codebase?**

### YAML → AI → Slack: The Missing Link Between Research and Delivery

Most research dies in decks. **Qori changes that.**

**Here's how:**
- **YAML templates in GitHub** mean your research methods are version-controlled, peer-reviewed, and reusable across projects
- **AI workers** handle the grunt work—transcription, tagging, synthesis—so researchers focus on insights, not operations
- **Structured output in Slack** means findings land where decisions get made, not buried in folders

### Why This Architecture Wins:

**🔄 Version-Controlled Research Methods**  
Templates evolve with your team. New hire? They inherit battle-tested workflows, not blank documents.

**⚡ Zero Context-Switching**  
Teams live in Slack. Research lives in Slack. No more "Did you see that report I shared last week?"

**🛡️ Government-Ready by Design**  
FedRAMP compliance isn't bolted on—it's baked in. Audit trails, data governance, and human oversight from day one.

**🚀 Compound Learning**  
Every study makes the next one smarter. Templates improve, AI gets better at your domain, and institutional knowledge accumulates instead of walking out the door.

**The result?** Research becomes **infrastructure**, not a bottleneck. Teams ship faster because insights flow directly into delivery, not into presentations that get forgotten.

*This is research ops that scales with your mission, not against it.*

## 🏗️ Built as Microservices

**Qori is architected as a distributed system of specialized microservices**, making it:

- **🔧 Modular**: Each service handles one responsibility (transcription, analysis, outreach, etc.)
- **📈 Scalable**: Scale individual services based on demand
- **🛡️ Resilient**: If one service fails, others continue operating
- **🔄 Maintainable**: Update, deploy, and debug services independently
- **🏛️ Government-Ready**: Meets compliance requirements for distributed systems

**Core Architecture Pattern:**
**YAML (GitHub) → AI Processing → Structured Output (Slack)**

The microservices architecture enables:
- **Independent scaling** of AI workers vs. data processing vs. Slack integration
- **Technology flexibility** (Python for AI, Node.js for Slack, etc.)
- **Deployment options** (on-premises, cloud, hybrid) to meet agency requirements
- **Service isolation** for security and compliance auditing

Unlike generic productivity bots, **Qori is purpose-built for public service teams**:
- It reduces ResearchOps friction. No more cobbling together templates or folder structures.
- It helps design studies, from research plans to interview guides.
- It supports study creation, automates transcription, and tags insights thematically.
- It helps synthesize and summarize findings quickly, without relying on memory or manual labor.
- It makes research visible by posting digests in Slack and converting insights into GitHub issues.
- It ensures that **insights don't just sit in decks. They actively shape delivery.**

Qori weaves research directly into the way public interest teams build. It connects the people doing the work with the systems being designed for them, ensuring that insights flow into delivery instead of getting lost. With Qori, research becomes part of the team's operating system, always present and always actionable.

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

## 🎯 Market Position

**The Problem**: Government research teams spend 60-80% of their time on research operations (scheduling, transcribing, organizing, reporting) instead of actual analysis and insight generation. Existing tools are built for enterprise teams, not public service workflows.

**Our Solution**: Purpose-built research operations platform that understands government constraints, compliance requirements, and civic tech workflows.

**Why CivicMind vs. Generic AI Tools**:
- Government-specific templates and workflows out of the box
- FedRAMP compliance pathway (not an afterthought)
- Built for teams who serve the public, not venture-backed startups
- Integrates with government-approved tools (Slack, GitHub) rather than requiring new platforms

**Target Users**: Digital service teams in federal agencies, state governments, and civic tech organizations doing user research.

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

![ChatGPT Image Jun 27, 2025, 03_08_58 PM](https://github.com/user-attachments/assets/bfca4214-0603-42d8-a571-8788d1d9efae)


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
