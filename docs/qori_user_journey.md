## 🧭 Qori User Journey: End-to-End ResearchOps with Government Teams

This journey captures a complete flow of how a cross-functional product team uses Qori to plan, execute, synthesize, and act on user research — fully within Slack, GitHub, and YAML-based workflows.

---

### 👥 Team Roles

- **Jordan** – UX Researcher (leads research)
- **Blake** – Designer (needs insights)
- **Tariq** – Product Manager (coordinates work)
- **Asha** – Government Stakeholder (approves studies)

### 🧪 1. Kick Off New Study

Jordan runs:

```
/new study
```

Qori:

- Launches a Slack modal to enter:
  - Study name
  - Brief description
  - Roles: researcher, designer, PM, stakeholder (tagged via dropdown)
- Creates a new GitHub folder structure:
  ```
  studies/user-feedback-housing-app/
  ├── 00-brief/
  ├── 01-planning/
  ├── 02-participants/
  ├── 03-fieldwork/
  ├── 04-analysis/
  ├── 05-findings/
  ├── 06-assets/
  └── README.md
  ```
- Each subfolder starts empty (or with a README.md placeholder)
- Qori prompts Jordan:
  > "Would you like to generate a research brief or plan now?"
  - If yes, Qori runs `research_brief.yaml` and/or `research_plan.yaml` and saves the output to `00-brief/` and `01-planning/`
- Posts in Slack:
  > "📣 New study created: *User Feedback on Housing App*"
  > "👤 @asha, please review the study plan in 00-brief/ and /approve or /reject."
  > "👥 Team assigned: @jordan (Researcher), @blake (Designer), @tariq (PM)"

### ✅ 2. Study Approval

Asha receives a Slack message with interactive buttons:

> "👤 @asha, please review the research plan for *User Feedback on Housing App*."
> "📂 GitHub folder: [https://github.com/agency-org/research/studies/user-feedback-housing-app](https://github.com/agency-org/research/studies/user-feedback-housing-app)"
> "🔍 Files to review:
>
> - `00-brief/research_brief.md`
> - `01-planning/research_plan.md`"
>   Do you approve this study?
>   [Approve] [Request Changes]

If Asha clicks **Approve**:

- Qori confirms the brief and plan files exist and are not empty
- Updates `status.yaml` with:
  ```yaml
  status: Approved
  approver: @asha
  approved_at: 2025-06-30T15:04:00Z
  files_reviewed:
    - 00-brief/research_brief.md
    - 01-planning/research_plan.md
  ```
- Posts back in the Slack thread:
  > "✅ Study approved by @asha. You may now begin participant recruitment."
- Notifies @jordan, @tariq, and @blake that the study is live

Qori also prompts @jordan:

> "📋 Ready to recruit participants? Use `/civicmind participant_tracker` to begin building your participant list and scheduling tracking table in `02-participants/`."

If Asha clicks **Request Changes**:

- Qori prompts her to describe the needed changes via a Slack modal with fields like:
  - What needs to be changed?
  - Optional file references
- Records the request in `status.yaml` as:
  ```yaml
  status: Needs Changes
  requested_by: @asha
  requested_at: 2025-06-30T15:04:00Z
  reason: "The hypothesis section is too vague — please clarify the user goal."
  ```
- Posts back in Slack:
  > "❗ @asha has requested changes to the research plan. Please update the brief or plan and resubmit using `/resubmit`"
- Notifies @jordan with the feedback and file links

### 🔄 2a. Resubmitting for Approval

Jordan revises the requested files and runs:

```
/resubmit
```

Qori:

- Verifies updated files are present
- Posts a new Slack message to @asha:
  > "📄 Updated study plan is ready for review. Please /approve or /request changes again."
