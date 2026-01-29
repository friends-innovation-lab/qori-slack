# Qori Slack UI Style Guide

> Design standards for all Qori Slack modals and messages. Use this guide to ensure consistency across all workflows.

---

## Modal Structure

Every Qori modal follows this structure:

```
┌─────────────────────────────────────────┐
│  Modal Title + Emoji                    │
├─────────────────────────────────────────┤
│  📋 Intro Context Block (optional)      │
│  Brief description of what this does    │
├─────────────────────────────────────────┤
│  ─────────── Section Header ─────────── │
│  Field 1 *                              │
│  Field 2          │  Field 3            │
├─────────────────────────────────────────┤
│  ─────────── Section Header ─────────── │
│  Field 4 *                              │
│  Field 5 (optional)                     │
├─────────────────────────────────────────┤
│                     [ Cancel ] [ Submit ]│
└─────────────────────────────────────────┘
```

---

## Title Conventions

### Modal Titles

Format: `[Action] [Object] [Emoji]`

| Workflow | Title |
|:---------|:------|
| Research Request | `Research Request 📝` |
| Research Brief | `Research Brief 📋` |
| Participant Outreach | `Participant Outreach 📬` |
| Add Participant | `Add Participant 👤` |
| Stakeholder Synthesis | `Stakeholder Synthesis 🏛️` |
| Discussion Guide | `Discussion Guide 💬` |

### Section Headers

Format: `[Emoji] [Section Name]`

Use these consistently:

| Section Type | Header |
|:-------------|:-------|
| Project/Study info | `📁 Project Info` |
| Research scope | `🎯 Research Scope` |
| Participant info | `👤 Participant Info` |
| Session details | `📅 Session Details` |
| Methodology | `🔬 Methodology` |
| Timeline/constraints | `⏱️ Timeline` |
| Contact/researcher | `📞 Contact Info` |
| Message settings | `⚙️ Settings` |
| Additional context | `📎 Additional Context` |

---

## Field Patterns

### Required vs Optional

- **Required fields:** Add `*` after label
- **Optional fields:** Add `(optional)` after label in lighter context

```json
{
  "type": "input",
  "label": { "type": "plain_text", "text": "Project Title *" },
  ...
}
```

```json
{
  "type": "input",
  "optional": true,
  "label": { "type": "plain_text", "text": "Deadline (optional)" },
  ...
}
```

### Hint Text

Use `hint` for:
- Character limits
- Examples of good input
- Clarifying what to enter

Keep hints under 150 characters.

```json
{
  "type": "input",
  "label": { "type": "plain_text", "text": "Problem Description *" },
  "hint": { "type": "plain_text", "text": "Include data, user complaints, or metrics. Max 800 characters." },
  ...
}
```

### Placeholder Text

Use `placeholder` for:
- Example format
- Sample content

Format: `e.g., [example]`

```json
{
  "element": {
    "type": "plain_text_input",
    "placeholder": { "type": "plain_text", "text": "e.g., Claims Status Navigation Study" }
  }
}
```

---

## Layout Patterns

### Side-by-Side Fields (2 columns)

Use for related short fields:
- Date + Time
- Urgency + Deadline  
- Name + Role
- Method + Sample Size

**Block Kit:** Use `"dispatch_action": false` on both, place in sequence. Slack doesn't support true columns in modals, so use two separate input blocks.

**When to use single column:**
- Textareas (always full width)
- Long text inputs
- Radio button groups
- Checkbox groups

### Section Dividers

Add divider **before** each new section header:

```json
{ "type": "divider" },
{
  "type": "section",
  "text": { "type": "mrkdwn", "text": "*🎯 Research Scope*" }
}
```

**Do NOT add dividers:**
- Between individual fields in same section
- After the last section (before buttons)
- At the very top of the modal

---

## Intro Context Block

Use at top of modal to explain purpose. Keep to 1-2 sentences.

```json
{
  "type": "context",
  "elements": [
    {
      "type": "mrkdwn",
      "text": "📋 Describe the business problem and what you'd like to learn. The research team will create a detailed plan."
    }
  ]
}
```

---

## Dropdowns (Static Select)

### Urgency Options (Standard)

```json
{
  "type": "static_select",
  "placeholder": { "type": "plain_text", "text": "Select urgency..." },
  "options": [
    { "text": { "type": "plain_text", "text": "🔴 Critical (1-2 weeks)" }, "value": "critical" },
    { "text": { "type": "plain_text", "text": "🟠 High (2-4 weeks)" }, "value": "high" },
    { "text": { "type": "plain_text", "text": "🟡 Medium (1-2 months)" }, "value": "medium" },
    { "text": { "type": "plain_text", "text": "🟢 Low (no deadline)" }, "value": "low" }
  ]
}
```

### Tone Options (Standard)

