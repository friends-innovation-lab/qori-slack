# Research Plan Feature

Generate comprehensive, VA-compliant research plans in minutes.

---

## Overview

The Research Plan feature transforms your research concept into a complete execution plan. It includes:

- OCTO priorities alignment
- Research goals and success criteria
- Methodology details with protocols
- Participant demographics
- Project timeline
- Risk assessment
- Implementation plan

## When to Use

Use Research Plan when you need:
- A formal document for stakeholder approval
- Complete planning documentation for a study
- Timeline and milestone tracking
- Risk identification and mitigation

For quick alignment, use **Research Brief** instead.

---

## How to Use

### Step 1: Launch the command

```
/qori-plan
```

### Step 2: Select "Research Plan"

Click the Research Plan option from the menu.

### Step 3: Fill in the form

| Field | Description | Example |
|-------|-------------|---------|
| Project Title | Short, descriptive name | "Debt Letters Usability Study" |
| Product Area | VA product being researched | "VA Debt Letters" |
| Decision Context | What decision this informs | "Should we redesign the debt letter format?" |
| Research Goal | What you want to learn | "Understand how veterans interpret current debt letters" |
| Methodology | Select one or more methods | Usability Testing, User Interviews |
| Target Participants | Who you want to recruit | "Veterans who received debt letters in past 6 months" |
| Participant Count | Number of participants | "5-8 participants" |
| Timeline Preference | Study duration | "Standard (4-6 weeks)" |
| Lead Researcher | Your name | "Jordan Smith" |
| Team Office | Your organization | "VA Digital Services" |

### Step 4: Review and Submit

Click **Generate Plan** to create your document.

---

## Output Structure

Your research plan includes these sections:

### Header
- Product area description
- Lead researcher and team
- Date and timeline

### Background
- Decision context
- Why this research matters

### OCTO Priorities
- Primary OCTO priority alignment
- Supporting priorities

### User Journey
- Connection to VA Veteran Journey Map
- Key moments and phases
- Critical pain points

### Research Goals
- Primary goal
- Supporting goals

### Success Criteria & Deliverables
- Measurable success criteria
- Key deliverables with timelines

### Methodology
- Rationale for chosen method
- Implementation approach
- VA compliance notes

### Recruitment
- Target participant criteria
- Demographic targets

### Timeline
- Phase-by-phase schedule
- Key milestones

### Risk Management
- Identified risks
- Mitigation strategies

### Implementation Plan
- Immediate next steps
- Short-term actions
- Long-term follow-up

---

## Tips for Better Plans

### Be Specific About Decisions

Bad: "Learn about the product"
Good: "Determine if the current navigation structure causes veterans to miss important information"

### Choose Appropriate Methodology

- **Usability Testing** - Evaluate specific interactions
- **User Interviews** - Understand behaviors and needs
- **Survey Research** - Quantify attitudes at scale
- **Card Sorting** - Inform information architecture
- **Concept Testing** - Validate design directions

### Set Realistic Timelines

| Timeline | Best For |
|----------|----------|
| Rush (2-3 weeks) | Small studies, urgent decisions |
| Standard (4-6 weeks) | Typical studies |
| Extended (8+ weeks) | Complex studies, hard-to-recruit participants |

### Describe Participants Precisely

Bad: "Veterans"
Good: "Veterans who received debt letters in the past 6 months and have attempted to resolve the debt online"

---

## Common Issues

### Generic OCTO Priorities

**Problem:** Priorities don't match your product.

**Solution:** Be more specific in your product area and decision context fields.

### Timeline Starts Wrong

**Problem:** Dates don't start from today.

**Solution:** The system uses current date. If wrong, regenerate or edit manually.

### Missing Methodology Details

**Problem:** Protocols section is generic.

**Solution:** Select only the methodologies you'll actually use. Multi-method studies get briefer coverage.

---

## Related Features

- [Research Brief](research-brief.md) - Quick 1-page overview
- [Discussion Guide](discussion-guide.md) - Session facilitation guide
- [Participant Tracking](participant-tracking.md) - Manage recruitment