- Logs a new review cycle in `status.yaml`:
  ````yaml
  resubmission:
    round: 2
    resubmitted_by: @jordan
    resubmitted_at: 2025-06-30T16:22:00Z
    status: Pending Approval
  ```"
  ````
- Notifies @jordan, @tariq, and @blake that the study is live and ready for next steps

### 📋 3. Recruit Participants

1. **Jordan begins recruitment after the study is approved.**

2. **He runs:**

```
/civicmind participant_tracker
```

Qori:

- Tracks participants manually or ingests them from Calendly via CSV or webhook
- Updates `02-participants/participant_tracker.yaml`

3. **To craft outreach messages, Jordan runs:**

```
/civicmind participant_outreach
```

> 📄 [View Template on GitHub](https://github.com/your-org/civicmind_templates/blob/main/participant_outreach.yaml)

Qori:

- Prompts for tone, date, and contact method
- Generates message and saves to `02-participants/outreach/`

4. **As participants are added, Qori posts recruitment updates in Slack:**

> "📊 Recruitment update: 3 confirmed, 2 pending outreach."
> [Add Observer] [Edit Outreach] [Mark Blocker]

5. **Observers can join sessions by clicking [Add Observer].**

- Qori auto-detects the Slack user and pre-fills them
- Prompts for session and optional notes
- Updates `participant_tracker.yaml`:
  ```yaml
  observers:
    - name: @blake
      added_by: @jordan
      added_at: 2025-07-01T10:00:00Z
  ```
- Sends observer a Slack DM:
  > "👋 You’ve been added as an observer for pt001 on July 5 at 10:00 AM.
  >
  > ✅ Join on time and stay muted
  > ✅ Take notes, but don’t interrupt
  > ✅ Share reflections after the session in #research-synthesis
  > 📁 Reference the session plan: [discussion\_guide.md](https://github.com/agency-org/research/studies/user-feedback-housing-app/03-fieldwork/discussion_guide.md)
  > 📘 Observer Guide: [observer\_guide.md](https://github.com/agency-org/research/studies/user-feedback-housing-app/06-assets/observer_guide.md)"
- Notifies @jordan to manually add the observer to the calendar invite

6. **Jordan continues recruiting.**

- These actions are iterative and continue until all participants are confirmed

7. **Once all sessions are scheduled, Qori posts a final summary in Slack:**

> "📅 All participant sessions for *User Feedback on Housing App* are scheduled."
> "Interested in observing?"
> [Add Observer to Session] [View Tracker]

---

### 🎙️ 4. Run the Session

1. **Jordan runs:**

```
/start-session pt001
```

Qori:

- Posts a session kickoff thread in Slack:
  > "📡 Session started: pt001 — July 5 at 10:00 AM"
  > "Use `/upload-notes` or drop files here to attach to this session."
- Logs metadata to `03-fieldwork/session_log.yaml`

2. **30 minutes before a session, Qori posts reminders:**

> "⏰ Reminder: Your session with pt001 starts in 30 minutes."
>
> - Interviewer: @jordan
> - Observer(s): @blake
>   🗂 Guide: [discussion\_guide.md](...)
>   📋 Checklist: [pt001\_checklist.md](...)

3. **To generate a note scaffold, Jordan runs:**

```
/civicmind session_notes
```

Qori creates a markdown scaffold for live notetaking and pushes to:

```
03-fieldwork/notes/pt001_notes.md
```

4. **After the session, Qori posts:**

> "✅ Session pt001 ended. Please upload notes or transcript using `/upload-notes`."
> "Want a summary? Try `/civicmind summarize_interview` or `/quote_extraction`."

5. **Observers are prompted to share feedback:**
   Qori sends each observer a private message:

> "💬 Thanks for observing pt001. Would you like to share a reflection?"
> [Share Feedback] [Skip]

If the observer clicks **[Share Feedback]**, Qori opens a Slack modal with:

- What stood out to you?
- What moments felt confusing or revealing?
- What did you learn that others should know?

Once submitted, Qori:

- Posts the reflection in a private thread with @jordan
- Appends to:
  ```
  03-fieldwork/observer_feedback.yaml
  ```
  ```yaml
  - session: pt001
    observer: @blake
    submitted_at: 2025-07-05T12:15:00Z
    notes: "Veteran A hesitated during the eligibility step. Seemed unsure about language."
  ```
- Optionally runs `/civicmind thematic_synthesis` to group observer reflections into early insight themes
- Posts:
  > "💡 Observer feedback synthesized. Run `/civicmind insight_card` to capture key learnings or push a finding to GitHub."
  > 03-fieldwork/observer\_feedback.yaml
  ````
  ```yaml
  - session: pt001
    observer: @blake
    submitted_at: 2025-07-05T12:15:00Z
    notes: "Veteran A hesitated during the eligibility step. Seemed unsure about language."
  ````

