# Participant Tracking

Manage research participants throughout your study lifecycle.

---

## Overview

Participant Tracking helps you:
- Add participants to your study
- Track recruitment and session status
- Update participant information
- View session history

All participant data is stored in your study's GitHub repository.

---

## Adding Participants

### Command

```
/qori-participants
```

Select **Add Participant** from the menu.

### Fields

| Field | Description | Example |
|-------|-------------|---------|
| Participant ID | Unique identifier | "P001" |
| Screening Status | Where they are in recruitment | "Screened - Qualified" |
| Contact Preference | How to reach them | "Email" |
| Session Type | Research method | "Usability Testing" |
| Availability Notes | Scheduling info | "Tues/Thurs afternoons" |

### Best Practices

- **Use consistent IDs** - P001, P002, P003...
- **Avoid PII** - Use IDs, not full names
- **Update promptly** - Keep status current

---

## Updating Participants

### Command

```
/qori-participants
```

Select **Update Participant** from the menu.

### Fields

| Field | Description |
|-------|-------------|
| Select Participant | Choose from your study |
| New Status | Updated status |
| Session Date | If scheduling |
| Session Time | If scheduling |
| Notes | Additional info |

### Status Options

| Status | When to Use |
|--------|-------------|
| Contacted | Reached out, awaiting response |
| Screened - Qualified | Passed screening |
| Screened - Not Qualified | Didn't meet criteria |
| Scheduled | Session booked |
| Completed | Session finished |
| No Show | Didn't attend |
| Cancelled | Withdrew |

---

## Viewing Participants

Participant data is stored in:
```
[study-name]/02-participants/participant-tracker.md
```

The tracker shows:
- All participants with IDs
- Current status
- Session dates
- Quick stats

---

## Integration with Other Features

### Outreach

When generating outreach messages, select participants from the tracker:
```
/qori-outreach
```

### Session Notes

Observers select sessions from the tracker:
```
/qori-notes
```

### Analysis

Participant data links to session data for synthesis.

---

## Privacy Guidelines

### Do
- Use participant IDs (P001)
- Use first name + initial if needed (Alex M.)
- Store only necessary information
- Update status promptly

### Don't
- Store full names
- Include contact details in notes
- Share participant info outside the team
- Keep data after study completion

---

## Common Questions

### How many participants can I track?

No limit. Works well with 5-100+ participants.

### Can I import existing participants?

Not currently. Add manually or ask about bulk import in #qori-support.

### How do I remove a participant?

Update status to "Cancelled" or "Withdrawn". Don't delete records.

### Can I export participant data?

Yes - the tracker is a Markdown file in GitHub. Download or clone the repo.

---

## Related Features

- [Participant Outreach](participant-outreach.md) - Generate messages
- [Session Notes](session-notes.md) - Document sessions
- [Observer Requests](observer-requests.md) - Schedule observers
