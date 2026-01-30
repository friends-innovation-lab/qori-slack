# VA Health Benefits Mobile App - Test Data

Sample data for testing Qori slash commands. Each file matches modal fields 1:1 for easy copy/paste.

## Study Overview

| Field | Value |
|-------|-------|
| Study Name | VA Health and Benefits Mobile App Navigation Study |
| Research Focus | Mobile app navigation and information architecture |
| Participants | 3 test participants (David, Amanda, Marcus) |
| Method | Usability testing with accessibility focus |

## Folder Structure

| Folder | Command | Contents |
|--------|---------|----------|
| `qori-request/` | `/qori-request` | Research request fields |
| `qori-plan/` | `/qori-plan` | Brief, plan, guides, desk research, stakeholder notes, survey CSV |
| `qori-participants/` | `/qori-participants` | 3 participant records |
| `qori-outreach/` | `/qori-outreach` | Participant IDs for each message type |
| `qori-notes/` | `/qori-notes` | Session notes + transcripts (both are input options) |

## How to Use

1. Open the folder for the command you're testing
2. Each markdown file shows exact field labels from the modal
3. Copy content from the ``` code blocks
4. Paste into the corresponding modal field
5. Submit and verify output

## qori-plan Files

| File | Modal Action |
|------|--------------|
| `research-brief-input.md` | Create Research Brief |
| `research-plan-input.md` | Create Research Plan |
| `discussion-guide-input.md` | Create Discussion Guide |
| `stakeholder-guide-input.md` | Create Stakeholder Interview Guide |
| `desk-research/*.md` | Upload Desk Research (6 files) |
| `survey-data-sample.csv` | Upload Survey Data |
| `stakeholder-notes-design-lead.md` | Upload Stakeholder Notes (Design Lead) |
| `stakeholder-notes-engineering-lead.md` | Upload Stakeholder Notes (Engineering Lead) |
| `stakeholder-notes-policy-sme.md` | Upload Stakeholder Notes (Policy/Compliance SME) |

## qori-notes Files

| File | Modal Action |
|------|--------------|
| `session-notes-input-1.md` | Manual Notes input (David) |
| `session-notes-input-2.md` | Manual Notes input (Amanda) |
| `session-notes-input-3.md` | Manual Notes input (Marcus) |
| `transcript-input-1.md` | Upload Transcript input (David) |
| `transcript-input-2.md` | Upload Transcript input (Amanda) |
| `transcript-input-3.md` | Upload Transcript input (Marcus) |
| `session-*-notes.md` | Sample output (processed notes) |
| `transcript-*-*.md` | Sample output (processed transcripts) |

## qori-participants Files

| File | Participant |
|------|-------------|
| `participant-1-david.md` | David Chen (PT001) - Tech-savvy, 38 |
| `participant-2-amanda.md` | Amanda Rodriguez (PT002) - Screen reader user, 45 |
| `participant-3-marcus.md` | Marcus Williams (PT003) - Low vision, 62 |