> "✅ Session pt001 ended. Please upload notes or transcript using `/upload-notes`."
> "Want a summary? Try `/civicmind summarize_interview` or `/quote_extraction`."

---

### 📤 5. Upload Notes or Recordings

After the session ends, Qori prompts:

> "✅ Don’t forget to upload notes or transcripts for pt001. Use `/upload-notes` or drag files into this thread."

Tariq (note-taker) runs:

```
/upload-notes
```

Qori:

- Prompts for file upload + session name
- Saves file to:
  ```
  03-fieldwork/raw_data/notes_2025-07-01.md
  ```
- Adds or updates:
  ```
  03-fieldwork/notes.yaml
  ```
- Automatically runs `note_upload_handler.yaml` to:
  - Summarize notes
  - Post summary in Slack
  - Save result to:
    ```
    04-analysis/notes_2025-07-01_summary.md
    ```

If Zoom recordings are used and Qori is connected to the Zoom API:

- Qori automatically detects new Zoom cloud recordings via webhook
- Checks host, start time, and compares to scheduled sessions in `participant_tracker.yaml`
- When matched (±10 min window), Qori:
  - Retrieves the transcript for the session
  - Saves file to:
    ```
    03-fieldwork/raw_data/zoom_pt001_transcript.md
    ```
  - Updates:
    ```yaml
    - id: pt001
      zoom_recording_link: https://zoom.us/rec/some-id
      transcript_file: 03-fieldwork/raw_data/zoom_pt001_transcript.md
      synced_by: zoom_api
      synced_at: 2025-07-05T10:35:00Z
    ```
  - Prompts in Slack:
    > "📥 Zoom transcript for pt001 has been synced. Would you like to summarize it?"
    > [Summarize Transcript]
  - Runs `zoom_transcript_summary.yaml` and saves output to `04-analysis/`

If Zoom API access is not available:

- Jordan can paste a Zoom link manually
- Qori requests a transcript file or accepts upload
- Then processes as above

### ✨ 6. Synthesize the Data

Jordan begins synthesizing research using YAML templates in Slack:

```
/civicmind quote_extraction
```
- Extracts key quotes with sentiment tags
- Uses `quote_extraction.yaml`
- Output saved to `04-analysis/quotes.md`

```
/civicmind affinity_mapping
```
- Groups observations into emerging themes
- Uses `affinity_mapping.yaml`
- Output saved to `04-analysis/affinity_clusters.md`

```
/civicmind jobs_to_be_done
```
- Maps user goals, barriers, and behaviors
- Output saved to `04-analysis/jobs_to_be_done.md`

```
/civicmind design_opportunity_generator
```
- Translates themes into "How Might We" design prompts for @blake
- Output saved to `04-analysis/design_opportunities.md`

```
/civicmind persona_generator
```
- Drafts personas based on themes, quotes, or goals
- Output saved to `04-analysis/personas.md`

```
/civicmind journey_mapping
```
- Creates a journey map across phases or interactions
- Output saved to `04-analysis/journey_map.md`

```
/civicmind thematic_synthesis
```
- Optionally groups observer reflections and notes into draft insights
- Output saved to `04-analysis/synthesized_observer_themes.md`

All YAML templates are only invoked when needed. This keeps the repo clean and intentional, with only relevant outputs stored in GitHub. This keeps the repo clean and intentional, with only relevant outputs stored in GitHub.

Jordan runs:

```

/civicmind insight_card.yaml
```

Qori:

