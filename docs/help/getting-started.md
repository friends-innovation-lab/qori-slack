# Getting Started with Qori

Qori is an AI-powered research operations platform for VA UX research teams. It runs in Slack using slash commands that guide you through research workflows.

## Quick Start

### 1. Join the Qori workspace

Ask your team lead to add you to the Slack workspace with Qori installed.

### 2. Try your first command

Type `/qori` in any channel to see all available commands.

### 3. Start a research project

Use `/qori-plan` to create your first research plan.

---

## Core Concepts

### Slash Commands

Qori uses Slack slash commands to launch different features:

| Command | What it does |
|---------|--------------|
| `/qori` | Show all commands |
| `/qori-request` | Stakeholder submits research request |
| `/qori-plan` | Create study plan, guides, upload research |
| `/qori-participants` | Add or update participants |
| `/qori-outreach` | Generate participant messages |
| `/qori-observe` | Request to observe a session |
| `/qori-notes` | Document session observations |
| `/qori-analyze` | Analyze session data |
| `/qori-synthesis` | Cross-session synthesis |
| `/qori-report` | Generate stakeholder reports |
| `/qori-sam` | Talk to Sam, your support assistant |

### Modals

When you run a command, Qori opens a modal (popup form) in Slack. Fill in the fields and click Submit to generate your output.

### GitHub Integration

Qori saves all outputs to GitHub repositories, organized by study. Each study has a folder structure like:

```
study-name/
  00-requests/
  01-planning/
  02-participants/
  03-fieldwork/
  04-analysis/
  05-findings/
  06-assets/
  07-implementation/
```

---

## Typical Research Workflow

### Phase 1: Planning

1. **Research Request** - Stakeholder submits a request via `/qori-request`
2. **Research Brief** - Create a brief with `/qori-plan` > Research Brief
3. **Research Plan** - Generate a full plan with `/qori-plan` > Research Plan
4. **Discussion Guide** - Create session guide with `/qori-plan` > Discussion Guide

### Phase 2: Recruitment

1. **Add Participants** - Track participants with `/qori-participants`
2. **Outreach Messages** - Generate emails with `/qori-outreach`

### Phase 3: Fieldwork

1. **Observer Requests** - Team requests to observe via `/qori-observe`
2. **Session Notes** - Observers document sessions with `/qori-notes`
3. **Transcripts** - Upload transcripts for processing

### Phase 4: Analysis

1. **Analyze Notes** - Process session data with `/qori-analyze`
2. **Synthesis** - Run cross-session analysis with `/qori-synthesis`
   - Affinity Mapping
   - Journey Mapping
   - Personas
   - Jobs to Be Done

### Phase 5: Reporting

1. **Research Readout** - Generate stakeholder report with `/qori-report`
2. **GitHub Issues** - Create actionable issues for the team

---

## Getting Help

### Talk to Sam

Type `/qori-sam` followed by your question:

```
/qori-sam how do I create a discussion guide?
```

Sam can answer questions, help troubleshoot issues, and connect you with the team.

### Documentation

Browse the full documentation in the `/docs/help/` folder:

- [Commands Reference](commands.md)
- [Troubleshooting](troubleshooting.md)
- [FAQ](faq.md)

### Support Channel

Post questions in `#qori-support` for human help.

---

## Tips for Success

1. **Start with a plan** - Always create a Research Brief before diving into other features
2. **Use consistent naming** - Keep study names and participant IDs consistent
3. **Check your outputs** - Review AI-generated content before sharing
4. **Give feedback** - Help us improve by reporting issues to Sam

---

## Next Steps

- Read the [Commands Reference](commands.md) for detailed command documentation
- Try creating a [Research Plan](research-plan.md)
- Set up [Participant Tracking](participant-tracking.md)
