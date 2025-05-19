# 🌐 CivicMind Shared Platform Deployment (Multi-Tenant Model)

## Overview

The Shared Platform model allows CivicMind to serve multiple civic tech teams or agencies from a single hosted instance. Each organization has its own scoped environment—data is logically separated, permissions are enforced, and insights remain private to each org.

This model enables centralized updates, faster onboarding, and controlled multi-agency collaboration without requiring full self-hosting.

---

## 🧩 Key Architecture Components

- **Frontend (Slack/Figma)**: Users interact via Slack commands and soon, plugins.
- **Backend (Flask or FastAPI)**: Handles requests, orchestrates AI pipelines.
- **Database (Postgres)**: Stores metadata, summaries, audit logs, and configs.
- **Object Storage (S3 or GDrive)**: Stores transcripts, research docs, audio files.
- **Vector DB (e.g., Pinecone)**: Used for semantic search over research content.
- **AI Services**: OpenAI GPT-4o, Whisper, Claude (optional).
- **Integrations**: Slack API, GitHub API, Jira API.

---

## 🧩 Multi-Tenant Logic

- Each request is tagged with a `workspace_id` or `organization_id`.
- All data (transcripts, reports, issues) is scoped to that org.
- API tokens for Slack/GitHub are stored per org in a secure config table.
- Slackbot responds only to channels/workspaces it is explicitly connected to.

---

## 🔒 Security & Privacy

- Tokens and secrets encrypted in database or stored in secure vault
- Audit logs generated for every AI-generated output
- Role-based access controls (admin, editor, viewer) per org
- Optional PII redaction before vector DB indexing

---

## 🧪 Deployment Stack

| Layer | Tool |
|-------|------|
| App Framework | Flask / FastAPI |
| Hosting | Render, Fly.io, or AWS GovCloud |
| DB | PostgreSQL with org_id scoping |
| File Storage | S3 (minio, AWS), GDrive |
| Vector DB | Pinecone or Weaviate |
| AI Models | OpenAI (GPT-4o), Whisper, Claude |
| API Integrations | Slack, GitHub, Jira |

---

## 🧱 Diagram

See: `civicmind_shared_platform_diagram.png`