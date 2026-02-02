# Qori

## What is this project?
Qori is an AI-powered research operations platform for VA (Veterans Affairs) UX research teams. It operates through Slack slash commands that generate structured documents stored in GitHub repositories.

## Tech Stack
- Slack Block Kit for UI (modals)
- YAML workflow configurations for AI processing
- GitHub for document storage
- Handlebars/Jinja2 templating for outputs
- Python (Sam support agent)

## Folder Structure
```
/qori
├── /config
│   ├── /modals          - Slack modal JSON definitions (Block Kit)
│   ├── /prompts         - YAML configs for AI processing logic
│   ├── command-mapping.json  - Routes commands to modals/prompts
│   └── sam-config.yaml  - Sam agent configuration
├── /sam
│   ├── sam-agent.py     - Support agent code
│   ├── sam-prompts.yaml - Sam's response prompts
│   ├── escalation-config.yaml - Escalation routing
│   └── report-template.md - Escalation report template
├── /docs
│   ├── /learn           - Tutorial pages (GitHub Pages)
│   ├── /help            - User documentation
│   └── /internal        - Architecture, deployment, database docs
├── /backend             - Backend code (placeholder, awaiting transfer)
├── /logs                - Runtime logs (gitignored)
├── /study-template      - Folder structure copied for new studies
├── /beta-test           - Active test data (DO NOT modify without asking)
└── /test                - Test input data
```

## Slash Commands
- `/qori` - Show all commands
- `/qori-request` - Stakeholder submits research request
- `/qori-plan` - Create study plan, guides, upload research (7 actions)
- `/qori-participants` - Add or update participants
- `/qori-outreach` - Generate participant messages (6 message types)
- `/qori-observe` - Request to observe a session
- `/qori-notes` - Observer documents session
- `/qori-analyze` - Analyze session data
- `/qori-synthesis` - Cross-session synthesis
- `/qori-report` - Generate stakeholder report + GitHub issues
- `/qori-sam` - Talk to Sam, the support assistant

## Sam Support Agent
Sam is Qori's AI support assistant. Capabilities:
- **Answer questions** - About Qori features and commands
- **Update config** - Modify YAML/JSON files (with confirmation)
- **Diagnose issues** - Validate modals, prompts, references
- **Escalate** - Create support tickets for the team

## Key Principles
- Minimal UI - use Slack's native components
- "Don't bloat" - only add features that solve real problems
- Privacy first - PII redaction built into workflows
- Match real researcher workflows, not idealized processes

## Working with this repo
- Coordinate with Tanzeel (backend developer) before changing file paths
- Modal JSONs must match Slack Block Kit spec
- YAML workflows define the AI prompts and processing logic
- Update `command-mapping.json` when adding new commands

---

## Development Plan

### Completed

**2025-02-02: Folder Restructure & Sam Agent**
- Reorganized folder structure (modals → config/modals, workflows → config/prompts)
- Created `command-mapping.json` to route all 10 slash commands
- Built Sam support agent with conversation handling, diagnostics, escalation
- Added user docs (`docs/help/`) and internal docs (`docs/internal/`)

**2025-01-30: Learn Qori Landing Page Redesign**
- Redesigned docs site to modern SaaS landing page style
- Split hero layout with Slack mockup
- Added feature strip, commands grid, 4-step workflow
- Updated font to Plus Jakarta Sans across all 10 pages

### Upcoming

**Phase 1: Sam Integration**
- [ ] Connect Sam to Slack events
- [ ] Test Sam in Slack environment
- [ ] Add Sam knowledge base from docs

**Phase 2: Backend Transfer**
- [ ] Receive backend code from Tanzeel
- [ ] Integrate with new config structure
- [ ] Update deployment docs

**Phase 3: Documentation & Testing**
- [ ] Add demo video to landing page
- [ ] Mobile responsiveness audit
- [ ] Integration tests for Slack commands
- [ ] CI/CD pipeline with GitHub Actions
