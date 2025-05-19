---
name: insight-to-task
about: Convert a research insight into a scoped implementation ticket
title: ''
labels: ''
assignees: ''

---

name: Insight → Design or Dev Task
description: Convert a research insight into a scoped implementation ticket
title: "[Task] "
labels: [design-task, research-based, needs-definition]
body:
  - type: markdown
    attributes:
      value: |
        🧩 Use this template to turn a validated research insight into a task for design or development.
  - type: textarea
    id: problem
    attributes:
      label: Problem / User Need
      description: What problem did the insight reveal?
      placeholder: "Users are unsure if they qualify for the benefit."
  - type: textarea
    id: solution
    attributes:
      label: Proposed Solution (Optional)
      description: Any early ideas or directions to explore?
      placeholder: "Add a yes/no eligibility screener at the top of the form."
  - type: textarea
    id: acceptance
    attributes:
      label: Acceptance Criteria
      description: List the conditions that must be met for this task to be complete.
      placeholder: |
        - [ ] Screener asks 'Are you eligible?'
        - [ ] If 'No', user is directed to info page
        - [ ] If 'Yes', user sees full form
  - type: input
    id: insight_link
    attributes:
      label: Linked Insight
      description: Paste a link or reference to the original research insight.
      placeholder: "https://github.com/org/repo/issues/123"
  - type: dropdown
    id: priority
    attributes:
      label: Priority
      options:
        - High
        - Medium
        - Low
  - type: textarea
    id: notes
    attributes:
      label: Additional Notes
      description: Any Slack threads, design links, or decision history
      placeholder: "Slack convo: https://slack.com/thread/abc123"
