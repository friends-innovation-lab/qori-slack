# CivicMind Deployment Playbook for Government Systems

This playbook guides federal agencies through the secure deployment of **CivicMind**, an AI-powered UXR agent designed for integration into government systems (initially targeting the Department of Veterans Affairs).

---

## 📦 What is CivicMind?

CivicMind is a government-ready AI assistant that automates the slowest parts of UX research:
- Synthesizes research findings and transcripts
- Creates Jira tickets from user insights
- Integrates with GitHub, Slack, and project management tools
- Built with LangChain, Whisper, GPT-4o/Claude, and vector databases

---

## 🧠 System Architecture Overview

Key components (based on system diagram):

- **Slack Bot (Node.js + Bolt):** Interfaces with Slack channels to collect data
- **LangChain-JS Router:** Routes requests, calls functions, manages RAG
- **AI Workers (Python Microservices):**
  - **LLM Worker (GPT-4o / Claude)**
  - **Transcription Worker (Whisper v3)**
  - **CrewAI / LangGraph Agents** for long-running jobs
- **Data Stores:**
  - Vector Store (pgvector / Pinecone)
  - Postgres (transcripts + config)
  - Redis / BullMQ for job queuing

All data stays within the agency’s stack — **no outbound communication required**.

---

## 🛠️ Deployment Steps

### Step 1: Clone the Repo
```bash
git clone https://github.com/Friends-From-The-City/CivicMind-Slack-AI-Bot.git
```

### Step 2: Infrastructure Prerequisites
- FedRAMP-approved environment (e.g., AWS GovCloud, VAEC)
- Docker / container orchestration supported (K8s preferred)
- PostgreSQL and Redis services available
- Slack and GitHub app credentials (admin-configured)

### Step 3: Install Dependencies
Navigate to appropriate subdirectories and install:
```bash
npm install      # for Slack Bot (Node.js)
pip install -r requirements.txt  # for Python AI Workers
```

### Step 4: Environment Configuration
Set up environment variables:
- `.env` files for API keys, model configs
- Redis queue name, Postgres URL, Slack/GitHub tokens
- Optionally pre-seed with vector embeddings

### Step 5: Internal Routing & Job Management
- Redis manages job queuing
- LangChain router dispatches tasks to AI Workers
- Metadata is logged for traceability

---

## 🔒 Security & Compliance Notes

- All components are deployed **within agency systems**
- No external calls or SaaS dependencies required
- Compatible with FIPS-140-2 encryption
- Supports audit logging and strict RBAC

---

## 🤖 Agent Capabilities

| Agent | Function |
|-------|----------|
| LLM Worker | Summarizes transcripts and generates action items |
| Transcription Worker | Converts audio to text using Whisper v3 |
| CrewAI Agent | Runs persistent or chained research workflows |
| LangChain Router | Directs tasks and manages function calling |

---

## 📈 Maintenance & Support

We provide:
- Installation and integration support
- Staff training sessions
- Monthly updates and prompt tuning
- 24/7 bug tracking and patching (via GitHub Issues)

---

## 🚀 Want to Pilot CivicMind?

Reach out to **Friends From The City** to request:
- A sandbox demo
- Deployment guidance
- Custom AI tuning for your agency needs

---

*Built for public systems, designed for the people.* 🇺🇸
