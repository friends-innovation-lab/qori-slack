# CivicMind Product Requirements Document (PRD)

## Product Name
**CivicMind** – An AI-enabled Slackbot that helps government and civic researchers accelerate research operations, synthesis, and sharing workflows. Built with Slack as the primary UI and GitHub for version control and data storage.

---

## Purpose
CivicMind enables researchers, particularly in government (e.g., VA), to reduce manual synthesis work, reuse insights more effectively, and maintain auditability and privacy standards through structured AI workflows.

---

## Goals
- Reduce time to generate research artifacts (briefs, personas, journey maps)
- Enable reuse of insights through centralized GitHub storage
- Provide transparency, privacy, and role control for research operations
- Deliver AI results within tools researchers already use (Slack, GitHub)

---

## Core Features

### 1. Slack-Based Research Actions
- Slash commands (e.g., `/civicmind summarize thread`, `/civicmind generate full brief`)
- Message shortcuts (e.g., "Analyze with CivicMind")
- App Home prompt bar (ChatGPT-style interface)
- Modal inputs for uploading notes or documents

### 2. Template Management
- YAML templates stored in `/templates` directory on GitHub
- Project-specific copies created in `/projects/{project-name}/`
- Placeholders (e.g., `{{problem_statement}}`) used for AI fill-in
- Support for full-document and section-based updates

### 3. AI-Powered Output Generation
- Summarize interview transcripts
- Affinity mapping (theme clustering)
- Persona generation
- Journey mapping
- Executive summaries
- Insight extraction
- Jobs To Be Done identification

### 4. GitHub Integration
- Store all generated files in GitHub for audit/logging
- Commit messages include timestamp and user context
- Support section-based commits with diffs
- Save session metadata and logs in `/sessions/` folder

### 5. Transparency & Trust Features
- AI preview before commit (with approve/edit/discard)
- Commit diff summaries shown in Slack
- Metadata blocks in Markdown files (author, time, source)

### 6. Privacy & Permissions
- Output visibility controls (Private / Team / Public)
- Role-based permissions (Admin, Researcher, Reviewer)
- Confirmation before posting to shared Slack channels

### 7. Slack App Home UI
- Display prompt input
- Run template-based tasks with buttons
- Show recent sessions
- Offer links to project GitHub folders

---

## Templates Supported (Initial Set)
- Research Brief
- Journey Map
- Persona
- Affinity Map
- Interview Summary
- Executive Summary
- Jobs-To-Be-Done Extractor
- Insight Report

---

## User Roles
- **Researcher** – Can generate/edit/share research
- **Reviewer** – Can view and suggest changes
- **Admin** – Can manage templates, settings, permissions

---

## Key User Stories

- As a researcher, I want to summarize interviews in Slack so I can speed up insight generation.
- As a researcher, I want to edit CivicMind’s output before saving to GitHub so I can ensure accuracy.
- As a VA stakeholder, I want all outputs logged and stored in GitHub so that I have auditability.
- As a new team member, I want to browse past research briefs so I can learn faster.

---

## Metrics for Success
- Reduction in time to draft briefs/personas
- % of CivicMind outputs reviewed and committed
- Adoption rate across VA teams
- Number of research projects documented via CivicMind

---

## Next Steps
- Finalize template formats
- Build command parsing and Slack interactions
- Develop preview and privacy features
- Pilot with VA research team
