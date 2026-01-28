# 🧠 Affinity Map: VA Mobile App Accessibility Study

> **3 themes** from **1 participant** | **15 evidence items** | **Generated:** January 27, 2025

---

## At a Glance

| Theme | Evidence | Participants | Severity |
|-------|:--------:|:------------:|:--------:|
| Unlabeled Buttons Block Screen Reader Navigation | 6 items | PT001 | 🔴 Critical |
| Hidden Action Buttons at Bottom of Long Pages | 4 items | PT001 | 🟡 High |
| Prescription Section Shows Proper Accessibility Implementation | 5 items | PT001 | 🟢 Medium |

---

## Theme 1: Unlabeled Buttons Block Screen Reader Navigation

**The Pattern:** Multiple interactive elements throughout the VA mobile app are announced only as "Button" by VoiceOver without descriptive labels, creating fundamental barriers for screen reader users to complete tasks.

### Evidence

| Type | Evidence | Source |
|:----:|----------|--------|
| 💬 | "There's a button that just says 'Button' without any descriptive text. That's not helpful at all." | PT001, 00:12:00 |
| 💬 | "There was no way for me to know that's what that button did." | PT001, 00:30:00 |
| 💬 | "I'm hearing a lot of different elements but nothing that clearly says 'Schedule new appointment.'" | PT001, 00:28:00 |
| 💬 | "I shouldn't have to guess what buttons do. That's basic accessibility." | PT001, 00:12:00 |
| 🔴 | Multiple buttons throughout the interface are announced only as "Button" by VoiceOver without descriptive labels, creating fundamental barriers for screen reader users | PT001, 00:12:00 |
| 🔴 | Appointment scheduling section contains multiple unlabeled elements, forcing trial-and-error navigation | PT001, 00:28:00 |

### Implication

**Why it matters:** Screen reader users cannot complete basic tasks when buttons lack descriptive labels, forcing them to guess functionality or abandon tasks entirely.

**Design opportunity:** Implement comprehensive button labeling with descriptive text that clearly indicates each button's function and destination.

---

## Theme 2: Hidden Action Buttons at Bottom of Long Pages

**The Pattern:** Important action buttons like "Edit" are positioned at the bottom of long pages where screen reader users nearly miss them entirely, violating expected interface patterns.

### Evidence

| Type | Evidence | Source |
|:----:|----------|--------|
| 💬 | "Important buttons are hidden at the bottom of screens where they're easy to miss." | PT001, 00:42:00 |
| 💬 | "When they're missing, we're stuck." | PT001, 00:45:00 |
| 🔴 | Edit button positioned at bottom of long page is nearly missed entirely, requiring extensive VoiceOver navigation to discover | PT001, 00:42:00 |
| 👁️ | PT001 employed methodical VoiceOver navigation patterns, exhaustively searching interfaces when standard accessibility practices weren't followed | PT001 |

### Implication

**Why it matters:** Non-standard button placement forces screen reader users to perform exhaustive searches through long pages, significantly increasing task completion time and cognitive load.

**Design opportunity:** Standardize action button placement in consistent, discoverable locations and implement navigation landmarks for quick access.

---

## Theme 3: Prescription Section Shows Proper Accessibility Implementation

**The Pattern:** The prescription management area demonstrates good accessibility implementation with clear labels and logical structure that enables confident navigation for screen reader users.

### Evidence

| Type | Evidence | Source |
|:----:|----------|--------|
| 💬 | "This section actually works pretty well - I can understand what each section contains." | PT001, 00:20:00 |
| 💬 | "The main menu structure makes sense - Health, Benefits, Payments, Profile. That's logical." | PT001, 00:03:00 |
| 💬 | "When things are labeled properly, it's easy to navigate." | PT001 |
| 🟢 | Prescription management area demonstrates good accessibility implementation with clear labels and structure | PT001, 00:20:00 |
| 🟢 | Clear, well-organized main menu categories that make sense to screen reader users | PT001, 00:03:00 |

### Implication

**Why it matters:** When accessibility is properly implemented, PT001 navigates confidently and completes tasks quickly, demonstrating the positive impact of good design.

**Design opportunity:** Replicate the clear labeling and logical structure patterns from the prescription section across other app areas.

---

## ✅ What's Working

Positive findings from the research:

| What Works | Evidence | Source |
|------------|----------|--------|
| Logical main navigation structure | "The main menu structure makes sense - Health, Benefits, Payments, Profile. That's logical." | PT001 |
| Properly labeled prescription section | "This section actually works pretty well - I can understand what each section contains." | PT001 |
| Consistent VoiceOver integration | "When things are labeled properly, it's easy to navigate." | PT001 |

---

## 🔗 Cross-Theme Connections

Themes 1 and 2 represent symptoms of the same root cause: inconsistent accessibility implementation across the VA mobile app. Theme 3 demonstrates that the development team has the capability to implement proper accessibility features, but these patterns haven't been systematically applied throughout the entire application.

---

## Recommended Actions

| Priority | Action | Addresses Theme | Effort |
|:--------:|--------|-----------------|:------:|
| 1 | Conduct comprehensive accessibility audit and add descriptive labels to all interactive elements | Theme 1 | 🔵🔵⚪ |
| 2 | Standardize action button placement in consistent, discoverable locations | Theme 2 | 🔵🔵⚪ |
| 3 | Apply prescription section accessibility patterns across all app areas | Theme 1, 3 | 🔵🔵🔵 |

---

## Methodology

**Framework:** Affinity Diagramming / KJ Method

**Approach:** Inductive clustering — themes emerged from natural patterns in the data rather than predetermined categories. Individual data points were extracted first, then grouped by similarity, then named using participant language.

**Data Sources:** PT001

**Evidence Utilization:** 88% of extracted data points used in themes

---

### References

This analysis follows established qualitative research methods:

- **KJ Method** (Affinity Diagramming) — Jiro Kawakita, 1960s
- **Contextual Design** — Karen Holtzblatt & Hugh Beyer
- **Inductive Thematic Analysis** — Braun & Clarke, 2006

---

*Generated by Qori • January 27, 2025*
