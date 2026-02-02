# Qori Commands Reference

Complete reference for all Qori slash commands.

---

## /qori

**Description:** Show all available Qori commands

**Usage:** `/qori`

**Output:** Displays a menu of all commands with descriptions

---

## /qori-request

**Description:** Stakeholder submits a research request

**Usage:** `/qori-request`

**Fields:**
- Requester name
- Product/feature area
- Research question
- Business context
- Timeline urgency
- Stakeholders to include

**Output:** Research request document saved to `00-requests/`

---

## /qori-plan

**Description:** Create study planning documents

**Usage:** `/qori-plan`

**Actions:**

### Research Brief
Quick project overview for stakeholder alignment.

**Fields:** Project title, product area, research questions, key stakeholders

**Output:** 1-page brief saved to `01-planning/`

### Research Plan
Comprehensive research execution plan.

**Fields:**
- Project title
- Product area
- Decision context
- Research goal
- Methodology (checkboxes)
- Target participants
- Participant count
- Timeline preference
- Lead researcher
- Team/office

**Output:** Full research plan with OCTO priorities, timeline, risk assessment

### Discussion Guide
Structured guide for research sessions.

**Fields:** Study context, session goals, participant type, key topics

**Output:** Moderator guide with intro script, questions, probes

### Stakeholder Interview Guide
Guide for stakeholder interviews.

**Fields:** Interview goals, stakeholder role, key topics

**Output:** Interview protocol for stakeholder sessions

### Upload Desk Research
Process existing research and documents.

**Fields:** File upload, source description, relevance notes

**Output:** Synthesized desk research summary

### Upload Stakeholder Notes
Process notes from stakeholder conversations.

**Fields:** File upload, participants, meeting context

**Output:** Structured stakeholder insights

### Upload Survey Data
Process survey responses.

**Fields:** File upload, survey context, key questions

**Output:** Survey synthesis with themes and quotes

---

## /qori-participants

**Description:** Manage research participants

**Usage:** `/qori-participants`

**Actions:**

### Add Participant
Add a new participant to the tracker.

**Fields:**
- Participant ID (e.g., P001)
- Screening status
- Contact preference
- Session type
- Availability notes

### Update Participant
Update existing participant status.

**Fields:**
- Select participant
- New status
- Session date/time
- Notes

**Output:** Updated participant tracker in `02-participants/`

---

## /qori-outreach

**Description:** Generate participant communication

**Usage:** `/qori-outreach`

**Message Types:**

### Initial Recruitment
First contact to invite participation.

**Fields:** Participant ID, signup instructions

### Session Confirmation
Confirm scheduled session details.

**Fields:** Participant ID, session date, time, meeting link

### Session Reminder
24-48 hour reminder before session.

**Fields:** Participant ID, session date, time, meeting link

### Rescheduling Request
Request to reschedule a session.

**Fields:** Participant ID, original date, new options

### Follow-up
Gentle check-in for non-responders.

**Fields:** Participant ID

### Thank You
Post-session appreciation.

**Fields:** Participant ID

**Output:** Ready-to-send email saved to `02-participants/outreach/`

---

## /qori-observe

**Description:** Request to observe a research session

**Usage:** `/qori-observe`

**Fields:**
- Study name
- Session to observe
- Observer role
- Observation goals

**Output:** Observer request logged, notifications sent to researcher

---

## /qori-notes

**Description:** Document session observations

**Usage:** `/qori-notes`

**Actions:**

### Take Notes (Live)
Real-time note-taking during sessions.

**Fields:** Session ID, freeform observations

### Manual Notes Entry
Enter notes after a session.

**Fields:** Session ID, freeform observations

### Upload Transcript
Upload and process session transcript.

**Fields:** Session ID, transcript file

**Output:** Structured session notes saved to `03-fieldwork/session-notes/`

**AI Processing:**
- Extracts participant quotes
- Identifies emotional moments
- Documents task completion
- Flags technical issues
- Highlights accessibility observations
- Identifies top 3 key moments

---

## /qori-analyze

**Description:** Analyze session data

**Usage:** `/qori-analyze`

**Fields:**
- Study name
- Sessions to analyze
- Analysis focus

**Output:** Session analysis saved to `04-analysis/`

---

## /qori-synthesis

**Description:** Cross-session synthesis and artifacts

**Usage:** `/qori-synthesis`

**Synthesis Types:**

### Affinity Mapping
Group findings by theme.

**Output:** Clustered insights with theme labels

### Journey Mapping
Visualize user journeys.

**Output:** Journey map with stages, actions, emotions, pain points

### Persona Generator
Create research-backed personas.

**Output:** Persona profiles with goals, behaviors, needs

### Jobs to Be Done
Extract user goals and contexts.

**Output:** JTBD statements with context and outcomes

### Service Blueprint
Map service touchpoints.

**Output:** Blueprint showing frontstage/backstage interactions

### Design Opportunities
Generate design recommendations.

**Output:** Prioritized design opportunities with rationale

### Usability Issues
Extract and categorize issues.

**Output:** Issue list with severity, frequency, recommendations

**Output Location:** `05-findings/`

---

## /qori-report

**Description:** Generate stakeholder deliverables

**Usage:** `/qori-report`

**Actions:**

### Research Readout
Comprehensive stakeholder report.

**Output:** Executive summary, key findings, recommendations

### Targeted Readouts
Role-specific reports.

**Fields:** Target audience, focus areas

**Output:** Customized report for specific stakeholders

### GitHub Issues
Create actionable implementation issues.

**Output:** GitHub issues in the study repository

**Output Location:** `05-findings/` and GitHub Issues

---

## /qori-sam

**Description:** Talk to Sam, Qori's support assistant

**Usage:** `/qori-sam [your question]`

**Examples:**
```
/qori-sam how do I create a research plan?
/qori-sam my modal isn't showing up
/qori-sam I need to talk to someone about a bug
```

**Capabilities:**
- Answer questions about Qori features
- Help troubleshoot issues
- Update configuration files
- Escalate to human team members

---

## Tips for All Commands

1. **Required fields** - Fields marked with * are required
2. **Character limits** - Long text fields have limits shown in the placeholder
3. **Study selection** - Most commands require selecting an active study first
4. **Output locations** - Check GitHub for your generated documents
5. **Slack notifications** - You'll receive a DM when outputs are ready
