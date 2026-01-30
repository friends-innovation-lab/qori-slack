# Qori

## What is this project?
Qori is an AI-powered research operations platform for VA (Veterans Affairs) UX research teams. It operates through Slack slash commands that generate structured documents stored in GitHub repositories.

## Tech Stack
- Slack Block Kit for UI (modals)
- YAML workflow configurations for AI processing
- GitHub for document storage
- Handlebars/Jinja2 templating for outputs

## Folder Structure
- `/slack/modals/` - Slack modal JSON definitions, grouped by command
- `/workflows/` - YAML configs that define AI processing logic
- `/templates/` - Output templates (markdown files that get generated)
- `/study-template/` - Folder structure copied when creating new studies
- `/docs/learn/` - Tutorial pages (GitHub Pages)
- `/beta-test/` - Active test data (DO NOT modify without asking)

## Slash Commands
- /qori - Show all commands
- /qori-request - Stakeholder submits research request
- /qori-plan - Create study plan, guides, upload research (7 actions)
- /qori-participants - Add or update participants
- /qori-outreach - Generate participant messages (6 message types)
- /qori-observe - Request to observe a session
- /qori-notes - Observer documents session
- /qori-analyze - Analyze session data
- /qori-synthesis - Cross-session synthesis
- /qori-report - Generate stakeholder report + GitHub issues

## Key Principles
- Minimal UI - use Slack's native components
- "Don't bloat" - only add features that solve real problems
- Privacy first - PII redaction built into workflows
- Match real researcher workflows, not idealized processes

## Working with this repo
- Coordinate with Tanzeel (backend developer) before changing file paths
- Modal JSONs must match Slack Block Kit spec
- YAML workflows define the AI prompts and processing logic
