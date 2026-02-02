# Qori Architecture

Technical architecture documentation for the Qori platform.

---

## System Overview

Qori is a Slack-native research operations platform that uses AI to process user inputs and generate structured research documents.

```
┌─────────────────────────────────────────────────────────────────┐
│                         SLACK                                    │
│  ┌─────────────┐                           ┌─────────────────┐  │
│  │ Slash Cmds  │──────┐                    │  Notifications  │  │
│  │ /qori-*     │      │                    │  DMs, Channels  │  │
│  └─────────────┘      │                    └─────────────────┘  │
│                       ▼                            ▲             │
│  ┌─────────────┐  ┌──────────────────┐            │             │
│  │   Modals    │◄─│  Qori Backend    │────────────┘             │
│  │ Block Kit   │  │                  │                          │
│  └─────────────┘  └────────┬─────────┘                          │
└────────────────────────────┼────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
  │  Config     │    │    LLM      │    │   GitHub    │
  │  (YAML/JSON)│    │  (Claude/   │    │   API       │
  │             │    │   GPT-4)    │    │             │
  └─────────────┘    └─────────────┘    └─────────────┘
```

---

## Components

### Slack Integration

**Slash Commands**
- Entry point for all user interactions
- Defined in Slack app configuration
- Route to appropriate modal or handler

**Modals (Block Kit)**
- JSON definitions in `/config/modals/`
- Render as popup forms in Slack
- Collect structured user input
- Validate before submission

**Notifications**
- DM users with output links
- Post to channels for team visibility
- Action buttons for quick actions

### Backend Service

The backend (maintained separately) handles:
- Slack event processing
- Modal submissions
- AI prompt orchestration
- GitHub file operations
- User authentication/authorization

### Configuration Layer

**Modals** (`/config/modals/`)
- Slack Block Kit JSON files
- Define form structure and fields
- Organized by command

**Prompts** (`/config/prompts/`)
- YAML workflow definitions
- AI generation tasks
- Output templates
- Validation rules

**Command Mapping** (`/config/command-mapping.json`)
- Routes commands to modals and prompts
- Defines action menus
- Specifies output paths

### AI Processing

**LLM Providers**
- Claude (Anthropic) - Primary for generation
- GPT-4 (OpenAI) - Fallback/specific tasks

**Processing Flow**
1. Parse user input from modal
2. Load prompt configuration
3. Execute AI generation tasks
4. Validate generated content
5. Populate output template

### GitHub Integration

**File Operations**
- Create/update Markdown files
- Organize by study folder structure
- Commit with descriptive messages

**Study Structure**
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

## Data Flow

### Command Execution Flow

```
1. User types /qori-plan
         │
2. Slack sends command to backend
         │
3. Backend loads modal definition
         │
4. Slack displays modal to user
         │
5. User fills form, clicks Submit
         │
6. Backend receives submission
         │
7. Load prompt configuration
         │
8. Execute AI generation tasks
         │
9. Populate output template
         │
10. Save to GitHub
         │
11. Send Slack notification
         │
12. User sees confirmation
```

### Configuration Loading

```
command-mapping.json
        │
        ├──► Modal JSON ──► Slack renders form
        │
        └──► Prompt YAML ──► AI processes input
                  │
                  ├──► input_variables
                  ├──► ai_generation_tasks
                  ├──► output_template
                  └──► output_options
```

---

## Sam Support Agent

Sam is a conversational AI agent for support.

```
┌─────────────────────────────────────────────┐
│                   SAM                        │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │         Conversation Handler         │   │
│  └────────────────┬─────────────────────┘   │
│                   │                          │
│  ┌───────────┬────┴────┬───────────────┐    │
│  │           │         │               │    │
│  ▼           ▼         ▼               ▼    │
│ Answer    Update    Diagnose      Escalate  │
│ Questions Config    Issues        To Team   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │         Knowledge Sources            │   │
│  │  - docs/help/                        │   │
│  │  - config/prompts/                   │   │
│  │  - config/modals/                    │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Capabilities

| Capability | Description |
|------------|-------------|
| Answer Questions | Query docs and configs |
| Update Config | Modify YAML/JSON (with confirmation) |
| Diagnose Issues | Validate files, check references |
| Escalate | Create support tickets |

---

## Security Considerations

### Authentication
- Slack OAuth for user identity
- GitHub tokens for repo access
- API keys for LLM providers

### Data Privacy
- PII minimization (use participant IDs)
- Redaction in AI processing
- No persistent storage outside GitHub

### Access Control
- Slack workspace membership
- GitHub repo permissions
- Sam can only modify allowed paths

---

## Scalability

### Current Limits
- Slack API rate limits
- LLM token limits
- GitHub API rate limits

### Optimization Strategies
- Caching for frequent lookups
- Async processing for large files
- Batching GitHub commits

---

## Monitoring

### Logs
- `/logs/sam-conversations.log` - Sam interactions
- `/logs/sam-changes.log` - Config changes
- `/logs/escalations.log` - Support escalations

### Metrics
- Command usage by type
- AI generation success rate
- Response times
- Escalation rate

---

## Development

### Local Setup
1. Clone repository
2. Install dependencies
3. Configure Slack app
4. Set environment variables
5. Run backend service

### Adding Features
1. Create modal JSON in `/config/modals/`
2. Create prompt YAML in `/config/prompts/`
3. Update `/config/command-mapping.json`
4. Test via Slack

### File Naming
- Modals: `feature_name.json`
- Prompts: `feature_name.yaml`
- Use snake_case
