# Qori Database Schema

Documentation for Qori's data storage and schema.

---

## Overview

Qori uses a hybrid storage approach:
- **GitHub** - Primary document storage (Markdown files)
- **Database** - Operational data (user state, logs, metadata)

---

## GitHub Storage

### Study Repository Structure

Each study is a GitHub repository with this structure:

```
study-name/
├── 00-requests/
│   └── research_request_[date].md
├── 01-planning/
│   ├── research_brief_[date].md
│   ├── research_plan_[date].md
│   └── discussion_guide_[date].md
├── 02-participants/
│   ├── participant_tracker.md
│   └── outreach/
│       └── [participant]_[message_type]_[date].md
├── 03-fieldwork/
│   └── session-notes/
│       └── [session_id]/
│           └── session-notes_[observer]_[date].md
├── 04-analysis/
│   └── session_summary_[session_id].md
├── 05-findings/
│   ├── affinity_mapping.md
│   ├── journey_mapping.md
│   ├── personas.md
│   └── research_readout.md
├── 06-assets/
│   └── [supporting files]
├── 07-implementation/
│   └── github_issues.md
└── README.md
```

### File Naming Conventions

| Document Type | Pattern |
|---------------|---------|
| Research Plan | `research_plan_[title]_[date].md` |
| Session Notes | `session-notes_[observer]_[date].md` |
| Outreach | `[participant_id]_[message_type]_[date].md` |
| Synthesis | `[synthesis_type].md` |

---

## Database Tables

### users

Tracks Slack users who interact with Qori.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  slack_id VARCHAR(20) UNIQUE NOT NULL,
  slack_team_id VARCHAR(20) NOT NULL,
  display_name VARCHAR(255),
  email VARCHAR(255),
  role VARCHAR(50) DEFAULT 'researcher',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### studies

Tracks active research studies.

```sql
CREATE TABLE studies (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  github_repo VARCHAR(255) NOT NULL,
  slack_channel VARCHAR(50),
  lead_researcher_id UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### participants

Participant tracking data.

```sql
CREATE TABLE participants (
  id UUID PRIMARY KEY,
  study_id UUID REFERENCES studies(id),
  participant_id VARCHAR(50) NOT NULL,  -- P001, P002, etc.
  status VARCHAR(50) DEFAULT 'contacted',
  screening_status VARCHAR(50),
  session_type VARCHAR(100),
  session_date TIMESTAMP,
  session_time VARCHAR(20),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(study_id, participant_id)
);
```

### sessions

Research session records.

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  study_id UUID REFERENCES studies(id),
  participant_id UUID REFERENCES participants(id),
  session_id VARCHAR(50) NOT NULL,
  researcher_id UUID REFERENCES users(id),
  session_date DATE NOT NULL,
  session_time TIME,
  session_type VARCHAR(100),
  status VARCHAR(50) DEFAULT 'scheduled',
  meeting_link TEXT,
  notes_path TEXT,  -- GitHub path
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### observers

Observer assignments for sessions.

```sql
CREATE TABLE observers (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES sessions(id),
  observer_id UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending',
  notes_submitted BOOLEAN DEFAULT FALSE,
  notes_path TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### command_logs

Audit log of command executions.

```sql
CREATE TABLE command_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  command VARCHAR(50) NOT NULL,
  action VARCHAR(100),
  study_id UUID REFERENCES studies(id),
  input_data JSONB,
  output_path TEXT,
  status VARCHAR(50),
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### sam_conversations

Sam agent conversation logs.

```sql
CREATE TABLE sam_conversations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  session_id UUID,  -- Conversation session
  message_role VARCHAR(20),  -- 'user' or 'assistant'
  message_content TEXT NOT NULL,
  intent VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### escalations

Support escalation records.

```sql
CREATE TABLE escalations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  summary TEXT NOT NULL,
  category VARCHAR(50),
  priority VARCHAR(20) DEFAULT 'normal',
  channel VARCHAR(50),
  thread_ts VARCHAR(50),
  status VARCHAR(50) DEFAULT 'open',
  claimed_by UUID REFERENCES users(id),
  claimed_at TIMESTAMP,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### config_changes

Audit log of configuration changes made via Sam.

```sql
CREATE TABLE config_changes (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  file_path VARCHAR(255) NOT NULL,
  change_type VARCHAR(50),  -- 'update', 'create', 'delete'
  previous_content TEXT,
  new_content TEXT,
  backup_path TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Indexes

```sql
-- User lookups
CREATE INDEX idx_users_slack_id ON users(slack_id);

-- Study lookups
CREATE INDEX idx_studies_github_repo ON studies(github_repo);
CREATE INDEX idx_studies_status ON studies(status);

-- Participant lookups
CREATE INDEX idx_participants_study ON participants(study_id);
CREATE INDEX idx_participants_status ON participants(status);

-- Session lookups
CREATE INDEX idx_sessions_study ON sessions(study_id);
CREATE INDEX idx_sessions_date ON sessions(session_date);

-- Command log queries
CREATE INDEX idx_command_logs_user ON command_logs(user_id);
CREATE INDEX idx_command_logs_command ON command_logs(command);
CREATE INDEX idx_command_logs_created ON command_logs(created_at);

-- Escalation queries
CREATE INDEX idx_escalations_status ON escalations(status);
CREATE INDEX idx_escalations_priority ON escalations(priority);
```

---

## Relationships

```
users
  │
  ├──< studies (lead_researcher_id)
  │      │
  │      ├──< participants
  │      │      │
  │      │      └──< sessions
  │      │             │
  │      │             └──< observers
  │      │
  │      └──< command_logs
  │
  ├──< sam_conversations
  │
  ├──< escalations (user_id, claimed_by, resolved_by)
  │
  └──< config_changes
```

---

## Data Retention

| Data Type | Retention |
|-----------|-----------|
| Study documents | Permanent (GitHub) |
| Command logs | 1 year |
| Sam conversations | 90 days |
| Escalations | 1 year |
| Config change logs | Permanent |

---

## Migrations

Migrations are managed via database migration tool.

```bash
# Create new migration
npm run migration:create -- --name add_feature

# Run pending migrations
npm run migration:run

# Rollback last migration
npm run migration:rollback
```

---

## Backup

- GitHub: Automatic (distributed)
- Database: Daily backups, 30-day retention
- Configuration: Version controlled in Git

---

## Reference

- [Architecture](architecture.md)
- [Deployment](deployment.md)