- Uses `insight_card.yaml` to structure one insight + quote + recommendation
- Posts formatted card in Slack
- Pushes to GitHub as Markdown file in `05-findings/`
- Opens a GitHub Issue via API
- Notifies @tariq (PM) in Slack:
  > "📌 @tariq — A new research insight has been filed as a GitHub Issue.
  > 
  > 📝 *Residents confused by eligibility wording*
  > 🔗 [View GitHub Issue](https://github.com/org/repo/issues/123)
  > 
  > Please triage it into the backlog or assign for discussion."

> "💡 Insight pushed to GitHub Issues: 'Residents confused by eligibility wording'"

### 📚 7. Stakeholder Summary + Final Readout

After synthesis and issue creation, Qori helps Jordan close the loop with stakeholders.

Jordan runs:
```
/civicmind stakeholder_summary
```
- Uses `stakeholder_summary.yaml`
- Generates a brief, executive-friendly synthesis of the study’s findings
- Posts the summary in Slack, tagging @asha:
  > "📣 @asha, here’s a quick summary of the *User Feedback on Housing App* study. Full details below."
  > 📄 [Read stakeholder_summary.md](https://github.com/agency-org/research/studies/user-feedback-housing-app/05-findings/stakeholder_summary.md)

Jordan also runs:
```
/civicmind research_readout
```
- Uses `research_readout.yaml`
- Produces a complete research readout: themes, quotes, findings, recommendations
- Saved in `05-findings/research_readout.md`
- Qori optionally schedules a Slack thread or message series to present one finding per day or per sprint planning cycle

This ensures that busy stakeholders like @asha receive both a TL;DR and access to deeper findings when they’re ready.

---

### 🔁 Daily Slackbot Automations

- ⏰ Reminders to note-takers if `notes.yaml` shows `uploaded: false`
- 🔁 Suggests next YAML template based on last action
- 🔔 Digest or weekly readout of research activity

---

### ✅ Summary of Key Slack Commands

| Command                          | Function                                        |
| -------------------------------- | ----------------------------------------------- |
| `/new study`                     | Create new research folder and assign roles     |
| `/approve` or `/reject`          | Stakeholder decision on study plan              |
| `/upload-notes`                  | Upload raw notes for a session                  |
| `/civicmind [template]`          | Run any YAML template (e.g. `affinity_mapping`) |
| `/civicmind insight_card`        | Turn insight into issue in GitHub               |
| `/civicmind stakeholder_summary` | Generate TL;DR for stakeholders                 |

---

### ✅ System-Wide YAML Artifacts

| File                         | Purpose                                                  |                         | Purpose                                                  |
| ---------------------------- | -------------------------------------------------------- |
| --------------------------   | -------------------------------------------------------- |
| `notes.yaml`                 | Tracks notes upload + summary status                     |
| `status.yaml`                | Tracks study approval and state                          |
| `research_brief.yaml`        | Captures scope, roles, and goals                         |
| `insight_card.yaml`          | Insight + quote + recommendation structure               |
| `note_upload_handler.yaml`   | Summarizes raw notes into key takeaways                  |
| `participant_tracker.yaml`   | Stores participant IDs, scheduling info, and status      |
| `participant_outreach.yaml`  | Generates outreach scripts for phone/email/SMS           |
| `participant_checklist.yaml` | Produces pre-session checklists for researchers          |

### 📦 8. Close the Study

Once the stakeholder summary and final readout are delivered, Qori helps the team formally close out the study.

Jordan runs:
```
/close-study
```

Qori:
- Confirms the final GitHub folder structure is complete
- Updates `status.yaml`:
  ```yaml
  status: Closed
  closed_by: @jordan
  closed_at: 2025-07-10T16:00:00Z
  ```
- Sends a Slack message to the team:
  > "📁 The study *User Feedback on Housing App* has been officially closed. All artifacts are archived in GitHub."
  > 📂 [View Study Folder](https://github.com/agency-org/research/studies/user-feedback-housing-app)
  > 💬 Want to refer back to insights later? Use `/ask-study` to search across quotes, themes, or summaries from this research."
- Optionally triggers a daily or weekly digest if more insights need to be summarized over time
  > 📂 [View Study Folder](https://github.com/agency-org/research/studies/user-feedback-housing-app)
- Optionally triggers a daily or weekly digest if more insights need to be summarized over time

---

### 🧠 Why Teams Adopt Qori

- Everything lives in Slack + GitHub — no extra tools
- YAML enforces structured, repeatable outputs
- Every team member knows what to do, and when
- Insight-to-action flow is built-in (cards → issues)
- Modals + tagging reduce friction for approvals and handoffs
- Folder structure is clean, empty by default, and filled intentionally based on team needs

