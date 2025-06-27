# 🧩 CivicMind Integration Roadmap: Researcher Workflow Enhancers

This roadmap outlines the most impactful integrations to consider for CivicMind beyond Slack and GitHub. Each integration supports a specific stage in the researcher journey and is evaluated by **Impact** vs. **Effort**.

---

## 🔝 Tier 1: High Impact, Medium Effort (Do Next)

### ✅ Zoom Cloud Recordings → CivicMind AI Summarizer
- Auto-transcribe and summarize interviews using Zoom webhooks
- Launch Slack actions from Zoom recordings
- Already scoped in #2 (Zoom Integration Ticket)

### ✅ Notion Exporter → Insight Publishing
- Push YAML outputs (personas, journey maps, summaries) to formatted Notion pages
- Supports long-term insight visibility + org memory
- Great for partner teams and shareouts

### ✅ Slack Digest Bot → Weekly Research Awareness
- Auto-summarize new insights in Slack each week
- Highlights themes, patterns, new signals
- Keeps CivicMind present and top-of-mind

---

## 🧩 Tier 2: Medium Impact, Low Effort (Nice Wins)

### ✅ Google Drive Listener → Raw Input Pipeline
- Monitor folders for `.docx`, `.mp3`, `.wav` or `.pdf` files
- Auto-ingest into CivicMind workflows
- Great for teams who already store research in Drive

### ✅ GitHub Projects → Ticket Generator
- Send JTBDs, HMWs, opportunities directly into GitHub issues
- Label, assign, and link to research sources
- Ideal for turning insight into delivery action

---

## 🧪 Tier 3: High Impact, Higher Effort (R&D Track)

### ✅ Figma → Feedback and Issue Extraction
- Pull Figma sticky notes or comments into YAML workflows (e.g. `usability_issues_extractor`)
- Great for testing sessions and design reviews
- Might require more complex parsing or partner workflow design

### ✅ Calendly/Google Calendar → Participant Tracker Sync
- Sync scheduled interviews into `participant_tracker.yaml`
- Helps ResearchOps manage large participant pipelines

### ✅ Miro Import → Theme Extraction
- Convert old sticky note clusters into YAML-ready quote groups
- Helps teams migrate off Miro with continuity

---

## 🛠️ Tracking Template

| Integration | Impact | Effort | YAML Touched | Notes |
|-------------|--------|--------|--------------|-------|
| Zoom        | 🔥🔥🔥  | ⚙️⚙️   | `transcribe_and_summarize` | Already scoped |
| Notion      | 🔥🔥🔥  | ⚙️⚙️   | All output YAMLs | Publish-ready |
| Slack Digest| 🔥🔥   | ⚙️     | `digest_publisher` (new) | Keep CivicMind sticky |
| Google Drive| 🔥     | ⚙️     | Any `input_type: file` YAMLs | |
| GitHub      | 🔥🔥   | ⚙️     | `jobs_to_be_done`, `tracker`, `card` | |
| Figma       | 🔥🔥🔥  | ⚙️⚙️⚙️ | `usability_issues_extractor` | Needs design sync |
| Calendly    | 🔥     | ⚙️⚙️   | `participant_tracker` | Useful for Ops-heavy teams |
| Miro        | 🔥     | ⚙️⚙️   | `affinity_mapping`, `thematic_synthesis` | Migration tool |

---

## 🧾 YAML Configuration Mapping

```yaml
integrations:
  zoom:
    triggers: ["recording.completed"]
    workflows: ["transcribe_and_summarize", "interview_summary", "quote_extraction"]
  notion:
    output_targets: ["persona_generator", "journey_mapping", "executive_summary", "insights_report"]
  slack_digest:
    scheduler: "weekly"
    workflows: ["all"]
  google_drive:
    file_types: [".mp3", ".wav", ".docx", ".pdf"]
    workflows: ["interview_summary", "affinity_mapping"]
  github_projects:
    push_targets: ["jobs_to_be_done", "design_opportunity_generator", "insight_card"]
  figma:
    source_types: ["sticky_notes", "comments"]
    workflows: ["usability_issues_extractor"]
  calendly:
    sync_fields: ["participant_name", "session_time", "status"]
    workflows: ["participant_tracker"]
  miro:
    import_type: "CSV"
    workflows: ["affinity_mapping", "thematic_synthesis"]
```