```json
{
  "type": "static_select",
  "placeholder": { "type": "plain_text", "text": "Select tone..." },
  "options": [
    { "text": { "type": "plain_text", "text": "Friendly" }, "value": "friendly" },
    { "text": { "type": "plain_text", "text": "Formal" }, "value": "formal" },
    { "text": { "type": "plain_text", "text": "Casual" }, "value": "casual" }
  ]
}
```

### Research Method Options (Standard)

```json
{
  "type": "static_select",
  "placeholder": { "type": "plain_text", "text": "Select method..." },
  "options": [
    { "text": { "type": "plain_text", "text": "Usability Testing" }, "value": "usability_testing" },
    { "text": { "type": "plain_text", "text": "User Interviews" }, "value": "user_interviews" },
    { "text": { "type": "plain_text", "text": "Contextual Inquiry" }, "value": "contextual_inquiry" },
    { "text": { "type": "plain_text", "text": "Survey" }, "value": "survey" },
    { "text": { "type": "plain_text", "text": "Diary Study" }, "value": "diary_study" },
    { "text": { "type": "plain_text", "text": "Card Sorting" }, "value": "card_sorting" },
    { "text": { "type": "plain_text", "text": "Tree Testing" }, "value": "tree_testing" },
    { "text": { "type": "plain_text", "text": "Concept Testing" }, "value": "concept_testing" },
    { "text": { "type": "plain_text", "text": "Mixed Methods" }, "value": "mixed_methods" }
  ]
}
```

---

## Buttons

### Submit Button Labels

Use action-oriented labels:

| Workflow | Button Label |
|:---------|:-------------|
| Research Request | `Submit Request` |
| Research Brief | `Create Brief` |
| Participant Outreach | `Generate Message` |
| Add Participant | `Add Participant` |
| Synthesis | `Run Synthesis` |
| Analysis | `Run Analysis` |

### Button Style

- **Submit:** Always `"style": "primary"` (green)
- **Cancel:** No style specified (gray default)

```json
{
  "type": "actions",
  "elements": [
    { "type": "button", "text": { "type": "plain_text", "text": "Cancel" }, "action_id": "cancel" },
    { "type": "button", "text": { "type": "plain_text", "text": "Submit Request" }, "style": "primary", "action_id": "submit" }
  ]
}
```

---

## Auto-Populated Fields

When a field is auto-populated (e.g., from Slack profile), show it as disabled/readonly with a badge.

```json
{
  "type": "context",
  "elements": [
    { "type": "mrkdwn", "text": "*Submitted by:* Lapedra Tolson, CEO  `AUTO`" }
  ]
}
```

---

## Message Type Selection (Radio-Style)

For workflows with message type selection (like Participant Outreach), use radio buttons:

```json
{
  "type": "input",
  "label": { "type": "plain_text", "text": "Message Type *" },
  "element": {
    "type": "radio_buttons",
    "options": [
      { "text": { "type": "mrkdwn", "text": "📧 *Initial Recruitment*\nFirst contact to invite participants" }, "value": "initial_recruitment" },
      { "text": { "type": "mrkdwn", "text": "📅 *Session Confirmation*\nConfirm scheduled session details" }, "value": "session_confirmation" },
      { "text": { "type": "mrkdwn", "text": "⏰ *Session Reminder*\n24-48 hour reminder" }, "value": "session_reminder" }
    ]
  }
}
```

---

## Standard Field Widths

Slack modals are fixed width (~500px). Plan accordingly:

| Field Type | Treatment |
|:-----------|:----------|
| Short text (name, title) | Single line input |
| Long text (description) | `multiline: true` textarea |
| Date | `datepicker` element |
| Time | `timepicker` element |
| Selection | `static_select` dropdown |
| Multiple choice | `radio_buttons` or `checkboxes` |

---

## Error States

Slack handles validation errors automatically. Use `optional: false` (default) for required fields.

For custom validation messages in your backend, return:

```json
{
  "response_action": "errors",
  "errors": {
    "project_title": "Project title is required",
    "problem_description": "Please describe the problem in at least 50 characters"
  }
}
```

---

## Checklist: Before Shipping a Modal

- [ ] Title has emoji at end
- [ ] Intro context block explains purpose
- [ ] Sections separated by dividers
- [ ] Section headers use standard emoji + name format
- [ ] Required fields marked with `*`
- [ ] Optional fields marked with `(optional)`
- [ ] Hints provided for complex fields
- [ ] Placeholders use `e.g., [example]` format
- [ ] Submit button has action-oriented label
- [ ] Submit button has `"style": "primary"`
- [ ] Dropdowns have placeholder text
- [ ] All `action_id` and `block_id` values are unique

---

## File Naming Convention

For Block Kit JSON files:

```
qori_modal_[workflow_name].json
```

Examples:
- `qori_modal_research_request.json`
- `qori_modal_research_brief.json`
- `qori_modal_participant_outreach.json`

---

*Last updated: January 29, 2026*
