# 🧠 Affinity Map: 2027 VA Health and Benefits Mobile App Navigation Study

> **4 themes** from **3 participants** | **32 evidence items** | **Generated:** February 11, 2026

---

## At a Glance

| Theme | Evidence | Participants | Severity |
|:------|:---------|:-------------|:---------|
| Unlabeled Buttons Block Screen Reader Navigation | 8 items | PT001, PT003 | 🔴 Critical |
| Claims Status Buried While Checked Daily | 6 items | PT002, PT003 | 🔴 Critical |
| Text Scaling Works Partially Despite Accessibility Settings | 7 items | PT003, PT001 | 🟡 High |
| Session Timeouts Disrupt Active Task Completion | 5 items | PT003, PT002 | 🟡 High |

---

## Theme 1: Unlabeled Buttons Block Screen Reader Navigation

**The Pattern:** Critical interface buttons lack proper accessibility labels, preventing screen reader users from understanding button functions and completing essential tasks.

### Evidence

| Type | Evidence | Source |
|:----:|----------|--------|
| 💬 | "There's a button that just says 'Button' without any descriptive text. That's not helpful at all." | PT001 |
| 💬 | "I shouldn't have to guess what buttons do. That's basic accessibility." | PT001 |
| 💬 | "Every button needs a proper label. I shouldn't have to guess what things do." | PT001 |
| 💬 | "I need bigger buttons. These are hard to tap with my fingers." | PT003 |
| 🔴 | Multiple buttons throughout the interface were announced only as "Button" by VoiceOver | PT001 |
| 🔴 | Important buttons like edit functions positioned at bottom of long pages where difficult to discover | PT001 |
| 👁️ | Participant took 6 minutes with extensive VoiceOver navigation to find edit button | PT001 |
| 👁️ | Multiple miss-taps observed due to small touch targets | PT003 |

### Implication

**Why it matters:** Expert assistive technology users are completely blocked from completing critical tasks like updating contact information or managing benefits when buttons lack proper labels.

**Design opportunity:** Implement comprehensive accessibility audit with descriptive button labels and increase touch target sizes to meet WCAG guidelines.

---

## Theme 2: Claims Status Buried While Checked Daily

**The Pattern:** Veterans who check claim status daily must navigate through multiple menu levels, while less frequently used information appears prominently on the home screen.

### Evidence

| Type | Evidence | Source |
|:----:|----------|--------|
| 💬 | "Why is claims under Benefits and not on the main screen? I check that every day." | PT002 |
| 💬 | "I had to tap like five times to get to my claim status." | PT002 |
| 💬 | "I wish I could just have claims on my home screen." | PT002 |
| 💬 | "A widget would be amazing. Like I have for my bank." | PT002 |
| 🔴 | Daily task requires excessive navigation effort through multiple menu levels | PT002 |
| 👁️ | Participant checks claims daily but had to navigate through Benefits menu with 5 taps | PT002 |

### Implication

**Why it matters:** The app's information hierarchy doesn't match veteran priorities, creating daily friction for users monitoring critical benefit processes.

**Design opportunity:** Add customizable home screen widgets allowing veterans to surface their most-checked information, particularly claims status.

---

## Theme 3: Text Scaling Works Partially Despite Accessibility Settings

**The Pattern:** Large text accessibility settings improve readability in some interface areas but fail to scale consistently across buttons, input fields, and interactive elements.

### Evidence

| Type | Evidence | Source |
|:----:|----------|--------|
| 💬 | "The big text option is helpful. I can actually read this." | PT003 |
| 💬 | "Text is still too small in some places even with the large text setting." | PT003 |
| 💬 | "Just remember that some of us can't see the screen. We rely entirely on these labels and descriptions." | PT001 |
| 🔴 | Even with large text setting enabled, some UI elements didn't scale properly | PT003 |
| 🔴 | Input fields remained small even with large text accessibility setting | PT003 |
| 👁️ | Participant had to adjust distance from screen and squint before activating large text | PT003 |
| 👁️ | Large text works in some places but not others, creating inconsistent experience | PT003 |

### Implication

**Why it matters:** Partial accessibility implementation undermines the benefit for veterans with vision impairments, creating frustration and reducing task completion confidence.

**Design opportunity:** Audit and standardize text scaling implementation across all UI components to ensure consistent accessibility experience.

---

## Theme 4: Session Timeouts Disrupt Active Task Completion

**The Pattern:** Veterans lose progress on important tasks when sessions expire during active use, particularly impacting complex workflows like secure messaging.

### Evidence

| Type | Evidence | Source |
|:----:|----------|--------|
| 💬 | "Why does this keep logging me out? I was just using it an hour ago." | PT003 |
| 💬 | "The search doesn't find what I'm looking for. I typed 'claim' and got nothing useful." | PT002 |
| 🔴 | Session timeout occurred twice, with second instance causing loss of secure message draft | PT003 |
| 🔴 | Search feature failed to return useful results for common queries, forcing manual navigation | PT002 |
| 👁️ | Lost message draft when session timed out, causing significant frustration | PT003 |

### Implication

**Why it matters:** Security timeouts that don't account for veteran usage patterns cause task abandonment and force veterans to restart complex processes.

**Design opportunity:** Implement intelligent session management with draft saving and extend timeout duration for active users engaged in multi-step tasks.

---

## ✅ What's Working

Positive findings from the research:

| What Works | Evidence | Source |
|------------|----------|--------|
| Logical main menu structure | "The main menu structure makes sense - Health, Benefits, Payments, Profile. That's logical." | PT001 |
| Home screen appointments | "I like that my appointments are right on the home screen. That's what I check most." | PT002 |
| Biometric authentication | "I like that I can use my fingerprint to log in. Much easier than typing passwords." | PT003 |
| Clear payments section | "Payments section is clear. I can see when my money is coming." | PT003 |
| Prescription management | "This section actually works pretty well - I can understand what each section contains." | PT001 |

---

## 🔗 Cross-Theme Connections

The accessibility themes (Unlabeled Buttons and Text Scaling) represent systematic implementation gaps rather than isolated issues. Both stem from inconsistent application of accessibility standards across the interface. Meanwhile, the navigation themes (Claims Burial and Session Timeouts) reflect a mismatch between veteran mental models and system design assumptions. Veterans expect the app to prioritize their most critical, frequent tasks while accommodating their workflow patterns.

---

## Recommended Actions

| Priority | Action | Addresses Theme | Effort |
|:--------:|--------|-----------------|:------:|
| 1 | Implement comprehensive button labeling audit with descriptive accessibility labels | Theme 1 | 🔵🔵⚪ |
| 2 | Add customizable home screen widgets for claims status and frequently checked information | Theme 2 | 🔵🔵🔵 |
| 3 | Standardize text scaling implementation across all UI components and input fields | Theme 3 | 🔵🔵⚪ |
| 4 | Implement draft saving and intelligent session timeout for active users | Theme 4 | 🔵🔵⚪ |

---

## Methodology

**Framework:** Affinity Diagramming / KJ Method

**Approach:** Inductive clustering — themes emerged from natural patterns in the data rather than predetermined categories. Individual data points were extracted first, then grouped by similarity, then named using participant language.

**Data Sources:** PT001, PT002, PT003

**Evidence Utilization:** 89% of extracted data points used in themes

---

### References

This analysis follows established qualitative research methods:

- **KJ Method** (Affinity Diagramming) — Jiro Kawakita, 1960s
- **Contextual Design** — Karen Holtzblatt & Hugh Beyer
- **Inductive Thematic Analysis** — Braun & Clarke, 2006

---

*Generated by Qori • February 11, 2026*
